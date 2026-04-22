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

export interface IbiznesSchemaInfo {
  source: "sp_zoo" | "firma";
  table: string;
  columns: Array<{ name: string; type: string; nullable: string }>;
  sampleWZ: Array<Record<string, any>>;
  monthlyWZ: Array<{
    rok: number;
    miesiac: number;
    documentsCount: number;
    totalCb: number;
    totalCn: number | null;
    totalWn: number | null;
    totalWb: number | null;
  }>;
}

/**
 * Deep diagnostics — returns column definitions of spec tables + 3 sample WZ rows
 * + per-month WZ sums using every plausible price column that exists.
 * Lets us see which column is netto vs brutto without guessing.
 */
export async function fetchIbiznesDeepDiagnostics(sinceDate: string): Promise<IbiznesSchemaInfo[]> {
  const db = getPool();
  const sinceDwy = sinceDate.replace(/-/g, "");
  const tables: Array<{ source: "sp_zoo" | "firma"; table: string }> = [
    { source: "sp_zoo", table: "addallspkazogrspec" },
    { source: "firma", table: "firmaspec" },
  ];

  const out: IbiznesSchemaInfo[] = [];

  for (const { source, table } of tables) {
    // 1) Column list
    const [colRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME AS name, DATA_TYPE AS type, IS_NULLABLE AS nullable
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [table]
    );

    const columns = (colRows as any[]).map((r) => ({
      name: String(r.name),
      type: String(r.type),
      nullable: String(r.nullable),
    }));
    const colNames = new Set(columns.map((c) => c.name));

    // 2) Sample WZ rows (3 most recent)
    const [sampleRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT * FROM ${table} WHERE Typ = 'WZ' AND Data >= ? ORDER BY Data DESC LIMIT 3`,
      [sinceDwy]
    );

    // 3) Monthly breakdown using Il*Cb, and Cn/Wn/Wb if present
    const hasCn = colNames.has("Cn");
    const hasWn = colNames.has("Wn");
    const hasWb = colNames.has("Wb");

    const extras: string[] = [];
    if (hasCn) extras.push(`ROUND(SUM(Il * Cn), 2) AS totalCn`);
    else extras.push(`NULL AS totalCn`);
    if (hasWn) extras.push(`ROUND(SUM(Wn), 2) AS totalWn`);
    else extras.push(`NULL AS totalWn`);
    if (hasWb) extras.push(`ROUND(SUM(Wb), 2) AS totalWb`);
    else extras.push(`NULL AS totalWb`);

    const [monthlyRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT LEFT(Data, 4) AS rok,
              SUBSTRING(Data, 5, 2) AS miesiac,
              COUNT(DISTINCT NrR) AS cnt,
              ROUND(SUM(Il * Cb), 2) AS totalCb,
              ${extras.join(", ")}
       FROM ${table}
       WHERE Typ = 'WZ' AND Data >= ?
       GROUP BY rok, miesiac
       ORDER BY rok, miesiac`,
      [sinceDwy]
    );

    out.push({
      source,
      table,
      columns,
      sampleWZ: (sampleRows as any[]).map((r) => {
        const obj: Record<string, any> = {};
        for (const k of Object.keys(r)) {
          const v = r[k];
          obj[k] = v instanceof Date ? v.toISOString() : v == null ? null : String(v);
        }
        return obj;
      }),
      monthlyWZ: (monthlyRows as any[]).map((r) => ({
        rok: Number(r.rok),
        miesiac: Number(r.miesiac),
        documentsCount: Number(r.cnt) || 0,
        totalCb: Number(r.totalCb) || 0,
        totalCn: r.totalCn == null ? null : Number(r.totalCn),
        totalWn: r.totalWn == null ? null : Number(r.totalWn),
        totalWb: r.totalWb == null ? null : Number(r.totalWb),
      })),
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
