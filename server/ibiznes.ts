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
 * Fetch invoices from both Sp. z o.o. and sole-proprietorship tables.
 * sinceDate = "yyyy-MM-dd"
 */
export async function fetchIbiznesInvoices(sinceDate: string): Promise<IbiznesInvoiceRow[]> {
  const db = getPool();
  const sinceDwy = sinceDate.replace(/-/g, ""); // "yyyyMMdd"

  const [spZooRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT NrR, Alias, Nip, Dwy, Koszt
     FROM addallspkazogrfaktury
     WHERE Typ = 'VAT'
       AND Akt != 'T'
       AND Dwy >= ?
       AND Nip IS NOT NULL AND Nip != ''
     ORDER BY Dwy DESC`,
    [sinceDwy]
  );

  const [firmaRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT NrR, Alias, Nip, Dwy, Koszt
     FROM firmafaktury
     WHERE Akt != 'T'
       AND Dwy >= ?
       AND Nip IS NOT NULL AND Nip != ''
     ORDER BY Dwy DESC`,
    [sinceDwy]
  );

  const result: IbiznesInvoiceRow[] = [];

  for (const row of spZooRows as any[]) {
    const date = parseIbiznesDate(row.Dwy);
    if (!date) continue;
    result.push({
      nrR: String(row.NrR),
      alias: row.Alias || null,
      nip: normalizeNip(row.Nip),
      dataWyst: date,
      koszt: Number(row.Koszt) || 0,
      source: "sp_zoo",
    });
  }

  for (const row of firmaRows as any[]) {
    const date = parseIbiznesDate(row.Dwy);
    if (!date) continue;
    result.push({
      nrR: String(row.NrR),
      alias: row.Alias || null,
      nip: normalizeNip(row.Nip),
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
    `SELECT DISTINCT Nip, Alias FROM addallspkazogrfaktury
     WHERE Typ = 'VAT' AND Nip IS NOT NULL AND Nip != ''
     UNION
     SELECT DISTINCT Nip, Alias FROM firmafaktury
     WHERE Nip IS NOT NULL AND Nip != ''`
  );
  return (rows as any[])
    .filter(r => r.Nip)
    .map(r => ({ nip: normalizeNip(r.Nip), alias: String(r.Alias || "") }));
}
