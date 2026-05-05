import { db } from "./db";
import { clients, ibiznesInvoices, ibizneSyncLog, clientSales, clientSalesWeekly, dailyAnalysis, salesHistory, salesTargets } from "../shared/schema";
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

/**
 * Returns the 1st day of the month that is `monthsBack` months before today.
 * We use the 1st of the month so we always capture *full* months, not partial ranges.
 * Example: today=2026-04-24, monthsBack=3 → "2026-01-01".
 */
function syncSinceMonthStart(monthsBack: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsBack);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
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
    // Sync from the 1st of the month 3 months ago. This guarantees full months
    // (not partial ranges) so comparisons "iBiznes LIVE" vs "ibiznes_invoices"
    // are apples-to-apples. For 2026-04-24 this is 2026-01-01.
    const since = syncSinceMonthStart(3);
    const invoices = await fetchIbiznesInvoices(since);

    // Build NIP → clientId AND alias → clientId maps from CRM
    const allClients = await db
      .select({ id: clients.id, nip: clients.nip, klient: clients.klient, ibiznesAlias: clients.ibiznesAlias })
      .from(clients);

    const nipToClientId = new Map<string, number>();
    const aliasToClientId = new Map<string, number>();

    for (const c of allClients) {
      if (c.nip) nipToClientId.set(normalizeNip(c.nip), c.id);
      // ibiznesAlias takes priority over klient for alias matching (exact override)
      if (c.ibiznesAlias) aliasToClientId.set(normalizeAlias(c.ibiznesAlias), c.id);
      if (c.klient) aliasToClientId.set(normalizeAlias(c.klient), c.id);
    }

    const matchedClientIds = new Set<number>();

    // CRITICAL: Delete existing rows for months present in this fetch, then insert
    // fresh data. Without this, cancelled/deleted WZ from iBiznes stay forever
    // in our table because the fetch query filters them out (Anul='T') — our old
    // upsert-only approach never removed them.
    const monthsInFetch = new Set<string>();
    for (const inv of invoices) {
      const [rok, mies] = inv.dataWyst.split("-");
      monthsInFetch.add(`${rok}-${mies}`);
    }
    for (const key of monthsInFetch) {
      const [rok, mies] = key.split("-").map(Number);
      await db
        .delete(ibiznesInvoices)
        .where(and(eq(ibiznesInvoices.rok, rok), eq(ibiznesInvoices.miesiac, mies)));
    }

    // Now insert each invoice fresh — no conflict possible because we just cleared.
    for (const inv of invoices) {
      let clientId = (inv.nip ? nipToClientId.get(inv.nip) : undefined) ?? null;
      if (!clientId && inv.alias) {
        clientId = aliasToClientId.get(normalizeAlias(inv.alias)) ?? null;
      }
      if (clientId) matchedClientIds.add(clientId);
      else unmatchedNips.add(inv.nip || inv.alias || "unknown");

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
          kosztZakupu: String(inv.kosztZakupu),
        })
        .onConflictDoUpdate({
          // Defensive: in case two WZ share the same NrR+source (shouldn't happen
          // after our cleanup but keeps the sync idempotent under retries).
          target: [ibiznesInvoices.nrR, ibiznesInvoices.source],
          set: {
            clientId: sql`EXCLUDED.client_id`,
            koszt: sql`EXCLUDED.koszt`,
            kosztZakupu: sql`EXCLUDED.koszt_zakupu`,
            alias: sql`EXCLUDED.alias`,
            syncedAt: new Date(),
          },
        });

      invoicesSynced++;
    }

    clientsMatched = matchedClientIds.size;

    // Rebuild all analytics aggregates from iBiznes data
    await aggregateClientSales();
    await aggregateClientSalesWeekly();
    await aggregateDailyAnalysis();
    await aggregateSalesHistory();
    await aggregateSalesTargetsExecution();

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

    // Diagnostic: surface top unmatched NIPs/aliases — these are WZ that did not
    // attribute to any CRM client, so the affected clients may show realizacja
    // lower than reality. Operator can fix by adding NIP/ibiznesAlias.
    if (unmatchedNips.size > 0) {
      const topUnmatched = await db.execute(sql`
        SELECT COALESCE(NULLIF(nip,''), alias, 'unknown') AS key,
               COUNT(*)::int AS cnt,
               ROUND(SUM(CAST(koszt AS NUMERIC))::numeric, 2) AS total
        FROM ibiznes_invoices
        WHERE client_id IS NULL
          AND rok = EXTRACT(YEAR FROM CURRENT_DATE)::int
        GROUP BY key
        ORDER BY total DESC
        LIMIT 10
      `);
      const lines = (topUnmatched.rows as any[]).map(
        (r) => `  - ${r.key}: ${r.cnt} WZ, ${r.total} PLN`
      );
      if (lines.length > 0) {
        console.log(`[ibiznes-sync] Top unmatched (${new Date().getFullYear()}):\n${lines.join("\n")}`);
      }
    }

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
 * Returns the list of (rok, miesiac) pairs currently in ibiznes_invoices.
 * Used to zero out analytics rows before rebuilding — prevents stale data
 * (e.g. WZ re-assigned to a different client or removed in iBiznes).
 */
