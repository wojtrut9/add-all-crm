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
    pool = mysql.createPool(url + "?connectTimeout=10000&waitForConnections=true&connectionLimit=3");
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

  // Sp. z o.o.: WZ from spec joined with klienci for NIP
  const [spZooRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT s.NrR, s.Alias, s.Data, ROUND(SUM(s.Il * s.Cb), 2) AS Koszt, k.NIP
     FROM addallspkazogrspec s
     LEFT JOIN addallspkazogrklienci k ON k.Alias = s.Alias
     WHERE s.Typ = 'WZ'
       AND s.Data >= ?
     GROUP BY s.NrR, s.Alias, s.Data, k.NIP
     ORDER BY s.Data DESC`,
    [sinceDwy]
  );

  // JDG: WZ from firmaspec joined with firmaklienci for NIP
  const [firmaRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT s.NrR, s.Alias, s.Data, ROUND(SUM(s.Il * s.Cb), 2) AS Koszt, k.NIP
     FROM firmaspec s
     LEFT JOIN firmaklienci k ON k.Alias = s.Alias
     WHERE s.Typ = 'WZ'
       AND s.Data >= ?
     GROUP BY s.NrR, s.Alias, s.Data, k.NIP
     ORDER BY s.Data DESC`,
    [sinceDwy]
  );

  const result: IbiznesInvoiceRow[] = [];

  for (const row of spZooRows as any[]) {
    const date = parseIbiznesDate(row.Data);
    if (!date) continue;
    const nip = normalizeNip(row.NIP);
    if (!nip) continue;
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
    const nip = normalizeNip(row.NIP);
    if (!nip) continue;
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
