import { pool } from "./db";

export async function migrateDatabase() {
  console.log("Ensuring database schema exists...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      imie TEXT NOT NULL,
      rola TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      klient TEXT NOT NULL,
      client_id TEXT NOT NULL UNIQUE,
      opiekun TEXT NOT NULL,
      segment TEXT NOT NULL,
      grupa_mvp TEXT,
      status TEXT NOT NULL DEFAULT 'Aktywny',
      aktywny BOOLEAN NOT NULL DEFAULT true,
      telefon TEXT,
      telefon_dodatkowy TEXT,
      email TEXT,
      email_dodatkowe TEXT,
      preferowana_forma_kontaktu TEXT,
      zamowienia_gdzie TEXT,
      dni_zamowien TEXT,
      rytm_kontaktu TEXT,
      miasto TEXT,
      kraj TEXT,
      notatki TEXT,
      rabat_procent DECIMAL,
      warunki_platnosci TEXT,
      termin_platnosci_dni INTEGER,
      limit_kredytowy DECIMAL,
      ubezpieczenie_status TEXT,
      osoba_kontaktowa TEXT,
      braki_zamowien INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL,
      opiekun TEXT NOT NULL,
      data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Do zrobienia',
      kwota DECIMAL,
      typ TEXT NOT NULL DEFAULT 'Cykliczny',
      priorytet TEXT NOT NULL DEFAULT 'Normalny',
      forma_kontaktu TEXT,
      notatka TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id SERIAL PRIMARY KEY,
      data_dostawy TEXT NOT NULL,
      lp INTEGER,
      client_id INTEGER NOT NULL,
      kierowca TEXT,
      opiekun TEXT,
      auto TEXT,
      platnosc TEXT,
      uwagi TEXT,
      kilometry DECIMAL,
      wartosc_netto_wz DECIMAL,
      wina_skalo BOOLEAN DEFAULT false,
      akcja_windykacja TEXT DEFAULT 'brak',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id SERIAL PRIMARY KEY,
      imie TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      nazwa TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS client_sales (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL,
      rok INTEGER NOT NULL,
      miesiac INTEGER NOT NULL,
      wartosc DECIMAL DEFAULT 0,
      marza DECIMAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS client_sales_weekly (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL,
      rok INTEGER NOT NULL,
      tydzien INTEGER NOT NULL,
      wartosc DECIMAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sales_targets (
      id SERIAL PRIMARY KEY,
      rok INTEGER NOT NULL,
      miesiac INTEGER NOT NULL,
      plan_obrotu DECIMAL DEFAULT 0,
      wykonanie_obrotu DECIMAL DEFAULT 0,
      plan_marzy DECIMAL DEFAULT 0,
      wykonanie_marzy DECIMAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS salaries (
      id SERIAL PRIMARY KEY,
      osoba TEXT NOT NULL,
      firma TEXT,
      dzial TEXT,
      forma_zatrudnienia TEXT,
      netto TEXT,
      brutto TEXT,
      koszt_pracodawcy TEXT,
      aktywny_miesiace JSONB
    );

    CREATE TABLE IF NOT EXISTS costs (
      id SERIAL PRIMARY KEY,
      nazwa TEXT NOT NULL,
      dzial TEXT,
      koszt TEXT,
      aktywny_miesiace JSONB
    );

    CREATE TABLE IF NOT EXISTS fleet (
      id SERIAL PRIMARY KEY,
      opis TEXT NOT NULL,
      rodzaj TEXT,
      koszt TEXT,
      aktywny_miesiace JSONB
    );

    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      tytul TEXT NOT NULL,
      tresc TEXT,
      kategoria TEXT,
      autor TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sales_history (
      id SERIAL PRIMARY KEY,
      rok INTEGER NOT NULL,
      miesiac INTEGER NOT NULL,
      wartosc DECIMAL DEFAULT 0
    );
  `);

  console.log("Database schema ensured.");
}
