/**
 * Synchronizacja faktur kosztowych z KSeF (Subject2 = ADD ALL jako nabywca).
 *
 * Architektura (lustro `ibiznesSync.ts`):
 *  1. Pobierz listę FV z `fetchKsefCostInvoices` za ostatnie 3 miesiące.
 *  2. Dla każdej FV przypisz kategorię:
 *     - jeśli istnieje wiersz w `ksef_supplier_categories` po NIP-ie → użyj go,
 *     - inaczej rozpoznaj po słowach kluczowych w nazwie sprzedawcy,
 *     - inaczej "Inne".
 *  3. UPSERT po `ksef_number` (unikalny w skali kraju).
 *     Istniejące ręczne nadpisanie (`kategoria_manual=true`) jest CHRONIONE
 *     — sync nigdy nie zmieni kategorii ustawionej przez użytkownika.
 *  4. Zapisz log do `ksef_sync_log`.
 *
 * Wzorzec rozpoznawania kategorii: case-insensitive substring match na
 * `sellerName`. Lista słów kluczowych pokrywa najczęstsze koszty B2B w PL.
 * Mapowanie jest rozszerzalne — admin może dopisywać NIP-y w UI.
 */

import { db } from "./db";
import { ksefInvoices, ksefSupplierCategories, ksefSyncLog } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { fetchKsefCostInvoices, isKsefConfigured, type KsefInvoiceMetadata } from "./ksef";

let syncRunning = false;

/**
 * Reguły rozpoznawania kategorii po nazwie sprzedawcy (case-insensitive).
 * Pierwsze dopasowanie wygrywa, więc kolejność ma znaczenie — bardziej
 * specyficzne wzorce idą wyżej.
 *
 * Kategorie odpowiadają tym używanym w finance.tsx (CATEGORY_COLORS),
 * dzięki czemu pieces "wpadną" w istniejące słupki bez zmian w UI.
 */
const KEYWORD_RULES: Array<{ kategoria: string; keywords: string[] }> = [
  { kategoria: "Leasing", keywords: ["leasing", "lease", "alphabet", "carefleet", "masterlease", "vehis"] },
  {
    kategoria: "Paliwo",
    keywords: [
      "shell", "orlen", "bp polska", "lotos", "circle k", "moya",
      "amic", "olejówka", "stacja paliw", "paliwo", "diesel",
    ],
  },
  {
    kategoria: "Media/Prąd",
    keywords: [
      "tauron", "pgnig", "pgn ig", "enea", "innogy", "pge ", "rwe",
      "energa", "energia elektr", "prąd", "gaz polska", "gazownia",
      "veolia", "wodociągi", "mpwik",
    ],
  },
  {
    kategoria: "IT/Subskrypcje",
    keywords: [
      "orange polska", "play sp", "t-mobile", "plus sp", "netia",
      "vectra", "upc", "telefonia", "telefonika", "telefon",
      "internet", "microsoft", "google ireland", "google llc",
      "adobe", "slack", "notion", "github", "atlassian", "openai",
      "anthropic", "saas", "subskryp", "licencja oprogramo",
    ],
  },
  { kategoria: "IT/Serwis", keywords: ["serwis komputer", "naprawa it", "wsparcie informa", "helpdesk", "it support"] },
  {
    kategoria: "Wysyłka/Poczta",
    keywords: ["poczta polska", "kurier", "dpd polska", "dhl", "inpost", "ups polska", "gls polska", "fedex"],
  },
  {
    kategoria: "Ubezpieczenia",
    keywords: ["ubezpiec", "polisa", "warta", "pzu ", "allianz", "generali", "ergo hestia", "uniqa", "compensa"],
  },
  { kategoria: "Księgowość", keywords: ["księgowo", "biuro rachunkowe", "rachunkowo", "doradztwo podatkowe", "podatkowe biuro"] },
  { kategoria: "Biuro", keywords: ["czynsz", "najem biur", "wynajem biur", "office", "materiał biuro", "art. biur"] },
  {
    kategoria: "Płatności/Terminal",
    keywords: ["elavon", "polcard", "first data", "tpay", "przelewy24", "payu", "stripe", "terminal płat"],
  },
  { kategoria: "Transport", keywords: ["transport drog", "spedycja", "fracht", "logist"] },
  { kategoria: "Serwis/Naprawa", keywords: ["serwis", "naprawa", "warsztat"] },
];

