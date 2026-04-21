import mysql from "mysql2/promise";

export interface IbiznesInvoiceRow {
  nrR: string;
  alias: string | null;
  nip: string;
  dataWyst: string; // "yyyy-MM-dd"
  koszt: number;
  source: "sp_zoo" | "firma";
}

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    const url = process.env.IBIZNES_DB_URL;
    if (!url) throw new Error("IBIZNES_DB_URL is not set");
    const separator = url.includes("?") ? "&" : "?";
    pool = mysql.createPool(url + separator + "connectTimeout=15000&waitForConnections=true&connectionLimit=1&queueLimit=2");
  }
  return pool;
}

export async function testIbiznesConnection(): Promise<boolean> {
  try {
    const conn = await getPool().getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch {
    return false;
  }
}

function normalizeNip(nip: string | null | undefined): string {
  if (!nip) return "";
  return nip.replace(/[-\s]/g, "").trim();
}

function parseIbiznesDate(dwy: string | null): string | null {
  if (!dwy || dwy.length < 8) return null;
  const s = dwy.trim();
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/**
 * Fetch WZ (Wydania Zewnętrzne) from spec tables, grouped by document number.
 * Joins with klienci table to get NIP per Alias.
 * Both sp. z o.o. and JDG.
 */
export async function fetchIbiznesInvoices(sinceDate: string): Promise<IbiznesInvoiceRow[]> {
  const db = getPool();
  const sinceDwy = sinceDate.replace(/-/g, "");

  // Sp. z o.o.: WZ from spec. NIP is fetched via scalar subquery (deterministic,
  // no JOIN multiplication when klienci has multiple rows per Alias).
  const [spZooRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT s.NrR, s.Alias, s.Data, ROUND(SUM(s.Il * s.Cb), 2) AS Koszt,
            (SELECT k.NIP FROM addallspkazogrklienci k
             WHERE k.Alias = s.Alias AND k.NIP IS NOT NULL AND k.NIP <> ''
             ORDER BY k.NIP LIMIT 1) AS NIP
     FROM addallspkazogrspec s
     WHERE s.Typ = 'WZ'
       AND s.Data >= ?
     GROUP BY s.NrR, s.Alias, s.Data
     ORDER BY s.Data DESC`,
    [sinceDwy]
  );

  // JDG: same approach for firmaspec
  const [firmaRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT s.NrR, s.Alias, s.Data, ROUND(SUM(s.Il * s.Cb), 2) AS Koszt,
            (SELECT k.NIP FROM firmaklienci k
             WHERE k.Alias = s.Alias AND k.NIP IS NOT NULL AND k.NIP <> ''
             ORDER BY k.NIP LIMIT 1) AS NIP
     FROM firmaspec s
     WHERE s.Typ = 'WZ'
       AND s.Data >= ?
     GROUP BY s.NrR, s.Alias, s.Data
     ORDER BY s.Data DESC`,
    [sinceDwy]
  );

  const result: IbiznesInvoiceRow[] = [];

  for (const row of spZooRows as any[]) {
    const date = parseIbiznesDate(row.Data);
    if (!date) continue;
    const nip = normalizeNip(row.NIP); // may be empty — alias matching still possible
    if (!nip && !row.Alias) continue;  // skip only if both NIP and Alias are missing
    result.push({
      nrR: String(row.NrR),
      alias: row.Alias || null,
      nip,
      dataWyst: date,
      koszt: Number(row.Koszt) || 0,
      source: "sp_zoo",
    });
  }

  for (const row of firmaRows as any[]) {
    const date = parseIbiznesDate(row.Data);
    if (!date) continue;
    const nip = normalizeNip(row.NIP); // may be empty — alias matching still possible
    if (!nip && !row.Alias) continue;  // skip only if both NIP and Alias are missing
    result.push({
      nrR: String(row.NrR),
      alias: row.Alias || null,
      nip,
      dataWyst: date,
      koszt: Number(row.Koszt) || 0,
      source: "firma",
    });
  }

  return result;
}

export interface IbiznesDiagnosticsRow {
  source: "sp_zoo" | "firma";
  typ: string;
  documentsCount: number;
  totalPln: number;
  minDate: string | null;
  maxDate: string | null;
}

/**
 * Returns a breakdown of all `Typ` values in the spec tables for a date range.
 * Helps identify whether `Typ='WZ'` alone is the right filter, or whether
 * the table mixes sales / cost invoices / returns / internal transfers.
 */
export async function fetchIbiznesTypeStats(sinceDate: string): Promise<IbiznesDiagnosticsRow[]> {
  const db = getPool();
  const sinceDwy = sinceDate.replace(/-/g, "");

  const [spZooRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT Typ,
            COUNT(DISTINCT NrR) AS cnt,
            ROUND(SUM(Il * Cb), 2) AS total,
            MIN(Data) AS minDate,
            MAX(Data) AS maxDate
     FROM addallspkazogrspec
     WHERE Data >= ?
     GROUP BY Typ
     ORDER BY total DESC`,
    [sinceDwy]
  );

  const [firmaRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT Typ,
            COUNT(DISTINCT NrR) AS cnt,
            ROUND(SUM(Il * Cb), 2) AS total,
            MIN(Data) AS minDate,
            MAX(Data) AS maxDate
     FROM firmaspec
     WHERE Data >= ?
     GROUP BY Typ
     ORDER BY total DESC`,
    [sinceDwy]
  );

  const out: IbiznesDiagnosticsRow[] = [];

  for (const row of spZooRows as any[]) {
    out.push({
      source: "sp_zoo",
      typ: String(row.Typ || ""),
      documentsCount: Number(row.cnt) || 0,
      totalPln: Number(row.total) || 0,
      minDate: parseIbiznesDate(row.minDate),
      maxDate: parseIbiznesDate(row.maxDate),
    });
  }
  for (const row of firmaRows as any[]) {
    out.push({
      source: "firma",
      typ: String(row.Typ || ""),
      documentsCount: Number(row.cnt) || 0,
      totalPln: Number(row.total) || 0,
      minDate: parseIbiznesDate(row.minDate),
      maxDate: parseIbiznesDate(row.maxDate),
    });
  }

  return out;
}

export interface IbiznesUnmatchedRow {
  source: "sp_zoo" | "firma";
  alias: string;
  nip: string;
  documentsCount: number;
  totalPln: number;
}

/**
 * Returns aliases that appear in WZ documents but have NO NIP in klienci.
 * These are the candidates that land in "unmatched" in CRM — user can decide
 * whether they are real customers (missing in CRM) or non-sales docs (to filter).
 */
export async function fetchIbiznesUnmatchedAliases(sinceDate: string): Promise<IbiznesUnmatchedRow[]> {
  const db = getPool();
  const sinceDwy = sinceDate.replace(/-/g, "");

  const [spZooRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT s.Alias,
            (SELECT k.NIP FROM addallspkazogrklienci k
             WHERE k.Alias = s.Alias AND k.NIP IS NOT NULL AND k.NIP <> ''
             ORDER BY k.NIP LIMIT 1) AS NIP,
            COUNT(DISTINCT s.NrR) AS cnt,
            ROUND(SUM(s.Il * s.Cb), 2) AS total
     FROM addallspkazogrspec s
     WHERE s.Typ = 'WZ' AND s.Data >= ?
     GROUP BY s.Alias
     ORDER BY total DESC
     LIMIT 100`,
    [sinceDwy]
  );

  const [firmaRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT s.Alias,
            (SELECT k.NIP FROM firmaklienci k
             WHERE k.Alias = s.Alias AND k.NIP IS NOT NULL AND k.NIP <> ''
             ORDER BY k.NIP LIMIT 1) AS NIP,
            COUNT(DISTINCT s.NrR) AS cnt,
            ROUND(SUM(s.Il * s.Cb), 2) AS total
     FROM firmaspec s
     WHERE s.Typ = 'WZ' AND s.Data >= ?
     GROUP BY s.Alias
     ORDER BY total DESC
     LIMIT 100`,
    [sinceDwy]
  );

  const out: IbiznesUnmatchedRow[] = [];
  for (const row of spZooRows as any[]) {
    out.push({
      source: "sp_zoo",
      alias: String(row.Alias || ""),
      nip: normalizeNip(row.NIP),
      documentsCount: Number(row.cnt) || 0,
      totalPln: Number(row.total) || 0,
    });
  }
  for (const row of firmaRows as any[]) {
    out.push({
      source: "firma",
      alias: String(row.Alias || ""),
      nip: normalizeNip(row.NIP),
      documentsCount: Number(row.cnt) || 0,
      totalPln: Number(row.total) || 0,
    });
  }
  return out;
}

/** Fetch distinct clients (NIP + Alias) known to iBiznes */
export async function fetchIbiznesClients(): Promise<{ nip: string; alias: string }[]> {
  const db = getPool();
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT Alias, NIP FROM addallspkazogrklienci
     WHERE NIP IS NOT NULL AND NIP != ''
     UNION
     SELECT Alias, NIP FROM firmaklienci
     WHERE NIP IS NOT NULL AND NIP != ''`
  );
  return (rows as any[])
    .filter(r => r.NIP)
    .map(r => ({ nip: normalizeNip(r.NIP), alias: String(r.Alias || "") }));
}