async function getMonthsFromIbiznes(): Promise<{ rok: number; miesiac: number }[]> {
  const res = await db.execute(sql`
    SELECT DISTINCT rok, miesiac FROM ibiznes_invoices ORDER BY rok, miesiac
  `);
  return (res.rows as any[]).map((r) => ({ rok: Number(r.rok), miesiac: Number(r.miesiac) }));
}

// Fallback margin for clients where iBiznes doesn't report purchase cost
// (Cz=NULL or 0 on all WZ lines — rare, typically promo/gratis items).
const FALLBACK_MARZA_PROCENT = 35.3;

/**
 * Aggregate ibiznes_invoices → client_sales (monthly totals per client).
 * Zeros out all financial columns before rebuild to prevent stale data.
 *
 * Calculation:
 *   sprzedaz = SUM(koszt)          // net sales from iBiznes (SUM(il * CN))
 *   koszt    = SUM(koszt_zakupu)   // actual purchase cost from iBiznes (SUM(il * Cz))
 *   zysk     = sprzedaz - koszt
 *   marza    = zysk / sprzedaz * 100
 *
 * If koszt_zakupu is NULL/0 for all rows (older data before this migration),
 * fall back to FALLBACK_MARZA_PROCENT so the UI doesn't show inflated profit.
 */
