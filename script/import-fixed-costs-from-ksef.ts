/**
 * Import "koszty stałe" template from a KSeF cost-register XLS export
 * (file shared by Paulina). Reads rows where `Rej. ZAK. = KOSZTOWA`,
 * maps each to a category, and inserts into `costs` with
 * `aktywnyMiesiace` = all 12 months → these become the monthly baseline.
 *
 * Usage:
 *   tsx script/import-fixed-costs-from-ksef.ts <path-to-xls> [--write] [--replace]
 *
 * Default = dry-run (prints what would be inserted, no DB changes).
 * --write   = insert into DB
 * --replace = delete existing rows where firma='KSEF_TEMPLATE' before insert
 */
import "dotenv/config";
import XLSX from "xlsx";
import { db } from "../server/db";
import { costs } from "../shared/schema";
import { eq } from "drizzle-orm";
import { parseKsefKosztoweRows, classifyKsefAkcja, ALL_MONTHS_TRUE, KSEF_TEMPLATE_FIRMA } from "../server/ksefTemplate";

async function main() {
  const xlsPath = process.argv[2];
  const write = process.argv.includes("--write");
  const replace = process.argv.includes("--replace");
  if (!xlsPath) {
    console.error("Usage: tsx script/import-fixed-costs-from-ksef.ts <xls> [--write] [--replace]");
    process.exit(1);
  }

  const wb = XLSX.readFile(xlsPath);
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xls" });
  const parsed = parseKsefKosztoweRows(buffer);

  console.log(`\n=== KSeF KOSZTOWA → fixed-cost template ===`);
  console.log(`Plik:                     ${xlsPath}`);
  console.log(`KOSZTOWA wierszy w pliku: ${parsed.kosztowaCount}`);
  console.log(`Do importu:               ${parsed.entries.length}`);
  console.log(`Pominięte:                ${parsed.skipped.length}\n`);

  const byKat: Record<string, { n: number; sum: number }> = {};
  for (const e of parsed.entries) {
    const k = e.kategoria;
    if (!byKat[k]) byKat[k] = { n: 0, sum: 0 };
    byKat[k].n++;
    byKat[k].sum += e.brutto;
  }
  console.log("Po kategoriach:");
  for (const [k, v] of Object.entries(byKat).sort((a, b) => b[1].sum - a[1].sum)) {
    console.log(`  ${k.padEnd(18)} | ${String(v.n).padStart(3)} wpisów | ${v.sum.toFixed(2).padStart(10)} zł`);
  }
  const total = parsed.entries.reduce((s, e) => s + e.brutto, 0);
  console.log(`  ${"RAZEM".padEnd(18)} | ${String(parsed.entries.length).padStart(3)} wpisów | ${total.toFixed(2).padStart(10)} zł\n`);

  console.log("--- Szczegóły ---");
  for (const e of parsed.entries) {
    console.log(`  [${e.kategoria.padEnd(14)}] ${e.brutto.toFixed(2).padStart(10)} brutto | ${e.nazwa} (${e.nrFaktury})`);
  }
  if (parsed.skipped.length > 0) {
    console.log("\n--- Pominięte ---");
    for (const s of parsed.skipped) console.log(`  ${s.reason} | ${s.klient} / ${s.nrFaktury} / "${s.akcja}"`);
  }

  if (!write) {
    console.log("\n[DRY-RUN] Nie wstawiam do bazy. Uruchom z --write żeby zapisać.");
    return;
  }

  if (replace) {
    const del = await db.delete(costs).where(eq(costs.firma, KSEF_TEMPLATE_FIRMA));
    console.log(`Usunięto stary template (firma=${KSEF_TEMPLATE_FIRMA}).`);
  }

  console.log("Wstawianie do bazy...");
  for (const e of parsed.entries) {
    await db.insert(costs).values({
      nazwa: e.nazwa,
      firma: KSEF_TEMPLATE_FIRMA,
      dzial: e.kategoria,
      rodzaj: null,
      kategoria: e.kategoria,
      netto: String(e.netto),
      koszt: String(e.brutto),
      notatka: `KSeF template: ${e.nrFaktury}${e.nip ? ` / NIP ${e.nip}` : ""}`,
      aktywnyMiesiace: ALL_MONTHS_TRUE,
    });
  }
  console.log(`Wstawiono ${parsed.entries.length} rekordów. ✓`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
