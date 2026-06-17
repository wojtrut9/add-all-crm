/**
 * Shared logic for importing the KSeF "koszty" register (Paulina's xls)
 * as a monthly fixed-cost template into the `costs` table.
 *
 * Reused by:
 *   - script/import-fixed-costs-from-ksef.ts (CLI dry-run / write)
 *   - POST /api/finance/import-ksef-template (UI upload)
 */
import XLSX from "xlsx";

export const KSEF_TEMPLATE_FIRMA = "KSEF_TEMPLATE";

export const ALL_MONTHS_TRUE: Record<string, boolean> = {
  sty: true, lut: true, mar: true, kwi: true, maj: true, cze: true,
  lip: true, sie: true, wrz: true, paz: true, lis: true, gru: true,
};

const DEFAULT_VAT = 0.23;
const grossToNet = (brutto: number) => Math.round((brutto / (1 + DEFAULT_VAT)) * 100) / 100;

export interface KsefTemplateEntry {
  kategoria: string;
  nazwa: string;
  nip: string | null;
  nrFaktury: string;
  brutto: number;
  netto: number;
}

export interface KsefTemplateSkipped {
  reason: string;
  klient: string;
  nrFaktury: string;
  akcja: string;
}

export interface KsefTemplateParseResult {
  kosztowaCount: number;
  entries: KsefTemplateEntry[];
  skipped: KsefTemplateSkipped[];
}

export function classifyKsefAkcja(akcja: string): string | null {
  const a = akcja.toUpperCase().trim();
  if (a.startsWith("WYNAGRODZENIE")) return "Wynagrodzenia";
  if (a.startsWith("ZARZADCZA")) return "Wynagrodzenia zarząd (JDG)";
  if (a.startsWith("SAMOCHODOWE")) return "Auto";
  if (a.startsWith("NAJEM")) return "Najem";
  if (a.startsWith("USŁUGI OBCE") || a.startsWith("USLUGI OBCE")) return "Usługi obce";
  if (a.startsWith("MEDIA")) return "Media/Prąd";
  if (a.startsWith("WYPOSAŻENIE") || a.startsWith("WYPOSAZENIE")) return "Wyposażenie";
  if (a.startsWith("REFAKTURA")) return "Refaktura";
  if (a.startsWith("SPOŻYWCZE") || a.startsWith("SPOZYWCZE")) return "Spożywcze";
  return null;
}

type KsefRow = {
  "Nr Faktury": string | null;
  "Klient": string | null;
  "NIP": number | string | null;
  "Wartość": number | null;
  "Rej. ZAK.": string | null;
  "AKCJA": string | null;
};

export function parseKsefKosztoweRows(fileBuffer: Buffer): KsefTemplateParseResult {
  const wb = XLSX.read(fileBuffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("Plik Excel jest pusty");

  const rows = XLSX.utils.sheet_to_json<KsefRow>(sheet, { defval: null });
  const kosztowa = rows.filter((r) => (r["Rej. ZAK."] || "").toString().trim() === "KOSZTOWA");

  const entries: KsefTemplateEntry[] = [];
  const skipped: KsefTemplateSkipped[] = [];

  for (const r of kosztowa) {
    const akcja = (r["AKCJA"] || "").toString().trim();
    const klient = (r["Klient"] || "").toString().trim();
    const brutto = Number(r["Wartość"]) || 0;
    const nr = (r["Nr Faktury"] || "(brak nr)").toString();
    const nip = r["NIP"] != null ? String(r["NIP"]) : null;

    if (brutto <= 0) {
      skipped.push({ reason: "brutto=0 (załącznik bez wartości)", klient, nrFaktury: nr, akcja });
      continue;
    }
    const kategoria = classifyKsefAkcja(akcja);
    if (!kategoria) {
      skipped.push({ reason: `nieznana AKCJA: "${akcja}"`, klient, nrFaktury: nr, akcja });
      continue;
    }
    entries.push({
      kategoria,
      nazwa: klient || `Pozycja KSeF ${nr}`,
      nip,
      nrFaktury: nr,
      brutto,
      netto: grossToNet(brutto),
    });
  }

  return { kosztowaCount: kosztowa.length, entries, skipped };
}