async function aggregateClientSales() {
  const months = await getMonthsFromIbiznes();
  for (const m of months) {
    await db
      .update(clientSales)
      .set({ sprzedaz: "0", koszt: "0", zysk: "0", marza: "0" })
      .where(and(eq(clientSales.rok, m.rok), eq(clientSales.miesiac, m.miesiac)));
  }

  const rows = await db.execute(sql`
    SELECT client_id,
           rok,
           miesiac,
           SUM(CAST(koszt AS NUMERIC)) AS sprzedaz_total,
           SUM(CAST(COALESCE(koszt_zakupu, 0) AS NUMERIC)) AS koszt_total
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

    const sprzedazNum = Math.round(Number(row.sprzedaz_total) * 100) / 100;
    let kosztNum = Math.round(Number(row.koszt_total) * 100) / 100;

    // Fallback: if no purchase cost reported, use flat margin so UI is consistent.
    if (kosztNum <= 0 && sprzedazNum > 0) {
      const zyskFallback = sprzedazNum * (FALLBACK_MARZA_PROCENT / 100);
      kosztNum = Math.round((sprzedazNum - zyskFallback) * 100) / 100;
    }

    const zyskNum = Math.round((sprzedazNum - kosztNum) * 100) / 100;
    const marzaNum = sprzedazNum > 0 ? Math.round((zyskNum / sprzedazNum) * 10000) / 100 : 0;

    const sprzedaz = String(sprzedazNum);
    const zysk = String(zyskNum);
    const koszt = String(kosztNum);
    const marza = String(marzaNum);

    if (existing.length > 0) {
      await db
        .update(clientSales)
        .set({ sprzedaz, koszt, zysk, marza })
        .where(eq(clientSales.id, existing[0].id));
    } else {
      await db.insert(clientSales).values({
        clientId: row.client_id,
        rok: row.rok,
        miesiac: row.miesiac,
        sprzedaz,
        koszt,
        zysk,
        marza,
      });
    }
  }
}

/**
 * Aggregate ibiznes_invoices → client_sales_weekly (week-level realizacja).
 * Groups by ISO week within each month.
 */
async function aggregateClientSalesWeekly() {
  const months = await getMonthsFromIbiznes();
  for (const m of months) {
    await db
      .update(clientSalesWeekly)
      .set({ realizacja: "0" })
      .where(
        and(eq(clientSalesWeekly.rok, m.rok), eq(clientSalesWeekly.miesiac, m.miesiac))
      );
  }

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

/**
 * Aggregate ibiznes_invoices → daily_analysis.sprzedaz (daily totals across all clients).
 * Keeps the (rok, miesiac, dzien=0) settings row untouched (that holds dniRobocze).
 */
async function aggregateDailyAnalysis() {
  const months = await getMonthsFromIbiznes();
  for (const m of months) {
    await db.execute(sql`
      UPDATE daily_analysis SET sprzedaz = '0'
      WHERE rok = ${m.rok} AND miesiac = ${m.miesiac} AND dzien >= 1
    `);
  }

  const rows = await db.execute(sql`
    SELECT
      CAST(SPLIT_PART(data_wyst, '-', 1) AS INT) AS rok,
      CAST(SPLIT_PART(data_wyst, '-', 2) AS INT) AS miesiac,
      CAST(SPLIT_PART(data_wyst, '-', 3) AS INT) AS dzien,
      SUM(CAST(koszt AS NUMERIC)) AS total
    FROM ibiznes_invoices
    WHERE data_wyst IS NOT NULL AND data_wyst <> ''
    GROUP BY SPLIT_PART(data_wyst, '-', 1), SPLIT_PART(data_wyst, '-', 2), SPLIT_PART(data_wyst, '-', 3)
  `);

  for (const row of rows.rows as any[]) {
    const rok = Number(row.rok);
    const miesiac = Number(row.miesiac);
    const dzien = Number(row.dzien);
    if (!rok || !miesiac || dzien < 1 || dzien > 31) continue;

    const sprzedaz = String(Math.round(Number(row.total) * 100) / 100);

    const existing = await db
      .select()
      .from(dailyAnalysis)
      .where(
        and(
          eq(dailyAnalysis.rok, rok),
          eq(dailyAnalysis.miesiac, miesiac),
          eq(dailyAnalysis.dzien, dzien)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(dailyAnalysis)
        .set({ sprzedaz })
        .where(eq(dailyAnalysis.id, existing[0].id));
    } else {
      await db.insert(dailyAnalysis).values({ rok, miesiac, dzien, sprzedaz });
    }
  }
}

/**
 * Aggregate ibiznes_invoices → sales_history.wartosc (monthly totals, all clients).
 */
async function aggregateSalesHistory() {
  const months = await getMonthsFromIbiznes();
  for (const m of months) {
    await db
      .update(salesHistory)
      .set({ wartosc: "0" })
      .where(and(eq(salesHistory.rok, m.rok), eq(salesHistory.miesiac, m.miesiac)));
  }

  const rows = await db.execute(sql`
    SELECT rok, miesiac, SUM(CAST(koszt AS NUMERIC)) AS total
    FROM ibiznes_invoices
    GROUP BY rok, miesiac
  `);

  for (const row of rows.rows as any[]) {
    const rok = Number(row.rok);
    const miesiac = Number(row.miesiac);
    const wartosc = String(Math.round(Number(row.total) * 100) / 100);

    const existing = await db
      .select()
      .from(salesHistory)
      .where(and(eq(salesHistory.rok, rok), eq(salesHistory.miesiac, miesiac)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(salesHistory)
        .set({ wartosc })
        .where(eq(salesHistory.id, existing[0].id));
    } else {
      await db.insert(salesHistory).values({ rok, miesiac, wartosc });
    }
  }
}

/**
 * Aggregate ibiznes_invoices → sales_targets.wykonanie_obrotu (monthly realized revenue).
 * Doesn't touch plan_obrotu — only updates execution column.
 */
async function aggregateSalesTargetsExecution() {
  const months = await getMonthsFromIbiznes();
  for (const m of months) {
    await db
      .update(salesTargets)
      .set({ wykonanieObrotu: "0" })
      .where(and(eq(salesTargets.rok, m.rok), eq(salesTargets.miesiac, m.miesiac)));
  }

  const rows = await db.execute(sql`
    SELECT rok, miesiac, SUM(CAST(koszt AS NUMERIC)) AS total
    FROM ibiznes_invoices
    GROUP BY rok, miesiac
  `);

  for (const row of rows.rows as any[]) {
    const rok = Number(row.rok);
    const miesiac = Number(row.miesiac);
    const wykonanie = String(Math.round(Number(row.total) * 100) / 100);

    const existing = await db
      .select()
      .from(salesTargets)
      .where(and(eq(salesTargets.rok, rok), eq(salesTargets.miesiac, miesiac)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(salesTargets)
        .set({ wykonanieObrotu: wykonanie })
        .where(eq(salesTargets.id, existing[0].id));
    } else {
      await db.insert(salesTargets).values({
        rok,
        miesiac,
        planObrotu: "0",
        wykonanieObrotu: wykonanie,
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