function normalizeText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => ({ ą:"a", ć:"c", ę:"e", ł:"l", ń:"n", ó:"o", ś:"s", ź:"z", ż:"z" }[ch] as string))
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNip(nip: string | null | undefined): string {
  return (nip || "").replace(/[-\s]/g, "").trim();
}

export function categorizeBySellerName(name: string | null | undefined): string {
  const normalized = normalizeText(name);
  if (!normalized) return "Inne";
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (normalized.includes(normalizeText(kw))) return rule.kategoria;
    }
  }
  return "Inne";
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMonthMonthsBack(monthsBack: number): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() - monthsBack);
  return d;
}

export async function runKsefSync(
  trigger: "cron" | "manual" = "cron",
  options: { monthsBack?: number } = {},
): Promise<{ invoicesSynced: number; invoicesNew: number }> {
  if (!isKsefConfigured()) {
    throw new Error("KSeF: brak konfiguracji (KSEF_TOKEN / KSEF_NIP)");
  }
  if (syncRunning) throw new Error("Synchronizacja KSeF już trwa");
  syncRunning = true;

  const [logEntry] = await db
    .insert(ksefSyncLog)
    .values({ startedAt: new Date(), status: "running", trigger })
    .returning();

  let invoicesSynced = 0;
  let invoicesNew = 0;

  try {
    // Domyślnie 3 pełne miesiące wstecz — pokrywa cały okres analizy
    // miesięcznej (bieżący + 2 wstecz) z lekkim zapasem.
    const monthsBack = options.monthsBack ?? 3;
    const dateFrom = isoDate(startOfMonthMonthsBack(monthsBack));
    const dateTo = isoDate(new Date());

    const fetched = await fetchKsefCostInvoices(dateFrom, dateTo);

    // Mapowanie NIP → wymuszona kategoria.
    const supplierMappings = await db.select().from(ksefSupplierCategories);
    const nipToCategory = new Map<string, string>();
    for (const row of supplierMappings) {
      nipToCategory.set(normalizeNip(row.nip), row.kategoria);
    }

    for (const inv of fetched) {
      const sellerNip = normalizeNip(inv.seller?.nip);
      const sellerName = inv.seller?.name ?? null;
      const issueDate = inv.issueDate; // yyyy-MM-dd
      const [yearStr, monthStr] = issueDate.split("-");
      const rok = Number(yearStr);
      const miesiac = Number(monthStr);

      const autoKategoria =
        nipToCategory.get(sellerNip) ?? categorizeBySellerName(sellerName);

      const buyer = inv.buyer?.identifier ?? null;
      const buyerNip = buyer?.type?.toLowerCase() === "nip" ? buyer.value : null;

      const existing = await db
        .select()
        .from(ksefInvoices)
        .where(eq(ksefInvoices.ksefNumber, inv.ksefNumber))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(ksefInvoices).values({
          ksefNumber: inv.ksefNumber,
          invoiceNumber: inv.invoiceNumber,
          issueDate,
          rok,
          miesiac,
          sellerNip,
          sellerName,
          buyerNip,
          buyerName: inv.buyer?.name ?? null,
          netAmount: String(inv.netAmount ?? 0),
          vatAmount: String(inv.vatAmount ?? 0),
          grossAmount: String(inv.grossAmount ?? 0),
          currency: inv.currency || "PLN",
          kategoria: autoKategoria,
          kategoriaManual: false,
          invoiceHash: inv.invoiceHash,
        });
        invoicesNew++;
      } else {
        // Update — ale NIE nadpisuj ręcznie ustawionej kategorii.
        const row = existing[0];
        await db
          .update(ksefInvoices)
          .set({
            invoiceNumber: inv.invoiceNumber,
            issueDate,
            rok,
            miesiac,
            sellerNip,
            sellerName,
            buyerNip,
            buyerName: inv.buyer?.name ?? null,
            netAmount: String(inv.netAmount ?? 0),
            vatAmount: String(inv.vatAmount ?? 0),
            grossAmount: String(inv.grossAmount ?? 0),
            currency: inv.currency || "PLN",
            kategoria: row.kategoriaManual ? row.kategoria : autoKategoria,
            invoiceHash: inv.invoiceHash,
            syncedAt: new Date(),
          })
          .where(eq(ksefInvoices.id, row.id));
      }

      invoicesSynced++;
    }

    await db
      .update(ksefSyncLog)
      .set({
        finishedAt: new Date(),
        status: "success",
        invoicesSynced,
        invoicesNew,
      })
      .where(eq(ksefSyncLog.id, logEntry.id));

    console.log(`[ksef-sync] Done: ${invoicesSynced} faktur (${invoicesNew} nowych)`);
    return { invoicesSynced, invoicesNew };
  } catch (err: any) {
    console.error("[ksef-sync] Error:", err.message);
    await db
      .update(ksefSyncLog)
      .set({ finishedAt: new Date(), status: "error", message: err.message })
      .where(eq(ksefSyncLog.id, logEntry.id));
    throw err;
  } finally {
    syncRunning = false;
  }
}

