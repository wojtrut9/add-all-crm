/**
 * Polskie dni wolne od pracy (z kodeksu pracy):
 *  - 1 stycznia (Nowy Rok)
 *  - 6 stycznia (Trzech Króli)
 *  - Niedziela Wielkanocna (ruchome)
 *  - Poniedziałek Wielkanocny (ruchome)
 *  - 1 maja (Święto Pracy)
 *  - 3 maja (Konstytucji)
 *  - Boże Ciało (ruchome, 60 dni po Wielkanocy)
 *  - 15 sierpnia (Wniebowzięcie NMP / Wojska Polskiego)
 *  - 1 listopada (Wszystkich Świętych)
 *  - 11 listopada (Niepodległości)
 *  - 24 grudnia (Wigilia) — od 2025 r.
 *  - 25 grudnia (1. dzień Świąt)
 *  - 26 grudnia (2. dzień Świąt)
 *
 * Niedziela jest i tak weekendowa — pomijamy ją z listy bo countWorkdays
 * już ją wyklucza. Wystarczy wykluczyć daty wypadające w dni robocze.
 */

/** Algorytm Meeus/Jones/Butcher — niedziela wielkanocna (zachodnia, gregoriańska). */
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function addDays(year: number, month: number, day: number, delta: number): Date {
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + delta);
  return d;
}

/** Zwraca Set<"MM-DD"> dla wszystkich świąt w danym roku. */
export function getPolishHolidaysForYear(year: number): Set<string> {
  const fmt = (m: number, d: number) =>
    `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const fixed: Array<[number, number]> = [
    [1, 1],   // Nowy Rok
    [1, 6],   // Trzech Króli
    [5, 1],   // Święto Pracy
    [5, 3],   // Konstytucji
    [8, 15],  // Wniebowzięcie / Wojska Polskiego
    [11, 1],  // Wszystkich Świętych
    [11, 11], // Niepodległości
    [12, 25], // 1. dzień Świąt
    [12, 26], // 2. dzień Świąt
  ];
  if (year >= 2025) fixed.push([12, 24]); // Wigilia — święto od 2025

  const set = new Set<string>(fixed.map(([m, d]) => fmt(m, d)));

  const easter = easterSunday(year);
  const easterMonday = addDays(year, easter.month, easter.day, 1);
  const corpusChristi = addDays(year, easter.month, easter.day, 60);
  set.add(fmt(easterMonday.getMonth() + 1, easterMonday.getDate()));
  set.add(fmt(corpusChristi.getMonth() + 1, corpusChristi.getDate()));
  // (Niedziela wielkanocna jest niedzielą, więc weekendowy filtr ją łapie.)

  return set;
}

/** True jeśli (year, month, day) to dzień roboczy w Polsce (pon-pt + nie-święto). */
export function isPolishWorkday(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  if (dow === 0 || dow === 6) return false; // niedziela / sobota
  const key = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return !getPolishHolidaysForYear(year).has(key);
}

/** Liczy dni robocze w (year, month=1..12) od dnia 1 do upToDay włącznie. */
export function countPolishWorkdays(year: number, month: number, upToDay: number): number {
  const holidays = getPolishHolidaysForYear(year);
  let n = 0;
  for (let d = 1; d <= upToDay; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0 || dow === 6) continue;
    const key = `${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (holidays.has(key)) continue;
    n++;
  }
  return n;
}

/** Liczy dni robocze w całym miesiącu. */
export function countPolishWorkdaysInMonth(year: number, month: number): number {
  const totalDays = new Date(year, month, 0).getDate();
  return countPolishWorkdays(year, month, totalDays);
}
