import { pgTable, text, integer, boolean, decimal, timestamp, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  imie: text("imie").notNull(),
  rola: text("rola").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  klient: text("klient").notNull(),
  clientId: text("client_id").notNull().unique(),
  pelnaFirmaNazwa: text("pelna_firma_nazwa"),
  opiekun: text("opiekun").notNull(),
  segment: text("segment").notNull(),
  grupaMvp: text("grupa_mvp"),
  status: text("status").notNull().default("Aktywny"),
  aktywny: boolean("aktywny").notNull().default(true),
  telefon: text("telefon"),
  telefonDodatkowy: text("telefon_dodatkowy"),
  email: text("email"),
  emailDodatkowe: text("email_dodatkowe"),
  preferowanaFormaKontaktu: text("preferowana_forma_kontaktu"),
  zamowieniaGdzie: text("zamowienia_gdzie"),
  dniZamowien: text("dni_zamowien"),
  rytmKontaktu: text("rytm_kontaktu"),
  adres: text("adres"),
  miasto: text("miasto"),
  kodPocztowy: text("kod_pocztowy"),
  kraj: text("kraj"),
  notatki: text("notatki"),
  rabatProcent: decimal("rabat_procent"),
  warunkiPlatnosci: text("warunki_platnosci"),
  terminPlatnosciDni: integer("termin_platnosci_dni"),
  limitKredytowy: decimal("limit_kredytowy"),
  ubezpieczenieStatus: text("ubezpieczenie_status"),
  osobaKontaktowa: text("osoba_kontaktowa"),
  brakiZamowien: integer("braki_zamowien").notNull().default(0),
  przekazany: boolean("przekazany").notNull().default(false),
  nip: text("nip"),
  ibiznesAlias: text("ibiznes_alias"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientContacts = pgTable("client_contacts", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  imie: text("imie").notNull(),
  rola: text("rola"),
  telefon: text("telefon"),
  email: text("email"),
  notatka: text("notatka"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export const insertClientContactSchema = createInsertSchema(clientContacts).omit({ id: true, createdAt: true });
export type InsertClientContact = z.infer<typeof insertClientContactSchema>;
export type ClientContact = typeof clientContacts.$inferSelect;

export const clientProducts = pgTable("client_products", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  nazwa: text("nazwa").notNull(),
  notatka: text("notatka"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientProductSchema = createInsertSchema(clientProducts).omit({ id: true, createdAt: true });
export type InsertClientProduct = z.infer<typeof insertClientProductSchema>;
export type ClientProduct = typeof clientProducts.$inferSelect;

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  opiekun: text("opiekun").notNull(),
  data: text("data").notNull(),
  status: text("status").notNull().default("Do zrobienia"),
  kwota: decimal("kwota"),
  typ: text("typ").notNull().default("Cykliczny"),
  priorytet: text("priorytet").notNull().default("Normalny"),
  formaKontaktu: text("forma_kontaktu"),
  notatka: text("notatka"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true });
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export const deliveries = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  dataDostawy: text("data_dostawy").notNull(),
  lp: integer("lp"),
  clientId: integer("client_id").notNull(),
  kierowca: text("kierowca"),
  opiekun: text("opiekun"),
  auto: text("auto"),
  platnosc: text("platnosc"),
  uwagi: text("uwagi"),
  kilometry: decimal("kilometry"),
  wartoscNettoWz: decimal("wartosc_netto_wz"),
  winaSkalo: boolean("wina_skalo").default(false),
  akcjaWindykacja: text("akcja_windykacja").default("brak"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDeliverySchema = createInsertSchema(deliveries).omit({ id: true, createdAt: true });
export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
export type Delivery = typeof deliveries.$inferSelect;

export const drivers = pgTable("drivers", {
  id: serial("id").primaryKey(),
  imie: text("imie").notNull(),
});

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  nazwa: text("nazwa").notNull(),
});

export const clientSales = pgTable("client_sales", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  rok: integer("rok").notNull(),
  miesiac: integer("miesiac").notNull(),
  sprzedaz: decimal("sprzedaz"),
  koszt: decimal("koszt"),
  zysk: decimal("zysk"),
  marza: decimal("marza"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientSalesSchema = createInsertSchema(clientSales).omit({ id: true, createdAt: true });
export type InsertClientSales = z.infer<typeof insertClientSalesSchema>;
export type ClientSales = typeof clientSales.$inferSelect;

export const clientSalesWeekly = pgTable("client_sales_weekly", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  rok: integer("rok").notNull(),
  miesiac: integer("miesiac").notNull(),
  tydzien: integer("tydzien").notNull(),
  plan: decimal("plan"),
  realizacja: decimal("realizacja"),
  notatki: text("notatki"),
  status: text("status"),
  // TRUE only when an admin/handlowiec explicitly set this target via UI
  // (setClientPlanTarget / autoGeneratePlan / Excel import). Otherwise the
  // monthly cel for this client is derived automatically (prev month × 1.05),
  // so stale historic plan rows never block the auto rule.
  planUserSet: boolean("plan_user_set").notNull().default(false),
});

export const insertClientSalesWeeklySchema = createInsertSchema(clientSalesWeekly).omit({ id: true });
export type InsertClientSalesWeekly = z.infer<typeof insertClientSalesWeeklySchema>;
export type ClientSalesWeekly = typeof clientSalesWeekly.$inferSelect;

export const salesTargets = pgTable("sales_targets", {
  id: serial("id").primaryKey(),
  rok: integer("rok").notNull(),
  miesiac: integer("miesiac").notNull(),
  planObrotu: decimal("plan_obrotu"),
  wykonanieObrotu: decimal("wykonanie_obrotu"),
  // TRUE only when an admin explicitly set a custom goal in the plan UI.
  // Otherwise the monthly goal is derived automatically (prev month × 1.05).
  planObrotuCustom: boolean("plan_obrotu_custom").notNull().default(false),
});

export const insertSalesTargetSchema = createInsertSchema(salesTargets).omit({ id: true });
export type InsertSalesTarget = z.infer<typeof insertSalesTargetSchema>;
export type SalesTarget = typeof salesTargets.$inferSelect;

// iBiznes WZ keys (nip + alias + source) marked as "ignored" by an admin —
// these never become CRM clients and never count towards turnover totals.
// The sync skips matching invoices on insert and existing rows are deleted
// when the key is added.
export const ibiznesIgnored = pgTable("ibiznes_ignored", {
  id: serial("id").primaryKey(),
  nip: text("nip").notNull().default(""),
  alias: text("alias"),
  source: text("source").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
  note: text("note"),
});
export type IbizneIgnored = typeof ibiznesIgnored.$inferSelect;

export const salaries = pgTable("salaries", {
  id: serial("id").primaryKey(),
  osoba: text("osoba").notNull(),
  firma: text("firma").notNull(),
  dzial: text("dzial").notNull(),
  formaZatrudnienia: text("forma_zatrudnienia"),
  netto: decimal("netto"),
  brutto: decimal("brutto"),
  vat: decimal("vat"),
  kosztPracodawcy: decimal("koszt_pracodawcy"),
  aktywnyMiesiace: jsonb("aktywny_miesiace"),
});

export const insertSalarySchema = createInsertSchema(salaries).omit({ id: true });
export type InsertSalary = z.infer<typeof insertSalarySchema>;
export type Salary = typeof salaries.$inferSelect;

export const costs = pgTable("costs", {
  id: serial("id").primaryKey(),
  nazwa: text("nazwa").notNull(),
  firma: text("firma"),
  dzial: text("dzial"),
  rodzaj: text("rodzaj"),
  kategoria: text("kategoria"),
  netto: decimal("netto"),
  koszt: decimal("koszt"),
  notatka: text("notatka"),
  aktywnyMiesiace: jsonb("aktywny_miesiace"),
});

export const insertCostSchema = createInsertSchema(costs).omit({ id: true });
export type InsertCost = z.infer<typeof insertCostSchema>;
export type Cost = typeof costs.$inferSelect;

export const fleet = pgTable("fleet", {
  id: serial("id").primaryKey(),
  opis: text("opis").notNull(),
  firma: text("firma"),
  dzial: text("dzial"),
  rodzaj: text("rodzaj"),
  netto: decimal("netto"),
  koszt: decimal("koszt"),
  aktywnyMiesiace: jsonb("aktywny_miesiace"),
});

export const insertFleetSchema = createInsertSchema(fleet).omit({ id: true });
export type InsertFleet = z.infer<typeof insertFleetSchema>;
export type Fleet = typeof fleet.$inferSelect;

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  tytul: text("tytul").notNull(),
  clientId: integer("client_id"),
  autor: text("autor").notNull(),
  kategoria: text("kategoria").notNull().default("Inna"),
  tagi: text("tagi"),
  tresc: text("tresc"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNoteSchema = createInsertSchema(notes).omit({ id: true, createdAt: true });
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;

export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  tytul: text("tytul").notNull(),
  opis: text("opis"),
  data: text("data").notNull(),
  godzina: text("godzina"),
  godzinaKoniec: text("godzina_koniec"),
  clientId: integer("client_id"),
  noteId: integer("note_id"),
  typ: text("typ").notNull().default("Spotkanie"),
  autor: text("autor").notNull(),
  status: text("status").notNull().default("Zaplanowane"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({ id: true, createdAt: true });
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;

export const dailyAnalysis = pgTable("daily_analysis", {
  id: serial("id").primaryKey(),
  rok: integer("rok").notNull(),
  miesiac: integer("miesiac").notNull(),
  dzien: integer("dzien").notNull(),
  sprzedaz: decimal("sprzedaz"),
  dniRobocze: integer("dni_robocze").notNull().default(21),
});

export const insertDailyAnalysisSchema = createInsertSchema(dailyAnalysis).omit({ id: true });
export type InsertDailyAnalysis = z.infer<typeof insertDailyAnalysisSchema>;
export type DailyAnalysis = typeof dailyAnalysis.$inferSelect;

export const salesHistory = pgTable("sales_history", {
  id: serial("id").primaryKey(),
  rok: integer("rok").notNull(),
  miesiac: integer("miesiac").notNull(),
  wartosc: decimal("wartosc").notNull(),
});

export const insertSalesHistorySchema = createInsertSchema(salesHistory).omit({ id: true });
export type InsertSalesHistory = z.infer<typeof insertSalesHistorySchema>;
export type SalesHistory = typeof salesHistory.$inferSelect;

export const ibiznesInvoices = pgTable("ibiznes_invoices", {
  id: serial("id").primaryKey(),
  nrR: text("nr_r").notNull(),
  source: text("source").notNull(), // 'sp_zoo' | 'firma'
  clientId: integer("client_id"),
  nip: text("nip").notNull(),
  alias: text("alias"),
  dataWyst: text("data_wyst").notNull(), // "yyyy-MM-dd"
  rok: integer("rok").notNull(),
  miesiac: integer("miesiac").notNull(),
  koszt: decimal("koszt"),
  // `koszt_zakupu` = actual purchase cost from iBiznes (SUM(il * Cz)).
  // The legacy `koszt` column actually stores net sales value (SUM(il * CN))
  // — kept for backwards compatibility, renamed in naming only.
  kosztZakupu: decimal("koszt_zakupu"),
  syncedAt: timestamp("synced_at").defaultNow(),
});

export const insertIbiznesInvoiceSchema = createInsertSchema(ibiznesInvoices).omit({ id: true, syncedAt: true });
export type InsertIbiznesInvoice = z.infer<typeof insertIbiznesInvoiceSchema>;
export type IbiznesInvoice = typeof ibiznesInvoices.$inferSelect;

export const ibizneSyncLog = pgTable("ibiznes_sync_log", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  status: text("status").notNull().default("running"), // 'running' | 'success' | 'error'
  message: text("message"),
  invoicesSynced: integer("invoices_synced").default(0),
  clientsMatched: integer("clients_matched").default(0),
  clientsUnmatched: integer("clients_unmatched").default(0),
  trigger: text("trigger").default("cron"), // 'cron' | 'manual'
});

export const insertIbizneSyncLogSchema = createInsertSchema(ibizneSyncLog).omit({ id: true });
export type InsertIbizneSyncLog = z.infer<typeof insertIbizneSyncLogSchema>;
export type IbizneSyncLog = typeof ibizneSyncLog.$inferSelect;