export async function getLastKsefSyncStatus() {
  const logs = await db
    .select()
    .from(ksefSyncLog)
    .orderBy(sql`${ksefSyncLog.id} DESC`)
    .limit(1);
  return logs[0] ?? null;
}

export async function getKsefSyncLogs(limit = 20) {
  return db
    .select()
    .from(ksefSyncLog)
    .orderBy(sql`${ksefSyncLog.id} DESC`)
    .limit(limit);
}

/**
 * Po zmianie mapowania NIP→kategoria, przelicz auto-kategorie dla wszystkich
 * faktur, które NIE są ręcznie nadpisane.
 */
export async function recategorizeInvoices(): Promise<{ updated: number }> {
  const allInvoices = await db
    .select()
    .from(ksefInvoices)
    .where(eq(ksefInvoices.kategoriaManual, false));

  const supplierMappings = await db.select().from(ksefSupplierCategories);
  const nipToCategory = new Map<string, string>();
  for (const row of supplierMappings) {
    nipToCategory.set(normalizeNip(row.nip), row.kategoria);
  }

  let updated = 0;
  for (const inv of allInvoices) {
    const sellerNip = normalizeNip(inv.sellerNip);
    const newKategoria =
      nipToCategory.get(sellerNip) ?? categorizeBySellerName(inv.sellerName);
    if (newKategoria !== inv.kategoria) {
      await db
        .update(ksefInvoices)
        .set({ kategoria: newKategoria })
        .where(eq(ksefInvoices.id, inv.id));
      updated++;
    }
  }
  return { updated };
}

/**
 * Zwraca nieskategoryzowane (jako "Inne") NIP-y posortowane po sumie netto
 * — admin po liście od razu widzi, dla których dostawców warto dodać regułę.
 */
export async function getTopUnclassifiedSuppliers(limit = 20) {
  const rows = await db.execute(sql`
    SELECT seller_nip                AS nip,
           MAX(seller_name)          AS nazwa,
           COUNT(*)::int             AS faktur,
           ROUND(SUM(CAST(net_amount AS NUMERIC)), 2)::float AS razem_netto
    FROM ksef_invoices
    WHERE kategoria = 'Inne'
       OR kategoria IS NULL
    GROUP BY seller_nip
    ORDER BY razem_netto DESC NULLS LAST
    LIMIT ${limit}
  `);
  return rows.rows;
}
