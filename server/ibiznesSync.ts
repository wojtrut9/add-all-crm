import { db } from "./db";
import { clients, ibiznesInvoices, ibizneSyncLog, clientSales, clientSalesWeekly } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { fetchIbiznesInvoices, testIbiznesConnection } from "./ibiznes";

let syncRunning = false;

function normalizeNip(nip: string | null | undefined): string {
  if (!nip) return "";
  return nip.replace(/[-\s]/g, "").trim();
}

function normalizeAlias(name: string): string {
  return name
    .toLowerCase()
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function syncSinceDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

export async function runIbiznesSync(trigger: "cron" | "manual" = "cron"): Promise<{
  invoicesSynced: number;
  clientsMatched: number;
  clientsUnmatched: number;
}> {
  if (syncRunning) throw new Error("Synchronizacja już trwa");
  syncRunning = true;

  const [logEntry] = await db
    .insert(ibizneSyncLog)
    .values({ startedAt: new Date(), status: "running", trigger })
    .returning();

  let invoicesSynced = 0;
  let clientsMatched = 0;
  const unmatchedNips = new Set<string>();

  try {
    // Sync last 90 days (covers current + 2 previous months fully)
    const since = syncSinceDays(90);
    const invoices = await fetchIbiznesInvoices(since);

    // Build NIP → clientId AND alias → clientId maps from CRM
    const allClients = await db
      .select({ id: clients.id, nip: clients.nip, klient: clients.klient })
      .from(clients);

    const nipToClientId = new Map<string, number>();
    const aliasToClientId = new Map<string, number>();

    for (const c of allClients) {
      if (c.nip) nipToClientId.set(normalizeNip(c.nip), c.id);
      if (c.klient) aliasToClientId.set(normalizeAlias(c.klient), c.id);
    }

    // Upsert each invoice — match by NIP first, then by alias name
    for (const inv of invoices) {
      let clientId = nipToClientId.get(inv.nip) ?? null;
      if (!clientId && inv.alias) {
        clientId = aliasToClientId.get(normalizeAlias(inv.alias)) ?? null;
      }
      if (clientId) clientsMatched++;
      else unmatchedNips.add(inv.nip);

      const [rok, miesiacStr] = inv.dataWyst.split("-");

      await db
        .insert(ibiznesInvoices)
        .values({
          nrR: inv.nrR,
          source: inv.source,
          clientId,
          nip: inv.nip,
          alias: inv.alias,
          dataWyst: inv.dataWyst,
          rok: Number(rok),
          miesiac: Number(miesiacStr),
          koszt: String(inv.koszt),
        })
        .onConflictDoUpdate({
          target: [ibiznesInvoices.nrR, ibiznesInvoices.source],
          set: {
            clientId: sql`EXCLUDED.client_id`,
            koszt: sql`EXCLUDED.koszt`,
            alias: sql`EXCLUDED.alias`,
            syncedAt: new Date(),
          },
        });

      invoicesSynced++;
    }

    // Rebuild clientSales aggregates for each (clientId, rok, miesiac) touched
    await aggregateClientSales();
    await aggregateClientSalesWeekly();

    await db
      .update(ibizneSyncLog)
      .set({
        finishedAt: new Date(),
        status: "success",
        invoicesSynced,
        clientsMatched,
        clientsUnmatched: unmatchedNips.size,
      })
      .where(eq(ibizneSyncLog.id, logEntry.id));

    console.log(
      `[ibiznes-sync] Done: ${invoicesSynced} invoices, ${clientsMatched} matched, ${unmatchedNips.size} unmatched NIPs`
    );

    return { invoicesSynced, clientsMatched, clientsUnmatched: unmatchedNips.size };
  } catch (err: any) {
    console.error("[ibiznes-sync] Error:", err.message);
    await db
      .update(ibizneSyncLog)
      .set({ finishedAt: new Date(), status: "error", message: err.message })
      .where(eq(ibizneSyncLog.id, logEntry.id));
    throw err;
  } finally {
    syncRunning = false;
  }
}

/**
 * Aggregate ibiznes_invoices → client_sales (monthly totals per client).
 * Only updates rows that have a clientId.
 */
async function aggregateClientSales() {
  const rows = await db.execute(sql`
    SELECT client_id, rok, miesiac, SUM(CAST(koszt AS NUMERIC)) AS total
    FROM ibiznes_invoices
    WHERE client_id IS NOT NULL
    GROUP BY client_id, rok, miesiac
  `);

  for (const row of rows.rows as any[]) {
    const existing = await db
      .select()
      .from(clientSales)
      .where(
        and(
          eq(clientSales.clientId, row.client_id),
          eq(clientSales.rok, row.rok),
          eq(clientSales.miesiac, row.miesiac)
        )
      )
      .limit(1);

    const sprzedaz = String(Math.round(Number(row.total) * 100) / 100);

    if (existing.length > 0) {
      await db
        .update(clientSales)
        .set({ sprzedaz })
        .where(eq(clientSales.id, existing[0].id));
    } else {
      await db.insert(clientSales).values({
        clientId: row.client_id,
        rok: row.rok,
        miesiac: row.miesiac,
        sprzedaz,
      });
    }
  }
}

/**
 * Aggregate ibiznes_invoices → client_sales_weekly (week-level realizacja).
 * Groups by ISO week within each month.
 */
async function aggregateClientSalesWeekly() {
  // Get weekly invoice totals using PostgreSQL date functions
  const rows = await db.execute(sql`
    SELECT
      client_id,
      rok,
      miesiac,
      CEIL(EXTRACT(DAY FROM CAST(data_wyst AS DATE)) / 7.0)::int AS tydzien,
      SUM(CAST(koszt AS NUMERIC)) AS total
    FROM ibiznes_invoices
    WHERE client_id IS NOT NULL
    GROUP BY client_id, rok, miesiac, tydzien
  `);

  for (const row of rows.rows as any[]) {
    const tydzien = Math.min(Math.max(Number(row.tydzien), 1), 5);

    const existing = await db
      .select()
      .from(clientSalesWeekly)
      .where(
        and(
          eq(clientSalesWeekly.clientId, row.client_id),
          eq(clientSalesWeekly.rok, row.rok),
          eq(clientSalesWeekly.miesiac, row.miesiac),
          eq(clientSalesWeekly.tydzien, tydzien)
        )
      )
      .limit(1);

    const realizacja = String(Math.round(Number(row.total) * 100) / 100);

    if (existing.length > 0) {
      await db
        .update(clientSalesWeekly)
        .set({ realizacja })
        .where(eq(clientSalesWeekly.id, existing[0].id));
    } else {
      await db.insert(clientSalesWeekly).values({
        clientId: row.client_id,
        rok: row.rok,
        miesiac: row.miesiac,
        tydzien,
        realizacja,
      });
    }
  }
}

export async function getLastSyncStatus() {
  const logs = await db
    .select()
    .from(ibizneSyncLog)
    .orderBy(sql`${ibizneSyncLog.id} DESC`)
    .limit(1);
  return logs[0] ?? null;
}

export async function getSyncLogs(limit = 20) {
  return db
    .select()
    .from(ibizneSyncLog)
    .orderBy(sql`${ibizneSyncLog.id} DESC`)
    .limit(limit);
}

export { testIbiznesConnection };
