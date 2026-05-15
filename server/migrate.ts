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
      nip TEXT NOT NULL DEFAULT '',
      alias TEXT,
      data_wyst TEXT NOT NULL,
      rok INTEGER NOT NULL,
      miesiac INTEGER NOT NULL,
      koszt DECIMAL(12,2),
      synced_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(nr_r, source)
    );
    ALTER TABLE ibiznes_invoices ALTER COLUMN nip SET DEFAULT '';
    ALTER TABLE ibiznes_invoices ADD COLUMN IF NOT EXISTS koszt_zakupu DECIMAL;

    -- sales_targets: explicit flag for admin-set custom monthly goal.
    -- Otherwise the goal is derived automatically (prev month × 1.05).
    ALTER TABLE sales_targets ADD COLUMN IF NOT EXISTS plan_obrotu_custom BOOLEAN NOT NULL DEFAULT FALSE;

    -- client_sales_weekly: explicit flag for admin/handlowiec set per-client target.
    -- Without it, getPlanRealization defaults to prev month × 1.05 even when
    -- legacy auto-generated weekly plans still sit in the table.
    ALTER TABLE client_sales_weekly ADD COLUMN IF NOT EXISTS plan_user_set BOOLEAN NOT NULL DEFAULT FALSE;

    -- iBiznes "unmatched" entries that admin chose to permanently ignore.
    -- Sync skips matching invoices, so they never count in any turnover total.
    CREATE TABLE IF NOT EXISTS ibiznes_ignored (
      id SERIAL PRIMARY KEY,
      nip TEXT NOT NULL DEFAULT '',
      alias TEXT,
      source TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      created_by TEXT,
      note TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ibiznes_ignored_unique
      ON ibiznes_ignored(nip, COALESCE(alias, ''), source);

    -- Additional NIPs per CRM client (for "same legal entity, multiple NIPs"
    -- — e.g. school + gmina sharing same buyer).
    CREATE TABLE IF NOT EXISTS client_nips (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      nip TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_nips_nip ON client_nips(nip);
    CREATE INDEX IF NOT EXISTS idx_client_nips_client_id ON client_nips(client_id);

    -- One-shot backfill: known multi-NIP clients. Idempotent via UNIQUE(nip).
    INSERT INTO client_nips (client_id, nip, note)
    SELECT id, '7971930946', 'Gmina Belsk (auto-backfill)'
    FROM clients
    WHERE klient ILIKE '%szko%belsk%'
    ORDER BY id
    LIMIT 1
    ON CONFLICT (nip) DO NOTHING;

    INSERT INTO client_nips (client_id, nip, note)
    SELECT id, '1231217438', 'Gmina Konstancin-Jeziorna (auto-backfill)'
    FROM clients
    WHERE klient ILIKE '%t%czowe przedszkole%'
    ORDER BY id
    LIMIT 1
    ON CONFLICT (nip) DO NOTHING;

    -- Re-attribute any unmatched WZ matching the new NIPs to the right client.
    UPDATE ibiznes_invoices ii
       SET client_id = cn.client_id
      FROM client_nips cn
     WHERE ii.client_id IS NULL
       AND ii.nip = cn.nip;

    -- One-shot cleanup: clear stale "custom" monthly goals for the current and
    -- future months so the +5% rule kicks in immediately. Past months keep
    -- their custom values so historical reporting stays intact.
    UPDATE sales_targets
       SET plan_obrotu_custom = FALSE,
           plan_obrotu = '0'
     WHERE plan_obrotu_custom = TRUE
       AND ((rok > EXTRACT(YEAR FROM CURRENT_DATE)::int)
         OR (rok = EXTRACT(YEAR FROM CURRENT_DATE)::int
             AND miesiac >= EXTRACT(MONTH FROM CURRENT_DATE)::int));

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
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS pelna_firma_nazwa TEXT;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS adres TEXT;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS kod_pocztowy TEXT;

    CREATE TABLE IF NOT EXISTS client_contacts (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      imie TEXT NOT NULL,
      rola TEXT,
      telefon TEXT,
      email TEXT,
      notatka TEXT,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS client_products (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      nazwa TEXT NOT NULL,
      notatka TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_data ON contacts(data);
    CREATE INDEX IF NOT EXISTS idx_contacts_opiekun_data ON contacts(opiekun, data);
    CREATE INDEX IF NOT EXISTS idx_contacts_client_id ON contacts(client_id);
    CREATE INDEX IF NOT EXISTS idx_client_sales_client_rok_mies ON client_sales(client_id, rok, miesiac);
    CREATE INDEX IF NOT EXISTS idx_client_sales_rok_mies ON client_sales(rok, miesiac);
    CREATE INDEX IF NOT EXISTS idx_client_sales_weekly_client ON client_sales_weekly(client_id, rok, miesiac, tydzien);
    CREATE INDEX IF NOT EXISTS idx_ibiznes_invoices_client ON ibiznes_invoices(client_id);
    CREATE INDEX IF NOT EXISTS idx_ibiznes_invoices_rok_mies ON ibiznes_invoices(rok, miesiac);
    -- Deduplicate existing rows (keep highest id per nr_r+source) before creating unique index.
    -- Required because onConflictDoUpdate in sync relies on this unique constraint;
    -- without it, every sync inserted new rows instead of updating existing ones.
    DELETE FROM ibiznes_invoices a
    USING ibiznes_invoices b
    WHERE a.nr_r = b.nr_r AND a.source = b.source AND a.id < b.id;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ibiznes_invoices_unique_key ON ibiznes_invoices(nr_r, source);
    CREATE INDEX IF NOT EXISTS idx_deliveries_data ON deliveries(data_dostawy);
    CREATE INDEX IF NOT EXISTS idx_daily_analysis_rok_mies ON daily_analysis(rok, miesiac);
    CREATE INDEX IF NOT EXISTS idx_sales_targets_rok_mies ON sales_targets(rok, miesiac);

    -- KSeF: faktury kosztowe pobierane z Krajowego Systemu e-Faktur.
    -- ksef_number jest unikalnym identyfikatorem nadanym przez KSeF i służy
    -- jako klucz idempotency (sync nigdy nie wstawi dwa razy tej samej FV).
    CREATE TABLE IF NOT EXISTS ksef_invoices (
      id SERIAL PRIMARY KEY,
      ksef_number TEXT NOT NULL UNIQUE,
      invoice_number TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      rok INTEGER NOT NULL,
      miesiac INTEGER NOT NULL,
      seller_nip TEXT NOT NULL,
      seller_name TEXT,
      buyer_nip TEXT,
      buyer_name TEXT,
      net_amount DECIMAL(14,2) NOT NULL,
      vat_amount DECIMAL(14,2),
      gross_amount DECIMAL(14,2),
      currency TEXT NOT NULL DEFAULT 'PLN',
      kategoria TEXT,
      kategoria_manual BOOLEAN NOT NULL DEFAULT FALSE,
      invoice_hash TEXT,
      synced_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ksef_invoices_rok_mies ON ksef_invoices(rok, miesiac);
    CREATE INDEX IF NOT EXISTS idx_ksef_invoices_seller_nip ON ksef_invoices(seller_nip);
    CREATE INDEX IF NOT EXISTS idx_ksef_invoices_kategoria ON ksef_invoices(kategoria);

    -- Mapowanie NIP dostawcy → kategoria (ręczne nadpisanie auto-kategoryzacji).
    CREATE TABLE IF NOT EXISTS ksef_supplier_categories (
      id SERIAL PRIMARY KEY,
      nip TEXT NOT NULL UNIQUE,
      nazwa TEXT,
      kategoria TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ksef_sync_log (
      id SERIAL PRIMARY KEY,
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'running',
      message TEXT,
      invoices_synced INTEGER DEFAULT 0,
      invoices_new INTEGER DEFAULT 0,
      trigger TEXT DEFAULT 'cron'
    );

    -- Cache sesji KSeF — jeden wiersz na NIP, trzyma accessToken/refreshToken
    -- żeby uniknąć pełnej procedury auth przy każdym żądaniu.
    CREATE TABLE IF NOT EXISTS ksef_token_cache (
      id SERIAL PRIMARY KEY,
      nip TEXT NOT NULL UNIQUE,
      environment TEXT NOT NULL,
      access_token TEXT,
      access_valid_until TIMESTAMP,
      refresh_token TEXT,
      refresh_valid_until TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("Database schema ensured.");
}
