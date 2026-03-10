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
      przekazany BOOLEAN NOT NULL DEFAULT false,
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
      sprzedaz DECIMAL,
      koszt DECIMAL,
      zysk DECIMAL,
      marza DECIMAL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS client_sales_weekly (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL,
      rok INTEGER NOT NULL,
      miesiac INTEGER NOT NULL,
      tydzien INTEGER NOT NULL,
      plan DECIMAL,
      realizacja DECIMAL,
      notatki TEXT,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS sales_targets (
      id SERIAL PRIMARY KEY,
      rok INTEGER NOT NULL,
      miesiac INTEGER NOT NULL,
      plan_obrotu DECIMAL,
      wykonanie_obrotu DECIMAL
    );

    CREATE TABLE IF NOT EXISTS salaries (
      id SERIAL PRIMARY KEY,
      osoba TEXT NOT NULL,
      firma TEXT NOT NULL,
      dzial TEXT NOT NULL,
      forma_zatrudnienia TEXT,
      netto DECIMAL,
      brutto DECIMAL,
      vat DECIMAL,
      koszt_pracodawcy DECIMAL,
      aktywny_miesiace JSONB
    );

    CREATE TABLE IF NOT EXISTS costs (
      id SERIAL PRIMARY KEY,
      nazwa TEXT NOT NULL,
      firma TEXT,
      dzial TEXT,
      rodzaj TEXT,
      kategoria TEXT,
      netto DECIMAL,
      koszt DECIMAL,
      notatka TEXT,
      aktywny_miesiace JSONB
    );

    CREATE TABLE IF NOT EXISTS fleet (
      id SERIAL PRIMARY KEY,
      opis TEXT NOT NULL,
      firma TEXT,
      dzial TEXT,
      rodzaj TEXT,
      netto DECIMAL,
      koszt DECIMAL,
      aktywny_miesiace JSONB
    );

    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      tytul TEXT NOT NULL,
      client_id INTEGER,
      autor TEXT NOT NULL,
      kategoria TEXT NOT NULL DEFAULT 'Inna',
      tagi TEXT,
      tresc TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS daily_analysis (
      id SERIAL PRIMARY KEY,
      rok INTEGER NOT NULL,
      miesiac INTEGER NOT NULL,
      dzien INTEGER NOT NULL,
      sprzedaz DECIMAL,
      dni_robocze INTEGER NOT NULL DEFAULT 21
    );

    CREATE TABLE IF NOT EXISTS sales_history (
      id SERIAL PRIMARY KEY,
      rok INTEGER NOT NULL,
      miesiac INTEGER NOT NULL,
      wartosc DECIMAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      tytul TEXT NOT NULL,
      opis TEXT,
      data TEXT NOT NULL,
      godzina TEXT,
      godzina_koniec TEXT,
      client_id INTEGER,
      note_id INTEGER,
      typ TEXT NOT NULL DEFAULT 'Spotkanie',
      autor TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Zaplanowane',
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE clients ADD COLUMN IF NOT EXISTS przekazany BOOLEAN NOT NULL DEFAULT false;

    CREATE TABLE IF NOT EXISTS ibiznes_invoices (
      id SERIAL PRIMARY KEY,
      nr_r TEXT NOT NULL,
      source TEXT NOT NULL,
      client_id INTEGER,
      nip TEXT NOT NULL,
      alias TEXT,
      data_wyst TEXT NOT NULL,
      rok INTEGER NOT NULL,
      miesiac INTEGER NOT NULL,
      koszt DECIMAL(12,2),
      synced_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(nr_r, source)
    );

    CREATE TABLE IF NOT EXISTS ibiznes_sync_log (
      id SERIAL PRIMARY KEY,
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'running',
      message TEXT,
      invoices_synced INTEGER DEFAULT 0,
      clients_matched INTEGER DEFAULT 0,
      clients_unmatched INTEGER DEFAULT 0,
      trigger TEXT DEFAULT 'cron'
    );

    ALTER TABLE clients ADD COLUMN IF NOT EXISTS nip TEXT;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS ibiznes_alias TEXT;
  `);

  console.log("Database schema ensured.");
}
