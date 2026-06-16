import { db } from "./db";
import { eq, and, gte, lte, sql, like, or, desc, asc, inArray } from "drizzle-orm";
import { countPolishWorkdays } from "../shared/polishHolidays";
import {
  users, clients, contacts, deliveries, drivers, vehicles,
  clientSales, clientSalesWeekly, salesTargets, salaries, costs,
  fleet, notes, meetings, salesHistory, dailyAnalysis, clientContacts, clientProducts,
  clientNips, ksefInvoices, manualExpenses,
  type InsertManualExpense, type ManualExpense,
  type InsertUser, type User,
  type InsertClient, type Client,
  type InsertContact, type Contact,
  type InsertDelivery, type Delivery,
  type InsertNote, type Note,
  type InsertMeeting, type Meeting,
  type InsertSalary, type InsertCost, type InsertFleet,
  type Cost, type DailyAnalysis,
  type ClientContact, type InsertClientContact,
  type ClientProduct, type InsertClientProduct,
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getClients(opiekun?: string): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  getClientByNameOrClientId(name: string, clientId?: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, data: Partial<Client>): Promise<void>;
  deleteClient(id: number): Promise<void>;
  getNextClientId(): Promise<string>;

  getClientContacts(clientId: number): Promise<ClientContact[]>;
  createClientContact(contact: InsertClientContact): Promise<ClientContact>;
  upsertClientContactByName(clientId: number, contact: { imie: string; rola?: string; telefon?: string; email?: string }): Promise<void>;
  upsertClientContactByEmail(clientId: number, email: string, rola?: string): Promise<void>;
  updateClientContact(id: number, data: Partial<ClientContact>): Promise<void>;
  deleteClientContact(id: number): Promise<void>;

  getClientProducts(clientId: number): Promise<ClientProduct[]>;
  createClientProduct(product: InsertClientProduct): Promise<ClientProduct>;
  upsertClientProducts(clientId: number, names: string[]): Promise<void>;
  updateClientProduct(id: number, data: Partial<ClientProduct>): Promise<void>;
  deleteClientProduct(id: number): Promise<void>;

  getContacts(from?: string, to?: string, opiekun?: string): Promise<any[]>;
  getContactsForToday(opiekun?: string): Promise<any[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, data: Partial<Contact>): Promise<void>;
  getContact(id: number): Promise<Contact | undefined>;
  deleteUnfinishedContacts(from: string, to: string, opiekun?: string): Promise<void>;

  getDeliveries(date: string): Promise<any[]>;
  createDelivery(delivery: InsertDelivery): Promise<Delivery>;
  updateDelivery(id: number, data: Partial<Delivery>): Promise<void>;

  getDrivers(): Promise<any[]>;
  createDriver(imie: string): Promise<any>;
  getVehicles(): Promise<any[]>;
  createVehicle(nazwa: string): Promise<any>;

  getSalesAnalysis(rok: number, miesiac: number): Promise<any>;
  getSalesDashboard(): Promise<any>;
  getFinanceData(miesiac?: number): Promise<any>;
  createCost(data: InsertCost): Promise<Cost>;
  updateCost(id: number, data: Partial<InsertCost>): Promise<Cost>;
  deleteCost(id: number): Promise<void>;
  getManualExpenses(rok?: number, miesiac?: number): Promise<ManualExpense[]>;
  createManualExpense(data: InsertManualExpense): Promise<ManualExpense>;
  updateManualExpense(id: number, data: Partial<InsertManualExpense>): Promise<ManualExpense>;
  deleteManualExpense(id: number): Promise<void>;
  getMySales(opiekun: string): Promise<any>;
  getPlanData(rok: number, miesiac: number, opiekun?: string): Promise<any>;
  getAvailablePlanMonths(): Promise<Array<{rok: number; miesiac: number}>>;
  updateWeeklyPlan(id: number, realizacja: number): Promise<void>;
  updateWeeklyNotatki(clientId: number, rok: number, miesiac: number, notatki: string): Promise<void>;

  getNotes(autor?: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: number, data: Partial<InsertNote>): Promise<Note>;
  deleteNote(id: number): Promise<void>;

  getMeetings(from?: string, to?: string): Promise<Meeting[]>;
  getMeeting(id: number): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: number, data: Partial<InsertMeeting>): Promise<Meeting>;
  deleteMeeting(id: number): Promise<void>;

  getDashboardStats(opiekun?: string, rola?: string): Promise<any>;

  importClientSales(rok: number, miesiac: number, data: Array<{klient: string; sprzedaz: number; koszt: number; zysk: number; marza: number}>): Promise<{imported: number; notFound: string[]}>;
  deleteClientSalesForMonth(rok: number, miesiac: number): Promise<number>;
  importMonthlyPlan(rok: number, miesiac: number, data: Array<{klient: string; cel: number}>): Promise<{imported: number; notFound: string[]}>;
  deleteMonthlyPlan(rok: number, miesiac: number): Promise<number>;
  updateSalesTarget(id: number, data: {planObrotu?: number; wykonanieObrotu?: number}): Promise<any>;
  updateSalesTargetsBulk(rok: number, targets: Array<{miesiac: number; planObrotu: number}>): Promise<{updated: number}>;
  syncSalesTargetExecution(rok: number, miesiac: number): Promise<{total: number}>;
  syncSalesTargetsForYear(rok: number): Promise<{updated: number}>;
  autoGeneratePlan(rok: number, miesiac: number, wspolczynnik: number): Promise<{generated: number; skipped: number}>;

  getDailyAnalysis(rok: number, miesiac: number): Promise<DailyAnalysis[]>;
  getDniRobocze(rok: number, miesiac: number): Promise<number>;
  upsertDailyAnalysis(rok: number, miesiac: number, dzien: number, sprzedaz: string | null): Promise<DailyAnalysis>;
  updateDniRobocze(rok: number, miesiac: number, dniRobocze: number): Promise<void>;
  getMonthlyFixedCosts(miesiac: number): Promise<number>;
  getCostBreakdownForMonth(miesiac: number, rok?: number): Promise<{
    departments: Array<{ name: string; total: number; categories: Array<{ id: number; name: string; total: number; typ: string }> }>;
    vatTotal: number;
    fixedTotal: number;
    ksefTotal: number;
    grandTotal: number;
    source: "manual";
  }>;
  importDailySalesFromContacts(rok: number, miesiac: number): Promise<number>;

  importWzData(rok: number, miesiac: number, data: Array<{clientId: number; sprzedaz: number}>): Promise<void>;
  getPlanRealization(rok: number, miesiac: number, opiekun?: string): Promise<any>;
  setPlanMonthTarget(rok: number, miesiac: number, planObrotu: number | null): Promise<void>;
  setClientPlanTarget(rok: number, miesiac: number, clientId: number, cel: number): Promise<void>;
  verifyPlanData(rok: number, miesiac: number): Promise<any>;

  importFinanceData(miesiac: number, salariesData: Array<any>, costsData: Array<any>, fleetData: Array<any>, replaceMonth: boolean): Promise<{salaries: number; costs: number; fleet: number}>;
  importVATCosts(miesiac: number, mKey: string, costsData: Array<any>): Promise<{imported: number}>;
  importKsefTemplate(fileBuffer: Buffer, opts: { replace: boolean }): Promise<{
    imported: number;
    skipped: number;
    total: number;
    byKategoria: Record<string, { count: number; sum: number }>;
    skippedDetails: Array<{ reason: string; klient: string; nrFaktury: string; akcja: string }>;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getClients(opiekun?: string): Promise<Client[]> {
    if (opiekun) {
      return db.select().from(clients).where(eq(clients.opiekun, opiekun)).orderBy(asc(clients.klient));
    }
    return db.select().from(clients).orderBy(asc(clients.klient));
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByNameOrClientId(name: string, clientId?: string): Promise<Client | undefined> {
    let conditions: any[] = [];
    if (clientId) {
      conditions.push(or(eq(clients.klient, name), eq(clients.clientId, clientId)));
    } else {
      conditions.push(eq(clients.klient, name));
    }
    const [client] = await db.select().from(clients).where(conditions[0]);
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [created] = await db.insert(clients).values(client).returning();
    return created;
  }

  async updateClient(id: number, data: Partial<Client>): Promise<void> {
    await db.update(clients).set(data).where(eq(clients.id, id));
  }

  async deleteClient(id: number): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getNextClientId(): Promise<string> {
    const allClients = await db.select({ clientId: clients.clientId }).from(clients);
    let maxNum = 0;
    for (const c of allClients) {
      const match = c.clientId?.match(/^C(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const next = maxNum + 1;
    return `C${String(next).padStart(3, "0")}`;
  }

  async getClientContacts(clientId: number): Promise<ClientContact[]> {
    return db
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.clientId, clientId))
      .orderBy(desc(clientContacts.isPrimary), asc(clientContacts.createdAt));
  }

  async createClientContact(contact: InsertClientContact): Promise<ClientContact> {
    const [created] = await db.insert(clientContacts).values(contact).returning();
    return created;
  }

  async upsertClientContactByName(
    clientId: number,
    contact: { imie: string; rola?: string; telefon?: string; email?: string }
  ): Promise<void> {
    const existing = await db
      .select({ id: clientContacts.id })
      .from(clientContacts)
      .where(and(
        eq(clientContacts.clientId, clientId),
        sql`LOWER(${clientContacts.imie}) = LOWER(${contact.imie})`
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update only empty fields
      const updates: any = {};
      const cur = await db.select().from(clientContacts).where(eq(clientContacts.id, existing[0].id)).limit(1);
      if (cur[0]) {
        if (contact.rola && !cur[0].rola) updates.rola = contact.rola;
        if (contact.telefon && !cur[0].telefon) updates.telefon = contact.telefon;
        if (contact.email && !cur[0].email) updates.email = contact.email;
        if (Object.keys(updates).length > 0) {
          await db.update(clientContacts).set(updates).where(eq(clientContacts.id, existing[0].id));
        }
      }
    } else {
      await db.insert(clientContacts).values({ clientId, ...contact, isPrimary: false });
    }
  }

  async upsertClientContactByEmail(clientId: number, email: string, rola?: string): Promise<void> {
    const existing = await db
      .select({ id: clientContacts.id })
      .from(clientContacts)
      .where(and(
        eq(clientContacts.clientId, clientId),
        sql`LOWER(${clientContacts.email}) = LOWER(${email})`
      ))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(clientContacts).values({
        clientId,
        imie: email,
        rola: rola || "Email kontaktowy",
        email,
        isPrimary: false,
      });
    }
  }

  async updateClientContact(id: number, data: Partial<ClientContact>): Promise<void> {
    await db.update(clientContacts).set(data).where(eq(clientContacts.id, id));
  }

  async deleteClientContact(id: number): Promise<void> {
    await db.delete(clientContacts).where(eq(clientContacts.id, id));
  }

  async getClientProducts(clientId: number): Promise<ClientProduct[]> {
    return db
      .select()
      .from(clientProducts)
      .where(eq(clientProducts.clientId, clientId))
      .orderBy(asc(clientProducts.createdAt));
  }

  async createClientProduct(product: InsertClientProduct): Promise<ClientProduct> {
    const [created] = await db.insert(clientProducts).values(product).returning();
    return created;
  }

  async upsertClientProducts(clientId: number, names: string[]): Promise<void> {
    const existing = await db
      .select({ nazwa: clientProducts.nazwa })
      .from(clientProducts)
      .where(eq(clientProducts.clientId, clientId));
    const existingNames = new Set(existing.map(e => e.nazwa.trim().toLowerCase()));
    const toInsert = names
      .map(n => n.trim())
      .filter(n => n && !existingNames.has(n.toLowerCase()));
    if (toInsert.length > 0) {
      await db.insert(clientProducts).values(toInsert.map(nazwa => ({ clientId, nazwa })));
    }
  }

  async updateClientProduct(id: number, data: Partial<ClientProduct>): Promise<void> {
    await db.update(clientProducts).set(data).where(eq(clientProducts.id, id));
  }

  async deleteClientProduct(id: number): Promise<void> {
    await db.delete(clientProducts).where(eq(clientProducts.id, id));
  }

  async getContacts(from?: string, to?: string, opiekun?: string): Promise<any[]> {
    let conditions: any[] = [];
    if (from) conditions.push(gte(contacts.data, from));
    if (to) conditions.push(lte(contacts.data, to));
    if (opiekun) conditions.push(eq(contacts.opiekun, opiekun));

    const result = await db
      .select({
        id: contacts.id,
        clientId: contacts.clientId,
        opiekun: contacts.opiekun,
        data: contacts.data,
        status: contacts.status,
        kwota: contacts.kwota,
        typ: contacts.typ,
        priorytet: contacts.priorytet,
        formaKontaktu: contacts.formaKontaktu,
        notatka: contacts.notatka,
        clientName: clients.klient,
        brakiZamowien: clients.brakiZamowien,
        preferowanaFormaKontaktu: clients.preferowanaFormaKontaktu,
      })
      .from(contacts)
      .leftJoin(clients, eq(contacts.clientId, clients.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(contacts.data));

    return result;
  }

  async getContactsForToday(opiekun?: string): Promise<any[]> {
    const today = new Date().toISOString().split("T")[0];
    return this.getContacts(today, today, opiekun);
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [created] = await db.insert(contacts).values(contact).returning();
    return created;
  }

  async updateContact(id: number, data: Partial<Contact>): Promise<void> {
    await db.update(contacts).set(data).where(eq(contacts.id, id));
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }

  async deleteUnfinishedContacts(from: string, to: string, opiekun?: string): Promise<void> {
    const conditions = [
      eq(contacts.status, "Do zrobienia"),
      gte(contacts.data, from),
      lte(contacts.data, to),
    ];
    if (opiekun) {
      conditions.push(eq(contacts.opiekun, opiekun));
    }
    await db.delete(contacts).where(and(...conditions));
  }

  async getDeliveries(date: string): Promise<any[]> {
    const result = await db
      .select({
        id: deliveries.id,
        dataDostawy: deliveries.dataDostawy,
        lp: deliveries.lp,
        clientId: deliveries.clientId,
        kierowca: deliveries.kierowca,
        opiekun: deliveries.opiekun,
        auto: deliveries.auto,
        platnosc: deliveries.platnosc,
        uwagi: deliveries.uwagi,
        kilometry: deliveries.kilometry,
        wartoscNettoWz: deliveries.wartoscNettoWz,
        winaSkalo: deliveries.winaSkalo,
        akcjaWindykacja: deliveries.akcjaWindykacja,
        clientName: clients.klient,
      })
      .from(deliveries)
      .leftJoin(clients, eq(deliveries.clientId, clients.id))
      .where(eq(deliveries.dataDostawy, date))
      .orderBy(asc(deliveries.lp));

    return result;
  }

  async createDelivery(delivery: InsertDelivery): Promise<Delivery> {
    const [created] = await db.insert(deliveries).values(delivery).returning();
    return created;
  }

  async updateDelivery(id: number, data: Partial<Delivery>): Promise<void> {
    await db.update(deliveries).set(data).where(eq(deliveries.id, id));
  }

  async getDrivers(): Promise<any[]> {
    return db.select().from(drivers).orderBy(asc(drivers.imie));
  }

  async createDriver(imie: string): Promise<any> {
    const [created] = await db.insert(drivers).values({ imie }).returning();
    return created;
  }

  async getVehicles(): Promise<any[]> {
    return db.select().from(vehicles).orderBy(asc(vehicles.nazwa));
  }

  async createVehicle(nazwa: string): Promise<any> {
    const [created] = await db.insert(vehicles).values({ nazwa }).returning();
    return created;
  }

  async getSalesAnalysis(rok: number, miesiac: number): Promise<any> {
    const prevMiesiac = miesiac === 1 ? 12 : miesiac - 1;
    const prevRok = miesiac === 1 ? rok - 1 : rok;

    // Compute scaling factor for prev-month comparison:
    // If current month is still in progress, prev-month values are scaled down
    // to match the same number of business days that have elapsed so far.
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    const isCurrentMonth = rok === nowYear && miesiac === nowMonth;

    const daysInMonth = new Date(rok, miesiac, 0).getDate();
    const dniRoboczeMiesiac = countPolishWorkdays(rok, miesiac, daysInMonth);
    const dniRoboczeMiniete = isCurrentMonth
      ? countPolishWorkdays(rok, miesiac, now.getDate())
      : dniRoboczeMiesiac;

    const daysInPrevMonth = new Date(prevRok, prevMiesiac, 0).getDate();
    const prevTotalWorkdays = countPolishWorkdays(prevRok, prevMiesiac, daysInPrevMonth);
    // For current month: scale prev so we compare the same number of business days.
    // Cap at prev month's total workdays (e.g. if Feb only has 20 wd and April already passed 20).
    const prevCompareDays = isCurrentMonth
      ? Math.min(dniRoboczeMiniete, prevTotalWorkdays)
      : prevTotalWorkdays;
    const prevScale = prevTotalWorkdays > 0 ? prevCompareDays / prevTotalWorkdays : 1;

    const salesData = await db
      .select({
        clientId: clientSales.clientId,
        sprzedaz: clientSales.sprzedaz,
        koszt: clientSales.koszt,
        zysk: clientSales.zysk,
        marza: clientSales.marza,
      })
      .from(clientSales)
      .where(and(eq(clientSales.rok, rok), eq(clientSales.miesiac, miesiac)));

    const prevSalesData = await db
      .select({
        clientId: clientSales.clientId,
        sprzedaz: clientSales.sprzedaz,
        koszt: clientSales.koszt,
        zysk: clientSales.zysk,
        marza: clientSales.marza,
      })
      .from(clientSales)
      .where(and(eq(clientSales.rok, prevRok), eq(clientSales.miesiac, prevMiesiac)));

    const prevSalesMap = new Map<number, { sprzedaz: number; koszt: number; zysk: number; marza: number }>();
    for (const ps of prevSalesData) {
      prevSalesMap.set(ps.clientId, {
        sprzedaz: Number(ps.sprzedaz || 0) * prevScale,
        koszt: Number(ps.koszt || 0) * prevScale,
        zysk: Number(ps.zysk || 0) * prevScale,
        marza: Number(ps.marza || 0),
      });
    }

    const allClients = await db.select().from(clients);
    const salesMap = new Map<number, typeof salesData[0]>();
    for (const s of salesData) {
      salesMap.set(s.clientId, s);
    }

    const grupyNames = ["Gosia Premium", "Magda Premium", "Magda Standard", "Weryfikacja Zostaną", "Weryfikacja Odejdą", "Inne"];

    function matchGrupa(grupaMvp: string | null): string {
      const g = grupaMvp || "Inne";
      if (g.includes("Gosia") && g.includes("Premium")) return "Gosia Premium";
      if (g.includes("Magda") && g.includes("Premium")) return "Magda Premium";
      if (g.includes("Magda") && g.includes("Standard")) return "Magda Standard";
      if (g.includes("Zostaną") || g.includes("zostana") || g.includes("zostan")) return "Weryfikacja Zostaną";
      if (g.includes("Odejdą") || g.includes("odejda") || g.includes("odejd")) return "Weryfikacja Odejdą";
      return "Inne";
    }

    type GroupData = {
      klientow: number;
      aktywnych: number;
      sprzedaz: number;
      koszt: number;
      zysk: number;
      prevSprzedaz: number;
      prevKoszt: number;
      prevZysk: number;
      klienci: Array<{
        id: number;
        klient: string;
        rabat: number | null;
        sprzedaz: number;
        koszt: number;
        zysk: number;
        marza: number;
        prevSprzedaz: number;
        zmiana: number | null;
      }>;
    };

    const grupyMap: Record<string, GroupData> = {};
    for (const name of grupyNames) {
      grupyMap[name] = { klientow: 0, aktywnych: 0, sprzedaz: 0, koszt: 0, zysk: 0, prevSprzedaz: 0, prevKoszt: 0, prevZysk: 0, klienci: [] };
    }

    for (const client of allClients) {
      const matchKey = matchGrupa(client.grupaMvp);
      if (!grupyMap[matchKey]) grupyMap[matchKey] = { klientow: 0, aktywnych: 0, sprzedaz: 0, koszt: 0, zysk: 0, prevSprzedaz: 0, prevKoszt: 0, prevZysk: 0, klienci: [] };

      const sale = salesMap.get(client.id);
      const sprzedaz = sale ? Number(sale.sprzedaz || 0) : 0;
      const koszt = sale ? Number(sale.koszt || 0) : 0;
      const zysk = sale ? Number(sale.zysk || 0) : 0;
      const marza = sale ? Number(sale.marza || 0) : 0;
      const prev = prevSalesMap.get(client.id) || { sprzedaz: 0, koszt: 0, zysk: 0, marza: 0 };
      const prevSp = prev.sprzedaz;

      grupyMap[matchKey].klientow++;
      if (sprzedaz > 0) grupyMap[matchKey].aktywnych++;
      grupyMap[matchKey].sprzedaz += sprzedaz;
      grupyMap[matchKey].koszt += koszt;
      grupyMap[matchKey].zysk += zysk;
      grupyMap[matchKey].prevSprzedaz += prevSp;
      grupyMap[matchKey].prevKoszt += prev.koszt;
      grupyMap[matchKey].prevZysk += prev.zysk;

      const zmiana = prevSp > 0 ? ((sprzedaz - prevSp) / prevSp * 100) : (sprzedaz > 0 ? 100 : null);
      grupyMap[matchKey].klienci.push({
        id: client.id,
        klient: client.klient,
        rabat: client.rabatProcent ? Number(client.rabatProcent) : null,
        sprzedaz,
        koszt,
        zysk,
        marza,
        prevSprzedaz: prevSp,
        zmiana,
      });
    }

    const groups = grupyNames
      .filter(name => grupyMap[name] && grupyMap[name].klientow > 0)
      .map(name => {
        const v = grupyMap[name];
        const zmiana = v.prevSprzedaz > 0 ? ((v.sprzedaz - v.prevSprzedaz) / v.prevSprzedaz * 100) : 0;
        v.klienci.sort((a, b) => b.sprzedaz - a.sprzedaz);
        return {
          grupa: name,
          klientow: v.klientow,
          aktywnych: v.aktywnych,
          sprzedaz: v.sprzedaz,
          koszt: v.koszt,
          zysk: v.zysk,
          marza: v.sprzedaz > 0 ? (v.zysk / v.sprzedaz * 100) : 0,
          prevSprzedaz: v.prevSprzedaz,
          prevKoszt: v.prevKoszt,
          prevZysk: v.prevZysk,
          zmiana,
          klienci: v.klienci,
        };
      });

    groups.sort((a, b) => b.sprzedaz - a.sprzedaz);

    const prevTotalSales = groups.reduce((s, g) => s + g.prevSprzedaz, 0);
    const prevTotalCost = groups.reduce((s, g) => s + g.prevKoszt, 0);
    const prevTotalProfit = groups.reduce((s, g) => s + g.prevZysk, 0);
    const prevTotalMarza = prevTotalSales > 0 ? (prevTotalProfit / prevTotalSales * 100) : 0;

    // Unmatched sales: WZ from iBiznes without a matching client in CRM
    // (unknown NIP or missing Alias mapping). Shown as a separate metric so user can
    // quickly see how much revenue is "orphaned" from client-level analysis.
    const unmatchedRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(CAST(koszt AS NUMERIC)), 0) AS total,
        COALESCE(SUM(CAST(COALESCE(koszt_zakupu, 0) AS NUMERIC)), 0) AS total_cost,
        COUNT(*) AS count
      FROM ibiznes_invoices
      WHERE rok = ${rok} AND miesiac = ${miesiac} AND client_id IS NULL
    `);
    const unmatchedSales = Number((unmatchedRows.rows[0] as any)?.total || 0);
    const unmatchedCost = Number((unmatchedRows.rows[0] as any)?.total_cost || 0);
    const unmatchedCount = Number((unmatchedRows.rows[0] as any)?.count || 0);

    // Previous month unmatched (for scaled comparison)
    const unmatchedPrevRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(CAST(koszt AS NUMERIC)), 0) AS total,
        COALESCE(SUM(CAST(COALESCE(koszt_zakupu, 0) AS NUMERIC)), 0) AS total_cost
      FROM ibiznes_invoices
      WHERE rok = ${prevRok} AND miesiac = ${prevMiesiac} AND client_id IS NULL
    `);
    const unmatchedPrevSales = Number((unmatchedPrevRows.rows[0] as any)?.total || 0) * prevScale;
    const unmatchedPrevCost = Number((unmatchedPrevRows.rows[0] as any)?.total_cost || 0) * prevScale;

    return {
      groups,
      prevMiesiac,
      prevRok,
      prevTotalSales,
      prevTotalCost,
      prevTotalProfit,
      prevTotalMarza,
      unmatchedSales,
      unmatchedCost,
      unmatchedCount,
      unmatchedPrevSales,
      unmatchedPrevCost,
      dniRoboczeMiesiac,
      dniRoboczeMiniete,
      prevCompareDays,
      prevTotalWorkdays,
      isCurrentMonth,
    };
  }

  async getSalesDashboard(): Promise<any> {
    const currentYear = new Date().getFullYear();
    const prevYear = currentYear - 1;

    // --- All targets for this year (for custom-goal detection) ----------------
    const targets = await db
      .select()
      .from(salesTargets)
      .where(eq(salesTargets.rok, currentYear))
      .orderBy(asc(salesTargets.miesiac));
    const targetByMonth = new Map<number, { planObrotu: number; planObrotuCustom: boolean }>();
    for (const t of targets) {
      targetByMonth.set(t.miesiac, {
        planObrotu: Number(t.planObrotu || 0),
        planObrotuCustom: Boolean(t.planObrotuCustom),
      });
    }

    // --- Sum realized sales per month (SAME logic as Plan miesiąca) -----------
    // matched (client_sales) + unmatched WZ (ibiznes_invoices where client_id IS NULL)
    const matchedThisYear = await db.execute(sql`
      SELECT miesiac, COALESCE(SUM(CAST(sprzedaz AS NUMERIC)), 0) AS total
      FROM client_sales
      WHERE rok = ${currentYear}
      GROUP BY miesiac
    `);
    const matchedMap = new Map<number, number>();
    for (const r of matchedThisYear.rows as any[]) {
      matchedMap.set(Number(r.miesiac), Number(r.total || 0));
    }
    const unmatchedThisYear = await db.execute(sql`
      SELECT miesiac, COALESCE(SUM(CAST(koszt AS NUMERIC)), 0) AS total
      FROM ibiznes_invoices
      WHERE rok = ${currentYear} AND client_id IS NULL
      GROUP BY miesiac
    `);
    const unmatchedMap = new Map<number, number>();
    for (const r of unmatchedThisYear.rows as any[]) {
      unmatchedMap.set(Number(r.miesiac), Number(r.total || 0));
    }

    // December of the previous year — needed for January's default (+5%).
    const matchedPrevDec = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(sprzedaz AS NUMERIC)), 0) AS total
      FROM client_sales
      WHERE rok = ${prevYear} AND miesiac = 12
    `);
    const unmatchedPrevDec = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(koszt AS NUMERIC)), 0) AS total
      FROM ibiznes_invoices
      WHERE rok = ${prevYear} AND miesiac = 12 AND client_id IS NULL
    `);
    const prevDecRealizacja =
      Number((matchedPrevDec.rows[0] as any)?.total || 0) +
      Number((unmatchedPrevDec.rows[0] as any)?.total || 0);

    // --- Build final plan + wykonanie for every month of the year ------------
    // wykonanie[m] = matched[m] + unmatched[m]
    // plan[m]:
    //   - if targets[m].planObrotuCustom && > 0  → custom value
    //   - else                                   → wykonanie[m-1] × 1.05  (or prevDec × 1.05 for Jan)
    const plan2026: Array<{
      miesiac: number;
      planObrotu: number;
      planObrotuCustom: boolean;
      planObrotuRaw: number;
      wykonanieObrotu: number;
    }> = [];

    for (let m = 1; m <= 12; m++) {
      const wykonanie = Math.round(
        (matchedMap.get(m) || 0) + (unmatchedMap.get(m) || 0)
      );
      const prevRealizacja = m === 1 ? prevDecRealizacja : (matchedMap.get(m - 1) || 0) + (unmatchedMap.get(m - 1) || 0);
      const autoPlan = Math.round(prevRealizacja * 1.05);
      const t = targetByMonth.get(m) || { planObrotu: 0, planObrotuCustom: false };
      const plan = t.planObrotuCustom && t.planObrotu > 0 ? Math.round(t.planObrotu) : autoPlan;
      plan2026.push({
        miesiac: m,
        planObrotu: plan,
        planObrotuCustom: t.planObrotuCustom && t.planObrotu > 0,
        planObrotuRaw: Math.round(t.planObrotu || 0),
        wykonanieObrotu: wykonanie,
      });
    }

    // --- History (unchanged) --------------------------------------------------
    const historyData = await db
      .select()
      .from(salesHistory)
      .orderBy(asc(salesHistory.rok), asc(salesHistory.miesiac));
    const historyByYear: Record<number, any[]> = {};
    for (const h of historyData) {
      if (!historyByYear[h.rok]) historyByYear[h.rok] = [];
      historyByYear[h.rok].push(h);
    }
    const history = Object.entries(historyByYear).map(([rok, months]) => ({
      rok: Number(rok),
      months: months.map((m) => ({ miesiac: m.miesiac, wartosc: Number(m.wartosc) })),
    }));

    return { plan2026, history };
  }

  async getFinanceData(miesiac?: number): Promise<any> {
    const MONTH_KEYS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paz", "lis", "gru"];
    const mKey = miesiac ? MONTH_KEYS[miesiac - 1] : null;

    const salariesData = await db.select().from(salaries);
    const costsData = await db.select().from(costs);
    const fleetData = await db.select().from(fleet);

    const filterByMonth = (items: any[]) => {
      if (!mKey) return items;
      return items.filter((item) => {
        const am = item.aktywnyMiesiace as Record<string, boolean> | null;
        if (!am) return true;
        return am[mKey] === true;
      });
    };

    return {
      salaries: filterByMonth(salariesData),
      costs: filterByMonth(costsData),
      fleet: filterByMonth(fleetData),
    };
  }

  async createCost(data: InsertCost): Promise<Cost> {
    const [cost] = await db.insert(costs).values(data).returning();
    return cost;
  }

  async updateCost(id: number, data: Partial<InsertCost>): Promise<Cost> {
    const [cost] = await db.update(costs).set(data).where(eq(costs.id, id)).returning();
    return cost;
  }

  async deleteCost(id: number): Promise<void> {
    await db.delete(costs).where(eq(costs.id, id));
  }

  async getMySales(opiekun: string): Promise<any> {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const myClients = await db.select().from(clients).where(eq(clients.opiekun, opiekun));
    const clientIds = myClients.map(c => c.id);

    let monthSales = 0;
    let prevMonthSales = 0;

    if (clientIds.length > 0) {
      const currentSales = await db.select().from(clientSales)
        .where(and(eq(clientSales.rok, currentYear), eq(clientSales.miesiac, currentMonth)));
      monthSales = currentSales
        .filter(s => clientIds.includes(s.clientId))
        .reduce((sum, s) => sum + Number(s.sprzedaz || 0), 0);

      const prevSales = await db.select().from(clientSales)
        .where(and(eq(clientSales.rok, prevYear), eq(clientSales.miesiac, prevMonth)));
      prevMonthSales = prevSales
        .filter(s => clientIds.includes(s.clientId))
        .reduce((sum, s) => sum + Number(s.sprzedaz || 0), 0);
    }

    const monthTarget = prevMonthSales * 1.05;

    const recentOrders = await db
      .select({
        clientName: clients.klient,
        kwota: contacts.kwota,
        data: contacts.data,
        status: contacts.status,
      })
      .from(contacts)
      .leftJoin(clients, eq(contacts.clientId, clients.id))
      .where(and(
        eq(contacts.opiekun, opiekun),
        eq(contacts.status, "Zamowil"),
      ))
      .orderBy(desc(contacts.data))
      .limit(30);

    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
    const monthEnd = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${new Date(currentYear, currentMonth, 0).getDate()}`;

    const allMonthContacts = await db.select().from(contacts)
      .where(and(
        eq(contacts.opiekun, opiekun),
        sql`${contacts.data} >= ${monthStart}`,
        sql`${contacts.data} <= ${monthEnd}`,
      ));

    const monthOrders = allMonthContacts.filter(c => c.status === "Zamowil");
    const monthOrdersCount = monthOrders.length;
    const monthOrdersTotal = monthOrders.reduce((sum, c) => sum + Number(c.kwota || 0), 0);
    const totalContacts = allMonthContacts.length;
    const conversionRate = totalContacts > 0 ? (monthOrdersCount / totalContacts) * 100 : 0;

    const today = now.toISOString().split("T")[0];
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - mondayOffset);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const weekContacts = allMonthContacts.filter(c => c.data >= weekStartStr && c.data <= today);
    const weekOrders = weekContacts.filter(c => c.status === "Zamowil");
    const weekSales = weekOrders.reduce((sum, c) => sum + Number(c.kwota || 0), 0);
    const weekOrdersCount = weekOrders.length;

    let bestClient: { name: string; kwota: number } | null = null;
    const clientTotals = new Map<number, { name: string; total: number }>();
    for (const order of monthOrders) {
      const client = myClients.find(c => c.id === order.clientId);
      if (client) {
        const existing = clientTotals.get(order.clientId) || { name: client.klient, total: 0 };
        existing.total += Number(order.kwota || 0);
        clientTotals.set(order.clientId, existing);
      }
    }
    let maxTotal = 0;
    clientTotals.forEach((val) => {
      if (val.total > maxTotal) {
        maxTotal = val.total;
        bestClient = { name: val.name, kwota: val.total };
      }
    });

    const urgentClients = myClients
      .filter(c => (c.brakiZamowien || 0) >= 2)
      .map(c => ({ id: c.id, klient: c.klient, brakiZamowien: c.brakiZamowien || 0 }));

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const allMyContacts = await db.select().from(contacts)
      .where(eq(contacts.opiekun, opiekun));

    const lastContactByClient = new Map<number, string>();
    for (const c of allMyContacts) {
      const existing = lastContactByClient.get(c.clientId);
      if (!existing || c.data > existing) {
        lastContactByClient.set(c.clientId, c.data);
      }
    }

    const noRecentContact = myClients
      .filter(c => {
        const lastDate = lastContactByClient.get(c.id);
        if (!lastDate) return true;
        return lastDate < sevenDaysAgoStr;
      })
      .filter(c => !urgentClients.some(u => u.id === c.id))
      .map(c => ({
        id: c.id,
        klient: c.klient,
        ostatniKontakt: lastContactByClient.get(c.id) || null,
        brakiZamowien: c.brakiZamowien || 0,
      }));

    const currentSalesMap = new Map<number, number>();
    if (clientIds.length > 0) {
      const mySalesData = await db.select().from(clientSales)
        .where(and(
          eq(clientSales.rok, currentYear),
          eq(clientSales.miesiac, currentMonth),
          inArray(clientSales.clientId, clientIds),
        ));
      for (const s of mySalesData) {
        currentSalesMap.set(s.clientId, (currentSalesMap.get(s.clientId) || 0) + Number(s.sprzedaz || 0));
      }
    }

    const salesByGroup: Record<string, { sprzedaz: number; klientow: number }> = {};
    for (const client of myClients) {
      const grupa = (client as any).grupaMvp || "Inne";
      if (!salesByGroup[grupa]) {
        salesByGroup[grupa] = { sprzedaz: 0, klientow: 0 };
      }
      salesByGroup[grupa].klientow += 1;
      const sale = currentSalesMap.get(client.id);
      if (sale) {
        salesByGroup[grupa].sprzedaz += sale;
      }
    }

    return {
      monthSales,
      prevMonthSales,
      monthTarget,
      recentOrders,
      monthOrdersCount,
      monthOrdersTotal,
      conversionRate,
      totalContacts,
      weekSales,
      weekOrdersCount,
      bestClient,
      urgentClients,
      noRecentContact,
      salesByGroup,
    };
  }

  async getPlanData(rok: number, miesiac: number, opiekun?: string): Promise<any> {
    const prev1Month = miesiac === 1 ? 12 : miesiac - 1;
    const prev1Year = miesiac === 1 ? rok - 1 : rok;
    const prev2Month = prev1Month === 1 ? 12 : prev1Month - 1;
    const prev2Year = prev1Month === 1 ? prev1Year - 1 : prev1Year;

    const weeklyData = await db.select().from(clientSalesWeekly)
      .where(and(eq(clientSalesWeekly.rok, rok), eq(clientSalesWeekly.miesiac, miesiac)));

    const clientIdSet = new Set<number>();
    weeklyData.forEach(w => clientIdSet.add(w.clientId));
    const clientIds = Array.from(clientIdSet);
    if (clientIds.length === 0) return { groups: [], prev1Month, prev1Year, prev2Month, prev2Year, prevMonthTotalSales: 0 };

    let allClients = await db.select().from(clients);
    if (opiekun) {
      allClients = allClients.filter(c => c.opiekun === opiekun);
    }
    const clientMap = new Map(allClients.map(c => [c.id, c]));

    const prev1Sales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, prev1Year), eq(clientSales.miesiac, prev1Month)));
    const prev1Map = new Map(prev1Sales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    const prev2Sales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, prev2Year), eq(clientSales.miesiac, prev2Month)));
    const prev2Map = new Map(prev2Sales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    const currentSales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, rok), eq(clientSales.miesiac, miesiac)));
    const currentSalesMap = new Map(currentSales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    const filteredClientIds = new Set(allClients.map(c => c.id));
    const prevMonthTotalSales = prev1Sales
      .filter(r => filteredClientIds.has(r.clientId))
      .reduce((s, r) => s + Number(r.sprzedaz || 0), 0);

    function matchGrupa(grupaMvp: string | null): string {
      const g = grupaMvp || "Inne";
      if (g.includes("Gosia") && g.includes("Premium")) return "Gosia Premium";
      if (g.includes("Magda") && g.includes("Premium")) return "Magda Premium";
      if (g.includes("Magda") && g.includes("Standard")) return "Magda Standard";
      if (g.includes("Zostaną") || g.includes("zostana") || g.includes("zostan")) return "Weryfikacja Zostaną";
      if (g.includes("Odejdą") || g.includes("odejda") || g.includes("odejd")) return "Weryfikacja Odejdą";
      return "Inne";
    }

    type ClientPlan = {
      clientId: number;
      klient: string;
      rabat: number | null;
      prev1: number;
      prev2: number;
      cel: number;
      realizacjaWZ: number;
      tydz1: number;
      tydz2: number;
      tydz3: number;
      tydz4: number;
      weeklyIds: number[];
      srTyg: number;
      notatki: string | null;
      status: string | null;
    };

    const grupyMap: Record<string, ClientPlan[]> = {};
    const grupyOrder = ["Gosia Premium", "Magda Premium", "Magda Standard", "Weryfikacja Zostaną", "Weryfikacja Odejdą", "Inne"];

    const weeklyByClient = new Map<number, typeof weeklyData>();
    for (const w of weeklyData) {
      if (!weeklyByClient.has(w.clientId)) weeklyByClient.set(w.clientId, []);
      weeklyByClient.get(w.clientId)!.push(w);
    }

    weeklyByClient.forEach((weeks, cid) => {
      const client = clientMap.get(cid);
      if (!client) return;

      const grupa = matchGrupa(client.grupaMvp);
      if (!grupyMap[grupa]) grupyMap[grupa] = [];

      const cel = Number(weeks[0]?.plan || 0);
      const prev1Val = prev1Map.get(cid) || 0;
      const prev2Val = prev2Map.get(cid) || 0;
      const srTyg = prev1Val > 0 ? prev1Val / 4.3 : 0;

      const weekVals: Record<number, { realizacja: number; id: number }> = {};
      for (const w of weeks) {
        weekVals[w.tydzien] = { realizacja: Number(w.realizacja || 0), id: w.id };
      }

      const realizacjaWZ = currentSalesMap.get(cid) || 0;

      grupyMap[grupa].push({
        clientId: cid,
        klient: client.klient,
        rabat: client.rabatProcent ? Number(client.rabatProcent) : null,
        prev1: prev1Val,
        prev2: prev2Val,
        cel,
        realizacjaWZ,
        tydz1: weekVals[1]?.realizacja || 0,
        tydz2: weekVals[2]?.realizacja || 0,
        tydz3: weekVals[3]?.realizacja || 0,
        tydz4: weekVals[4]?.realizacja || 0,
        weeklyIds: [weekVals[1]?.id || 0, weekVals[2]?.id || 0, weekVals[3]?.id || 0, weekVals[4]?.id || 0],
        srTyg: Math.round(srTyg),
        notatki: weeks[0]?.notatki || null,
        status: weeks[0]?.status || null,
      });
    });

    const groups = grupyOrder
      .filter(name => grupyMap[name] && grupyMap[name].length > 0)
      .map(name => ({
        grupa: name,
        klienci: grupyMap[name].sort((a, b) => b.prev1 - a.prev1),
      }));

    return { groups, prev1Month, prev1Year, prev2Month, prev2Year, prevMonthTotalSales };
  }

  async getAvailablePlanMonths(): Promise<Array<{rok: number; miesiac: number}>> {
    const rows = await db.selectDistinct({
      rok: clientSalesWeekly.rok,
      miesiac: clientSalesWeekly.miesiac,
    }).from(clientSalesWeekly).orderBy(desc(clientSalesWeekly.rok), desc(clientSalesWeekly.miesiac));
    return rows;
  }

  async updateWeeklyPlan(id: number, realizacja: number): Promise<void> {
    await db.update(clientSalesWeekly)
      .set({ realizacja: String(realizacja) })
      .where(eq(clientSalesWeekly.id, id));
  }

  async updateWeeklyNotatki(clientId: number, rok: number, miesiac: number, notatki: string): Promise<void> {
    await db.update(clientSalesWeekly)
      .set({ notatki })
      .where(and(
        eq(clientSalesWeekly.clientId, clientId),
        eq(clientSalesWeekly.rok, rok),
        eq(clientSalesWeekly.miesiac, miesiac)
      ));
  }

  async importClientSales(rok: number, miesiac: number, data: Array<{klient: string; sprzedaz: number; koszt: number; zysk: number; marza: number}>): Promise<{imported: number; notFound: string[]}> {
    const allClients = await db.select().from(clients);
    const clientNameMap = new Map<string, number>();
    for (const c of allClients) {
      clientNameMap.set(c.klient.trim().toLowerCase(), c.id);
    }

    let imported = 0;
    const notFound: string[] = [];

    for (const row of data) {
      const nameKey = row.klient.trim().toLowerCase();
      let clientId = clientNameMap.get(nameKey);

      if (!clientId) {
        const found = allClients.find(c => c.klient.trim().toLowerCase().includes(nameKey) || nameKey.includes(c.klient.trim().toLowerCase()));
        if (found) clientId = found.id;
      }

      if (!clientId) {
        notFound.push(row.klient);
        continue;
      }

      await db.insert(clientSales).values({
        clientId,
        rok,
        miesiac,
        sprzedaz: String(row.sprzedaz),
        koszt: String(row.koszt),
        zysk: String(row.zysk),
        marza: String(row.marza),
      });
      imported++;
    }

    return { imported, notFound };
  }

  async deleteClientSalesForMonth(rok: number, miesiac: number): Promise<number> {
    const existing = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, rok), eq(clientSales.miesiac, miesiac)));
    await db.delete(clientSales)
      .where(and(eq(clientSales.rok, rok), eq(clientSales.miesiac, miesiac)));
    return existing.length;
  }

  async importMonthlyPlan(rok: number, miesiac: number, data: Array<{klient: string; cel: number}>): Promise<{imported: number; notFound: string[]}> {
    const allClients = await db.select().from(clients);
    const clientNameMap = new Map<string, number>();
    for (const c of allClients) {
      clientNameMap.set(c.klient.trim().toLowerCase(), c.id);
    }

    let imported = 0;
    const notFound: string[] = [];
    const toInsert: Array<{clientId: number; cel: number}> = [];

    for (const row of data) {
      const nameKey = row.klient.trim().toLowerCase();
      let clientId = clientNameMap.get(nameKey);

      if (!clientId) {
        const found = allClients.find(c =>
          c.klient.trim().toLowerCase().includes(nameKey) ||
          nameKey.includes(c.klient.trim().toLowerCase())
        );
        if (found) clientId = found.id;
      }

      if (!clientId) {
        notFound.push(row.klient);
        continue;
      }

      toInsert.push({ clientId, cel: row.cel });
      imported++;
    }

    if (toInsert.length > 0) {
      await db.delete(clientSalesWeekly)
        .where(and(eq(clientSalesWeekly.rok, rok), eq(clientSalesWeekly.miesiac, miesiac)));

      for (const { clientId, cel } of toInsert) {
        const weeklyPlan = String(cel / 4);
        for (let tydzien = 1; tydzien <= 4; tydzien++) {
          await db.insert(clientSalesWeekly).values({
            clientId,
            rok,
            miesiac,
            tydzien,
            plan: weeklyPlan,
            realizacja: "0",
            planUserSet: true,
          });
        }
      }
    }

    return { imported, notFound };
  }

  async deleteMonthlyPlan(rok: number, miesiac: number): Promise<number> {
    const existing = await db.select().from(clientSalesWeekly)
      .where(and(eq(clientSalesWeekly.rok, rok), eq(clientSalesWeekly.miesiac, miesiac)));
    await db.delete(clientSalesWeekly)
      .where(and(eq(clientSalesWeekly.rok, rok), eq(clientSalesWeekly.miesiac, miesiac)));
    return existing.length;
  }

  async updateSalesTarget(id: number, data: {planObrotu?: number; wykonanieObrotu?: number}): Promise<any> {
    const updateData: any = {};
    if (data.planObrotu !== undefined) {
      updateData.planObrotu = String(data.planObrotu);
      // Admin explicitly set a target via sales-dashboard UI → custom.
      // A zero value clears the custom flag (back to auto +5%).
      updateData.planObrotuCustom = Number(data.planObrotu) > 0;
    }
    if (data.wykonanieObrotu !== undefined) updateData.wykonanieObrotu = String(data.wykonanieObrotu);
    const [updated] = await db.update(salesTargets).set(updateData).where(eq(salesTargets.id, id)).returning();
    return updated;
  }

  async syncSalesTargetExecution(rok: number, miesiac: number): Promise<{total: number}> {
    const salesData = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, rok), eq(clientSales.miesiac, miesiac)));
    const total = salesData.reduce((s, r) => s + Number(r.sprzedaz || 0), 0);

    const existing = await db.select().from(salesTargets)
      .where(and(eq(salesTargets.rok, rok), eq(salesTargets.miesiac, miesiac)));

    if (existing.length > 0) {
      await db.update(salesTargets)
        .set({ wykonanieObrotu: String(total) })
        .where(and(eq(salesTargets.rok, rok), eq(salesTargets.miesiac, miesiac)));
    } else {
      await db.insert(salesTargets).values({
        rok,
        miesiac,
        planObrotu: "0",
        wykonanieObrotu: String(total),
      });
    }

    return { total };
  }

  async updateSalesTargetsBulk(rok: number, targets: Array<{miesiac: number; planObrotu: number}>): Promise<{updated: number}> {
    let updated = 0;
    for (const t of targets) {
      const isCustom = Number(t.planObrotu) > 0;
      const existing = await db.select().from(salesTargets)
        .where(and(eq(salesTargets.rok, rok), eq(salesTargets.miesiac, t.miesiac)));
      if (existing.length > 0) {
        await db.update(salesTargets)
          .set({ planObrotu: String(t.planObrotu), planObrotuCustom: isCustom })
          .where(and(eq(salesTargets.rok, rok), eq(salesTargets.miesiac, t.miesiac)));
      } else {
        await db.insert(salesTargets).values({
          rok,
          miesiac: t.miesiac,
          planObrotu: String(t.planObrotu),
          wykonanieObrotu: "0",
          planObrotuCustom: isCustom,
        });
      }
      updated++;
    }
    return { updated };
  }

  async syncSalesTargetsForYear(rok: number): Promise<{updated: number}> {
    let updated = 0;
    for (let m = 1; m <= 12; m++) {
      const result = await this.syncSalesTargetExecution(rok, m);
      if (result.total > 0) updated++;
    }
    return { updated };
  }

  async autoGeneratePlan(rok: number, miesiac: number, wspolczynnik: number): Promise<{generated: number; skipped: number}> {
    const prevMonth = miesiac === 1 ? 12 : miesiac - 1;
    const prevYear = miesiac === 1 ? rok - 1 : rok;

    const prev2Month = prevMonth === 1 ? 12 : prevMonth - 1;
    const prev2Year = prevMonth === 1 ? prevYear - 1 : prevYear;
    const prev3Month = prev2Month === 1 ? 12 : prev2Month - 1;
    const prev3Year = prev2Month === 1 ? prev2Year - 1 : prev2Year;

    // Take ALL clients that had sales (ignore aktywny flag).
    // Sales can come from iBiznes WZ for clients not yet flagged aktywny in CRM.
    const allClients = await db.select().from(clients);
    const clientIdSet = new Set(allClients.map(c => c.id));

    const prevSales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, prevYear), eq(clientSales.miesiac, prevMonth)));
    const prevMap = new Map(prevSales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    const prev2Sales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, prev2Year), eq(clientSales.miesiac, prev2Month)));
    const prev2Map = new Map(prev2Sales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    const prev3Sales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, prev3Year), eq(clientSales.miesiac, prev3Month)));
    const prev3Map = new Map(prev3Sales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    // Build the set of candidate clientIds: anyone with sales in prev, prev2 or prev3 months.
    const candidateClientIds = new Set<number>();
    for (const s of prevSales) if (clientIdSet.has(s.clientId)) candidateClientIds.add(s.clientId);
    for (const s of prev2Sales) if (clientIdSet.has(s.clientId)) candidateClientIds.add(s.clientId);
    for (const s of prev3Sales) if (clientIdSet.has(s.clientId)) candidateClientIds.add(s.clientId);

    await db.delete(clientSalesWeekly)
      .where(and(eq(clientSalesWeekly.rok, rok), eq(clientSalesWeekly.miesiac, miesiac)));

    let generated = 0;
    let skipped = 0;

    for (const clientId of candidateClientIds) {
      let baseSales = prevMap.get(clientId) || 0;

      if (baseSales === 0) {
        const vals = [prev2Map.get(clientId) || 0, prev3Map.get(clientId) || 0].filter(v => v > 0);
        if (vals.length > 0) {
          baseSales = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
      }

      if (baseSales === 0) {
        skipped++;
        continue;
      }

      const cel = baseSales * wspolczynnik;
      const weeklyPlan = String(cel / 4);

      for (let tydzien = 1; tydzien <= 4; tydzien++) {
        await db.insert(clientSalesWeekly).values({
          clientId,
          rok,
          miesiac,
          tydzien,
          plan: weeklyPlan,
          realizacja: "0",
          planUserSet: true,
        });
      }
      generated++;
    }

    return { generated, skipped };
  }

  async getNotes(autor?: string): Promise<Note[]> {
    if (autor) {
      return db.select().from(notes).where(eq(notes.autor, autor)).orderBy(desc(notes.createdAt));
    }
    return db.select().from(notes).orderBy(desc(notes.createdAt));
  }

  async createNote(note: InsertNote): Promise<Note> {
    const [created] = await db.insert(notes).values(note).returning();
    return created;
  }

  async updateNote(id: number, data: Partial<InsertNote>): Promise<Note> {
    const [updated] = await db.update(notes).set(data).where(eq(notes.id, id)).returning();
    return updated;
  }

  async deleteNote(id: number): Promise<void> {
    await db.delete(notes).where(eq(notes.id, id));
  }

  async getMeetings(from?: string, to?: string): Promise<Meeting[]> {
    const conditions: any[] = [];
    if (from) conditions.push(gte(meetings.data, from));
    if (to) conditions.push(lte(meetings.data, to));
    if (conditions.length > 0) {
      return db.select().from(meetings).where(and(...conditions)).orderBy(asc(meetings.data));
    }
    return db.select().from(meetings).orderBy(asc(meetings.data));
  }

  async getMeeting(id: number): Promise<Meeting | undefined> {
    const [m] = await db.select().from(meetings).where(eq(meetings.id, id));
    return m;
  }

  async createMeeting(meeting: InsertMeeting): Promise<Meeting> {
    const [created] = await db.insert(meetings).values(meeting).returning();
    return created;
  }

  async updateMeeting(id: number, data: Partial<InsertMeeting>): Promise<Meeting> {
    const [updated] = await db.update(meetings).set(data).where(eq(meetings.id, id)).returning();
    return updated;
  }

  async deleteMeeting(id: number): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }

  async getDashboardStats(opiekun?: string, rola?: string): Promise<any> {
    const allClients = await db.select().from(clients);
    const filteredClients = opiekun && rola === "handlowiec" ? allClients.filter(c => c.opiekun === opiekun) : allClients;

    const activeClients = filteredClients.filter(c => c.aktywny).length;
    const alertClients = filteredClients.filter(c => (c.brakiZamowien || 0) >= 2).length;

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    const todayContactsList = await this.getContacts(today, today, rola === "handlowiec" ? opiekun : undefined);
    const todayContactsCount = todayContactsList.length;
    const todayContactsDone = todayContactsList.filter(c => c.status && c.status !== "Do zrobienia").length;
    const tomorrowDeliveriesList = await this.getDeliveries(tomorrow);
    const tomorrowDeliveriesCount = tomorrowDeliveriesList.length;
    const tomorrowDeliveriesValue = tomorrowDeliveriesList.reduce((sum, d) => sum + Number(d.wartoscNettoWz || 0), 0);

    const now = new Date();
    const currentTargets = await db.select().from(salesTargets)
      .where(and(eq(salesTargets.rok, now.getFullYear()), eq(salesTargets.miesiac, now.getMonth() + 1)));

    const year = now.getFullYear();
    const month = now.getMonth();
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;

    const allMonthContacts = await db.select().from(contacts)
      .where(and(gte(contacts.data, monthStart), lte(contacts.data, monthEnd)));

    // Previous month's sales (for proportional comparison on dashboard)
    const prevMonthNum = month === 0 ? 12 : month;
    const prevYearNum = month === 0 ? year - 1 : year;
    const prevMonthSalesRows = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, prevYearNum), eq(clientSales.miesiac, prevMonthNum)));
    const filteredPrevSalesRows = opiekun && rola === "handlowiec"
      ? prevMonthSalesRows.filter(r => {
          const client = allClients.find(c => c.id === r.clientId);
          return client?.opiekun === opiekun;
        })
      : prevMonthSalesRows;
    const prevMonthSalesTotal = filteredPrevSalesRows.reduce((s, r) => s + Number(r.sprzedaz || 0), 0);

    // monthPlan: same logic as Plan miesiąca / Analiza sprzedaży —
    //   default = previous month realizacja × 1.05 (incl. unmatched WZ for admin),
    //   custom only when plan_obrotu_custom = true AND plan_obrotu > 0.
    const isHandlowiecPlan = opiekun && rola === "handlowiec";
    let prevUnmatchedForPlan = 0;
    if (!isHandlowiecPlan) {
      const prevUnmatchedRow = await db.execute(sql`
        SELECT COALESCE(SUM(CAST(koszt AS NUMERIC)), 0) AS total
        FROM ibiznes_invoices
        WHERE rok = ${prevYearNum} AND miesiac = ${prevMonthNum} AND client_id IS NULL
      `);
      prevUnmatchedForPlan = Number((prevUnmatchedRow.rows[0] as any)?.total || 0);
    }
    const prevTotalForPlan = prevMonthSalesTotal + prevUnmatchedForPlan;
    const defaultMonthPlan = Math.round(prevTotalForPlan * 1.05);
    const hasCustomFlag = currentTargets.length > 0 && Boolean(currentTargets[0].planObrotuCustom);
    const customMonthPlan = hasCustomFlag ? Number(currentTargets[0].planObrotu || 0) : 0;
    const monthPlan = hasCustomFlag && customMonthPlan > 0 ? customMonthPlan : defaultMonthPlan;

    // monthSales: prefer iBiznes-aggregated client_sales; fall back to contacts.kwota when no data
    const monthSalesRows = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, year), eq(clientSales.miesiac, month + 1)));
    const filteredSalesRows = opiekun && rola === "handlowiec"
      ? monthSalesRows.filter(r => {
          const client = allClients.find(c => c.id === r.clientId);
          return client?.opiekun === opiekun;
        })
      : monthSalesRows;
    const ibiznesMonthSales = filteredSalesRows.reduce((s, r) => s + Number(r.sprzedaz || 0), 0);
    const contactsMonthSales = allMonthContacts
      .filter(c => c.status === "Zamowil")
      .reduce((sum, c) => sum + Number(c.kwota || 0), 0);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // month w tym scope'ie jest 0-bazowy (z now.getMonth()), helper oczekuje 1-bazowego
    const totalWorkdays = countPolishWorkdays(year, month + 1, daysInMonth);
    const workingDaysPassed = countPolishWorkdays(year, month + 1, now.getDate());
    const dailyTarget = totalWorkdays > 0 ? monthPlan / totalWorkdays : 0;

    // Unmatched sales for current month (WZ without client in CRM).
    // Only added for admin/non-handlowiec views (handlowcy see only their own clients).
    const unmatchedRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(CAST(koszt AS NUMERIC)), 0) AS total,
        COUNT(*) AS count
      FROM ibiznes_invoices
      WHERE rok = ${year} AND miesiac = ${month + 1} AND client_id IS NULL
    `);
    const unmatchedSales = Number((unmatchedRows.rows[0] as any)?.total || 0);
    const unmatchedCount = Number((unmatchedRows.rows[0] as any)?.count || 0);

    // monthSales: prefer iBiznes (clients + unmatched WZ for admin view); fall back to contacts.kwota when no data
    const isHandlowiecView = opiekun && rola === "handlowiec";
    const monthSales = ibiznesMonthSales > 0
      ? ibiznesMonthSales + (isHandlowiecView ? 0 : unmatchedSales)
      : contactsMonthSales;

    const expectedSales = dailyTarget * workingDaysPassed;
    const tempo = workingDaysPassed > 0 ? monthSales / workingDaysPassed : 0;
    const prognoza = tempo * totalWorkdays;
    const prognozaOnTrack = prognoza >= monthPlan;

    // Previous month unmatched (for proportional comparison)
    const unmatchedPrevRows = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(koszt AS NUMERIC)), 0) AS total
      FROM ibiznes_invoices
      WHERE rok = ${prevYearNum} AND miesiac = ${prevMonthNum} AND client_id IS NULL
    `);
    const unmatchedPrevTotal = Number((unmatchedPrevRows.rows[0] as any)?.total || 0);

    // Proportional prev-month comparison: scale prev total by same working-day ratio.
    const prevDaysInMonth = new Date(prevYearNum, prevMonthNum, 0).getDate();
    const prevTotalWorkdays = countPolishWorkdays(prevYearNum, prevMonthNum, prevDaysInMonth);
    const prevCompareDays = Math.min(workingDaysPassed, prevTotalWorkdays);
    const prevScale = prevTotalWorkdays > 0 ? prevCompareDays / prevTotalWorkdays : 0;
    const prevTotalWithUnmatched = prevMonthSalesTotal + (isHandlowiecView ? 0 : unmatchedPrevTotal);
    const prevMonthSalesScaled = prevTotalWithUnmatched * prevScale;
    const prevMonthChange = prevMonthSalesScaled > 0
      ? ((monthSales - prevMonthSalesScaled) / prevMonthSalesScaled) * 100
      : null;

    const uniqueOrderedClients = new Set(allMonthContacts.filter(c => c.status === "Zamowil").map(c => c.clientId)).size;

    const mondayOfWeek = new Date(now);
    const dayOfWeek = mondayOfWeek.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    mondayOfWeek.setDate(mondayOfWeek.getDate() + diff);
    const fridayOfWeek = new Date(mondayOfWeek);
    fridayOfWeek.setDate(fridayOfWeek.getDate() + 4);

    const weekStart = mondayOfWeek.toISOString().split("T")[0];
    const weekEnd = fridayOfWeek.toISOString().split("T")[0];

    const prevMondayOfWeek = new Date(mondayOfWeek);
    prevMondayOfWeek.setDate(prevMondayOfWeek.getDate() - 7);
    const prevFridayOfWeek = new Date(prevMondayOfWeek);
    prevFridayOfWeek.setDate(prevFridayOfWeek.getDate() + 4);
    const prevWeekStart = prevMondayOfWeek.toISOString().split("T")[0];
    const prevWeekEnd = prevFridayOfWeek.toISOString().split("T")[0];

    const weekContacts = await db.select().from(contacts)
      .where(and(gte(contacts.data, weekStart), lte(contacts.data, weekEnd)));

    const prevWeekContacts = await db.select().from(contacts)
      .where(and(gte(contacts.data, prevWeekStart), lte(contacts.data, prevWeekEnd)));

    const weeklyOrders = ["Gosia", "Magda"].map(name => {
      const hAllClients = allClients.filter(c => c.opiekun === name);
      const hClients = hAllClients.filter(c => c.aktywny
        && (c.grupaMvp?.includes("Premium") || c.grupaMvp?.includes("Standard")));
      const hContacts = weekContacts.filter(c => c.opiekun === name);
      const ordered = hContacts.filter(c => c.status === "Zamowil").length;
      const contacted = hContacts.filter(c => c.status && c.status !== "Do zrobienia").length;

      const premiumClients = hAllClients.filter(c => c.grupaMvp?.includes("Premium"));
      const standardClients = hAllClients.filter(c => c.grupaMvp?.includes("Standard"));
      const weryfikacjaClients = hAllClients.filter(c => c.grupaMvp?.includes("Weryfikacja"));

      const orderedClientIds = hContacts.filter(c => c.status === "Zamowil").map(c => c.clientId);
      const premiumOrdered = premiumClients.filter(c => orderedClientIds.includes(c.id)).length;
      const standardOrdered = standardClients.filter(c => orderedClientIds.includes(c.id)).length;
      const weryfikacjaOrdered = weryfikacjaClients.filter(c => orderedClientIds.includes(c.id)).length;

      const hActive = hAllClients.filter(c => c.aktywny);
      const hAlerts = hAllClients.filter(c => (c.brakiZamowien || 0) >= 2);

      const weekSales = hContacts
        .filter(c => c.status === "Zamowil")
        .reduce((sum, c) => sum + Number(c.kwota || 0), 0);

      const hPrevContacts = prevWeekContacts.filter(c => c.opiekun === name);
      const prevWeekSales = hPrevContacts
        .filter(c => c.status === "Zamowil")
        .reduce((sum, c) => sum + Number(c.kwota || 0), 0);

      const hMonthContacts = allMonthContacts.filter(c => c.opiekun === name);
      const handlowiecMonthSales = hMonthContacts
        .filter(c => c.status === "Zamowil")
        .reduce((sum, c) => sum + Number(c.kwota || 0), 0);
      const handlowiecMonthOrdered = hMonthContacts.filter(c => c.status === "Zamowil").length;
      const handlowiecMonthContacted = hMonthContacts.filter(c => c.status && c.status !== "Do zrobienia").length;

      return {
        name,
        totalClients: hClients.length,
        totalContacts: hContacts.length,
        contacted,
        ordered,
        premiumTotal: premiumClients.length,
        premiumOrdered,
        standardTotal: standardClients.length,
        standardOrdered,
        weryfikacjaTotal: weryfikacjaClients.length,
        weryfikacjaOrdered,
        activeClients: hActive.length,
        allClients: hAllClients.length,
        alertClients: hAlerts.length,
        weekSales,
        prevWeekSales,
        handlowiecMonthSales,
        handlowiecMonthOrdered,
        handlowiecMonthContacted,
      };
    });

    let handlowcy: any[] | undefined;
    if (rola === "admin") {
      handlowcy = weeklyOrders;
    }

    return {
      totalClients: filteredClients.length,
      activeClients,
      alertClients,
      todayContacts: todayContactsCount,
      todayContactsDone,
      tomorrowDeliveries: tomorrowDeliveriesCount,
      tomorrowDeliveriesValue,
      monthPlan,
      monthSales,
      workingDaysPassed,
      totalWorkdays,
      expectedSales,
      dailyTarget,
      tempo,
      prognoza,
      prognozaOnTrack,
      uniqueOrderedClients,
      prevMonthSalesTotal,
      prevMonthSalesScaled,
      prevMonthChange,
      prevCompareDays,
      prevTotalWorkdays,
      prevMonthNum,
      prevYearNum,
      unmatchedSales,
      unmatchedCount,
      weeklyOrders,
      handlowcy,
    };
  }
  async getDailyAnalysis(rok: number, miesiac: number): Promise<DailyAnalysis[]> {
    const rows = await db.select().from(dailyAnalysis)
      .where(and(
        eq(dailyAnalysis.rok, rok),
        eq(dailyAnalysis.miesiac, miesiac),
        gte(dailyAnalysis.dzien, 1),
      ))
      .orderBy(asc(dailyAnalysis.dzien));
    return rows;
  }

  async getDniRobocze(rok: number, miesiac: number): Promise<number> {
    const [settingsRow] = await db.select().from(dailyAnalysis)
      .where(and(
        eq(dailyAnalysis.rok, rok),
        eq(dailyAnalysis.miesiac, miesiac),
        eq(dailyAnalysis.dzien, 0),
      ));
    return settingsRow ? settingsRow.dniRobocze : 21;
  }

  async upsertDailyAnalysis(rok: number, miesiac: number, dzien: number, sprzedaz: string | null): Promise<DailyAnalysis> {
    const existing = await db.select().from(dailyAnalysis)
      .where(and(
        eq(dailyAnalysis.rok, rok),
        eq(dailyAnalysis.miesiac, miesiac),
        eq(dailyAnalysis.dzien, dzien),
      ));
    if (existing.length > 0) {
      const [updated] = await db.update(dailyAnalysis)
        .set({ sprzedaz })
        .where(eq(dailyAnalysis.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(dailyAnalysis)
      .values({ rok, miesiac, dzien, sprzedaz })
      .returning();
    return created;
  }

  async updateDniRobocze(rok: number, miesiac: number, dniRobocze: number): Promise<void> {
    const [existing] = await db.select().from(dailyAnalysis)
      .where(and(
        eq(dailyAnalysis.rok, rok),
        eq(dailyAnalysis.miesiac, miesiac),
        eq(dailyAnalysis.dzien, 0),
      ));
    if (existing) {
      await db.update(dailyAnalysis)
        .set({ dniRobocze })
        .where(eq(dailyAnalysis.id, existing.id));
    } else {
      await db.insert(dailyAnalysis).values({ rok, miesiac, dzien: 0, dniRobocze });
    }
  }

  async getMonthlyFixedCosts(miesiac: number): Promise<number> {
    const MONTH_KEYS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paz", "lis", "gru"];
    const mKey = MONTH_KEYS[miesiac - 1];

    const salariesData = await db.select().from(salaries);
    const costsData = await db.select().from(costs);
    const fleetData = await db.select().from(fleet);

    const filterActive = (items: any[], costField: string) => {
      return items.reduce((sum: number, item: any) => {
        const am = item.aktywnyMiesiace as Record<string, boolean> | null;
        if (am && am[mKey] === false) return sum;
        return sum + Number(item[costField] || 0);
      }, 0);
    };

    const totalSalaries = filterActive(salariesData, "kosztPracodawcy");
    const totalCosts = filterActive(costsData, "koszt");
    const totalFleet = filterActive(fleetData, "koszt");

    return totalSalaries + totalCosts + totalFleet;
  }

  async getCostBreakdownForMonth(miesiac: number, rok?: number): Promise<{
    departments: Array<{ name: string; total: number; categories: Array<{ id: number; name: string; total: number; typ: string }> }>;
    vatTotal: number;
    fixedTotal: number;
    ksefTotal: number;
    grandTotal: number;
    source: "manual";
  }> {
    // Koszty liczone WYŁĄCZNIE z ręcznych wpisów (manual_expenses).
    // typ='staly'  -> liczony w każdym miesiącu (core).
    // typ='zmienny' -> liczony tylko w danym rok+miesiac.
    const expenses = await this.getManualExpenses(rok, miesiac);

    const deptTotals: Record<string, Array<{ id: number; name: string; total: number; typ: string }>> = {};
    for (const e of expenses) {
      const dept = e.dzial || "Pozostale";
      if (!deptTotals[dept]) deptTotals[dept] = [];
      deptTotals[dept].push({
        id: e.id,
        name: e.nazwa,
        total: Math.round(Number(e.kwota || 0)),
        typ: e.typ,
      });
    }

    const departments = Object.entries(deptTotals)
      .map(([name, categories]) => ({
        name,
        categories: categories.sort((a, b) => b.total - a.total),
        total: Math.round(categories.reduce((s, c) => s + c.total, 0)),
      }))
      .sort((a, b) => b.total - a.total);

    const grandTotal = departments.reduce((s, d) => s + d.total, 0);
    const fixedTotal = Math.round(
      expenses.filter((e) => e.typ === "staly").reduce((s, e) => s + Number(e.kwota || 0), 0)
    );

    return {
      departments,
      vatTotal: 0,
      fixedTotal,
      ksefTotal: 0,
      grandTotal,
      source: "manual",
    };
  }

  // ── Ręczne wydatki (manual_expenses) ──────────────────────────────
  async getManualExpenses(rok?: number, miesiac?: number): Promise<ManualExpense[]> {
    const all = await db.select().from(manualExpenses);
    if (rok == null || miesiac == null) return all;
    // Obowiązują: wszystkie stałe + zmienne z danego rok+miesiac.
    return all.filter(
      (e) => e.typ === "staly" || (e.typ === "zmienny" && e.rok === rok && e.miesiac === miesiac)
    );
  }

  async createManualExpense(data: InsertManualExpense): Promise<ManualExpense> {
    const [row] = await db.insert(manualExpenses).values(data).returning();
    return row;
  }

  async updateManualExpense(id: number, data: Partial<InsertManualExpense>): Promise<ManualExpense> {
    const [row] = await db.update(manualExpenses).set(data).where(eq(manualExpenses.id, id)).returning();
    return row;
  }

  async deleteManualExpense(id: number): Promise<void> {
    await db.delete(manualExpenses).where(eq(manualExpenses.id, id));
  }

  async importDailySalesFromContacts(rok: number, miesiac: number): Promise<number> {
    const monthStr = String(miesiac).padStart(2, "0");
    const prefix = `${rok}-${monthStr}-`;

    const contactsData = await db.select().from(contacts)
      .where(
        and(
          like(contacts.data, `${prefix}%`),
          eq(contacts.status, "Zamowil"),
        )
      );

    const byDay: Record<number, number> = {};
    for (const c of contactsData) {
      const day = parseInt(c.data.split("-")[2], 10);
      if (!byDay[day]) byDay[day] = 0;
      byDay[day] += Number(c.kwota || 0);
    }

    let daysImported = 0;
    for (const [dayStr, total] of Object.entries(byDay)) {
      if (total > 0) {
        await this.upsertDailyAnalysis(rok, miesiac, parseInt(dayStr, 10), String(total));
        daysImported++;
      }
    }

    return daysImported;
  }

  async importWzData(rok: number, miesiac: number, data: Array<{clientId: number; sprzedaz: number}>): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(clientSales)
        .where(and(
          eq(clientSales.rok, rok),
          eq(clientSales.miesiac, miesiac)
        ));

      for (const row of data) {
        await tx.insert(clientSales).values({
          clientId: row.clientId,
          rok,
          miesiac,
          sprzedaz: String(row.sprzedaz),
        });
      }
    });
  }

  async getPlanRealization(rok: number, miesiac: number, opiekun?: string): Promise<any> {
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === rok && (now.getMonth() + 1) === miesiac;
    const isPastMonth = rok < now.getFullYear() || (rok === now.getFullYear() && miesiac < (now.getMonth() + 1));

    const daysInMonth = new Date(rok, miesiac, 0).getDate();
    const dniRoboczeMiesiac = countPolishWorkdays(rok, miesiac, daysInMonth);
    let dniRoboczeMiniete: number;
    if (isCurrentMonth) {
      dniRoboczeMiniete = countPolishWorkdays(rok, miesiac, now.getDate());
    } else if (isPastMonth) {
      dniRoboczeMiniete = dniRoboczeMiesiac;
    } else {
      dniRoboczeMiniete = 0;
    }

    let allClients = await db.select().from(clients).where(eq(clients.aktywny, true));
    if (opiekun) {
      allClients = allClients.filter(c => c.opiekun === opiekun);
    }

    const weeklyData = await db.select().from(clientSalesWeekly)
      .where(and(eq(clientSalesWeekly.rok, rok), eq(clientSalesWeekly.miesiac, miesiac)));
    // Per-client monthly cel: only treat stored weekly plans as the cel
    // when at least one week was explicitly user-set (planUserSet=true).
    // Otherwise the cel falls back to prev_month_realizacja × 1.05 below.
    // This prevents stale auto-generated weekly plans from blocking the rule.
    const weeklyByClient = new Map<number, number>();
    const userSetByClient = new Set<number>();
    for (const w of weeklyData) {
      const curr = weeklyByClient.get(w.clientId) || 0;
      weeklyByClient.set(w.clientId, curr + Number(w.plan || 0));
      if (w.planUserSet) userSetByClient.add(w.clientId);
    }

    const currentSales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, rok), eq(clientSales.miesiac, miesiac)));
    const salesMap = new Map(currentSales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    // Cross-check: compare client_sales.sprzedaz with raw sum of ibiznes_invoices.koszt
    // per client for the same month. If they diverge the aggregator is out of sync.
    const ibiznesRawRows = await db.execute(sql`
      SELECT client_id, COALESCE(SUM(CAST(koszt AS NUMERIC)), 0) AS total
      FROM ibiznes_invoices
      WHERE rok = ${rok} AND miesiac = ${miesiac} AND client_id IS NOT NULL
      GROUP BY client_id
    `);
    const ibiznesMap = new Map<number, number>();
    for (const r of ibiznesRawRows.rows as any[]) {
      ibiznesMap.set(Number(r.client_id), Number(r.total || 0));
    }

    const prevMonth = miesiac === 1 ? 12 : miesiac - 1;
    const prevYear = miesiac === 1 ? rok - 1 : rok;
    const prevSales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, prevYear), eq(clientSales.miesiac, prevMonth)));
    const prevMap = new Map(prevSales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    const rows: any[] = [];
    for (const client of allClients) {
      // Default: prev month realizacja × 1.05.
      // Override: stored weekly plans, but only when explicitly user-set.
      const prevSale = prevMap.get(client.id) || 0;
      const autoCel = prevSale > 0 ? prevSale * 1.05 : 0;
      const userCel = userSetByClient.has(client.id) ? (weeklyByClient.get(client.id) || 0) : 0;
      const cel = userCel > 0 ? userCel : autoCel;

      const realizacja = salesMap.get(client.id) || 0;
      const realizacjaIbiznes = ibiznesMap.get(client.id) || 0;
      // Flag if client_sales differs from raw iBiznes by > 1 PLN (tolerance for rounding).
      const rozjazdIbiznes = Math.abs(realizacja - realizacjaIbiznes) > 1;

      const celNaDzis = dniRoboczeMiesiac > 0 ? (cel / dniRoboczeMiesiac) * dniRoboczeMiniete : 0;
      const roznica = realizacja - celNaDzis;
      const procent = celNaDzis > 0 ? (realizacja / celNaDzis) * 100 : (realizacja > 0 ? 100 : 0);

      rows.push({
        clientId: client.id,
        klient: client.klient,
        opiekun: client.opiekun,
        grupa: client.grupaMvp || "Inne",
        cel: Math.round(cel),
        celNaDzis: Math.round(celNaDzis),
        realizacja: Math.round(realizacja),
        realizacjaIbiznes: Math.round(realizacjaIbiznes),
        rozjazdIbiznes,
        roznica: Math.round(roznica),
        procent: Math.round(procent * 10) / 10,
      });
    }

    rows.sort((a, b) => b.procent - a.procent);

    const sumaCel = rows.reduce((s, r) => s + r.cel, 0);
    const sumaCelNaDzis = rows.reduce((s, r) => s + r.celNaDzis, 0);
    // sumaRealizacja: total company sales for the month, including clients marked as inactive
    // (iBiznes WZ counts regardless of CRM "aktywny" flag)
    let opiekunClientIds: Set<number> | null = null;
    if (opiekun) {
      const opiekunAll = await db.select({ id: clients.id }).from(clients).where(eq(clients.opiekun, opiekun));
      opiekunClientIds = new Set(opiekunAll.map(c => c.id));
    }
    const allMonthSalesRows = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, rok), eq(clientSales.miesiac, miesiac)));
    const matchedRealizacja = allMonthSalesRows
      .filter(r => !opiekunClientIds || opiekunClientIds.has(r.clientId))
      .reduce((s, r) => s + Number(r.sprzedaz || 0), 0);
    // For admin/general view include WZ without a matched client (unknown NIP).
    // For opiekun-specific view we cannot attribute them, so keep only matched.
    let unmatchedRealizacja = 0;
    if (!opiekunClientIds) {
      const unmatchedRow = await db.execute(sql`
        SELECT COALESCE(SUM(CAST(koszt AS NUMERIC)), 0) AS total
        FROM ibiznes_invoices
        WHERE rok = ${rok} AND miesiac = ${miesiac} AND client_id IS NULL
      `);
      unmatchedRealizacja = Number((unmatchedRow.rows[0] as any)?.total || 0);
    }
    const sumaRealizacja = matchedRealizacja + unmatchedRealizacja;

    // --- Cel miesiąca (global) --------------------------------------------------
    // Priority:
    //   1. sales_targets.plan_obrotu if set & > 0  → customowy cel ustawiony przez admina.
    //   2. default = realizacja poprzedniego miesiąca × 1.05 (w tym unmatched WZ dla admin).
    const prevMonthSalesAll = prevSales.reduce((s, r) => s + Number(r.sprzedaz || 0), 0);
    let prevUnmatched = 0;
    if (!opiekunClientIds) {
      const prevUnmatchedRow = await db.execute(sql`
        SELECT COALESCE(SUM(CAST(koszt AS NUMERIC)), 0) AS total
        FROM ibiznes_invoices
        WHERE rok = ${prevYear} AND miesiac = ${prevMonth} AND client_id IS NULL
      `);
      prevUnmatched = Number((prevUnmatchedRow.rows[0] as any)?.total || 0);
    }
    const prevTotalRealizacja = prevMonthSalesAll + prevUnmatched;
    const defaultCelMiesiaca = Math.round(prevTotalRealizacja * 1.05);

    const targetRow = await db.select().from(salesTargets)
      .where(and(eq(salesTargets.rok, rok), eq(salesTargets.miesiac, miesiac)));
    // Custom goal ONLY when an admin explicitly flipped plan_obrotu_custom=true
    // via the "Edytuj cele" UI. Historical/imported plan_obrotu values are
    // treated as auto (derived from prev month × 1.05).
    const hasCustomFlag = targetRow.length > 0 && Boolean(targetRow[0].planObrotuCustom);
    const customCel = hasCustomFlag ? Number(targetRow[0].planObrotu || 0) : 0;
    const celMiesiaca = hasCustomFlag && customCel > 0 ? customCel : defaultCelMiesiaca;
    const celMiesiacaIsCustom = hasCustomFlag && customCel > 0;

    // celNaDzis for the month as a whole uses celMiesiaca (not sum of per-client cel).
    const celMiesiacaNaDzis = dniRoboczeMiesiac > 0
      ? (celMiesiaca / dniRoboczeMiesiac) * dniRoboczeMiniete
      : 0;
    const sumaRoznica = sumaRealizacja - celMiesiacaNaDzis;
    const sumaProcent = celMiesiacaNaDzis > 0 ? (sumaRealizacja / celMiesiacaNaDzis) * 100 : 0;

    const perOpiekun: Record<string, {realizacja: number; celNaDzis: number; cel: number}> = {};
    for (const r of rows) {
      if (!perOpiekun[r.opiekun]) perOpiekun[r.opiekun] = {realizacja: 0, celNaDzis: 0, cel: 0};
      perOpiekun[r.opiekun].realizacja += r.realizacja;
      perOpiekun[r.opiekun].celNaDzis += r.celNaDzis;
      perOpiekun[r.opiekun].cel += r.cel;
    }

    return {
      rows,
      dniRoboczeMiniete,
      dniRoboczeMiesiac,
      sumaCel,
      sumaCelNaDzis: Math.round(sumaCelNaDzis),
      celMiesiaca,
      celMiesiacaIsCustom,
      defaultCelMiesiaca,
      celMiesiacaNaDzis: Math.round(celMiesiacaNaDzis),
      prevMonthRealizacja: Math.round(prevTotalRealizacja),
      sumaRealizacja,
      sumaRoznica: Math.round(sumaRoznica),
      sumaProcent: Math.round(sumaProcent * 10) / 10,
      perOpiekun,
    };
  }

  /**
   * Set or clear the monthly company-level target (cel miesiąca).
   * Pass planObrotu=null to reset to the default (prev month × 1.05) —
   * this also clears the plan_obrotu_custom flag, so the UI stops showing
   * "custom" for this month.
   */
  async setPlanMonthTarget(rok: number, miesiac: number, planObrotu: number | null): Promise<void> {
    const existing = await db.select().from(salesTargets)
      .where(and(eq(salesTargets.rok, rok), eq(salesTargets.miesiac, miesiac)));
    const value = planObrotu == null ? "0" : String(Math.round(planObrotu));
    const isCustom = planObrotu != null && planObrotu > 0;
    if (existing.length > 0) {
      await db.update(salesTargets)
        .set({ planObrotu: value, planObrotuCustom: isCustom })
        .where(and(eq(salesTargets.rok, rok), eq(salesTargets.miesiac, miesiac)));
    } else {
      await db.insert(salesTargets).values({
        rok,
        miesiac,
        planObrotu: value,
        wykonanieObrotu: "0",
        planObrotuCustom: isCustom,
      });
    }
  }

  /**
   * Set the per-client monthly target. Writes 4 weekly rows with plan = cel / 4.
   * Preserves existing `realizacja` and `notatki` when a row already exists.
   */
  async setClientPlanTarget(rok: number, miesiac: number, clientId: number, cel: number): Promise<void> {
    // cel = 0 → reset to auto (+5% rule). Clears the user-set flag and
    // wipes weekly plans so getPlanRealization falls back to prev × 1.05.
    if (!cel || cel <= 0) {
      await db.update(clientSalesWeekly)
        .set({ plan: "0", planUserSet: false })
        .where(and(
          eq(clientSalesWeekly.rok, rok),
          eq(clientSalesWeekly.miesiac, miesiac),
          eq(clientSalesWeekly.clientId, clientId),
        ));
      return;
    }
    const perWeek = String(Math.round((cel / 4) * 100) / 100);
    const existing = await db.select().from(clientSalesWeekly)
      .where(and(
        eq(clientSalesWeekly.rok, rok),
        eq(clientSalesWeekly.miesiac, miesiac),
        eq(clientSalesWeekly.clientId, clientId),
      ));
    if (existing.length > 0) {
      for (const row of existing) {
        await db.update(clientSalesWeekly)
          .set({ plan: perWeek, planUserSet: true })
          .where(eq(clientSalesWeekly.id, row.id));
      }
      for (let t = existing.length + 1; t <= 4; t++) {
        await db.insert(clientSalesWeekly).values({
          clientId, rok, miesiac, tydzien: t, plan: perWeek, realizacja: "0", planUserSet: true,
        });
      }
    } else {
      for (let t = 1; t <= 4; t++) {
        await db.insert(clientSalesWeekly).values({
          clientId, rok, miesiac, tydzien: t, plan: perWeek, realizacja: "0", planUserSet: true,
        });
      }
    }
  }

  /**
   * 3-layer data verification for the Plan page (admin, read-only).
   *
   *   A) client_sales.sprzedaz       ← what the plan UI displays
   *   B) SUM(ibiznes_invoices.koszt) ← our local WZ cache (aggregator input)
   *   C) SUM(fetchIbiznesInvoices)   ← raw WZ straight from iBiznes MySQL
   *
   * Mismatch between A and B = aggregation drift (run Synchronizuj teraz).
   * Mismatch between B and C = sync drift (run Synchronizuj teraz to refresh cache).
   *
   * Tolerance: 1 PLN (covers rounding).
   */
  async verifyPlanData(rok: number, miesiac: number): Promise<{
    rok: number;
    miesiac: number;
    ok: boolean;
    counts: { total: number; ok: number; aggMismatch: number; syncMismatch: number; missingClient: number };
    totals: { clientSales: number; ibiznesInvoices: number; ibiznesLive: number };
    rows: Array<{
      clientId: number;
      klient: string;
      nip: string | null;
      alias: string | null;
      a_clientSales: number;
      b_ibiznesInvoices: number;
      c_ibiznesLive: number;
      liveWzCount: number;
      cachedWzCount: number;
      diffAB: number;
      diffBC: number;
      status: "ok" | "agg_mismatch" | "sync_mismatch" | "both_mismatch";
    }>;
    unmatchedLive: {
      sum: number;
      count: number;
      topNips: Array<{ nip: string; alias: string | null; sum: number; count: number }>;
    };
  }> {
    const { fetchIbiznesInvoices } = await import("./ibiznes");
    const firstDay = `${rok}-${String(miesiac).padStart(2, "0")}-01`;

    // 1) Fetch raw WZ from iBiznes LIVE for the month in question.
    // fetchIbiznesInvoices returns all WZ from sinceDate forward; we filter to this month.
    const liveAll = await fetchIbiznesInvoices(firstDay);
    const live = liveAll.filter((w) => {
      const [y, m] = w.dataWyst.split("-").map(Number);
      return y === rok && m === miesiac;
    });

    // 2) Build client maps (NIP → id, alias → id) — exactly the same way runIbiznesSync does.
    const allClients = await db
      .select({ id: clients.id, nip: clients.nip, klient: clients.klient, ibiznesAlias: clients.ibiznesAlias })
      .from(clients);
    const normalizeNip = (n: string | null | undefined) => (n ? n.replace(/[-\s]/g, "").trim() : "");
    const normalizeAlias = (s: string) =>
      s.toLowerCase().replace(/[–—-]/g, " ").replace(/\s+/g, " ").trim();
    const nipToClientId = new Map<string, number>();
    const aliasToClientId = new Map<string, number>();
    const clientById = new Map<number, { id: number; nip: string | null; klient: string; ibiznesAlias: string | null }>();
    for (const c of allClients) {
      clientById.set(c.id, c);
      if (c.nip) nipToClientId.set(normalizeNip(c.nip), c.id);
      if (c.ibiznesAlias) aliasToClientId.set(normalizeAlias(c.ibiznesAlias), c.id);
      if (c.klient) aliasToClientId.set(normalizeAlias(c.klient), c.id);
    }
    // Additional NIPs (multi-NIP clients, e.g. school + gmina).
    const extraNips = await db.select().from(clientNips);
    for (const cn of extraNips) {
      const norm = normalizeNip(cn.nip);
      if (norm) nipToClientId.set(norm, cn.clientId);
    }

    // 3) Per-client aggregates from iBiznes LIVE.
    const liveSum = new Map<number, number>();
    const liveCount = new Map<number, number>();
    const unmatchedLiveByKey = new Map<string, { nip: string; alias: string | null; sum: number; count: number }>();
    let unmatchedLiveSum = 0;
    let unmatchedLiveCount = 0;
    for (const w of live) {
      let cid = w.nip ? nipToClientId.get(w.nip) : undefined;
      if (cid == null && w.alias) cid = aliasToClientId.get(normalizeAlias(w.alias));
      if (cid != null) {
        liveSum.set(cid, (liveSum.get(cid) || 0) + Number(w.koszt || 0));
        liveCount.set(cid, (liveCount.get(cid) || 0) + 1);
      } else {
        unmatchedLiveSum += Number(w.koszt || 0);
        unmatchedLiveCount += 1;
        const key = (w.nip || w.alias || "unknown").toLowerCase();
        const entry = unmatchedLiveByKey.get(key) || { nip: w.nip || "", alias: w.alias || null, sum: 0, count: 0 };
        entry.sum += Number(w.koszt || 0);
        entry.count += 1;
        unmatchedLiveByKey.set(key, entry);
      }
    }

    // 4) Per-client aggregates from local DB: client_sales & ibiznes_invoices.
    const salesRows = await db
      .select()
      .from(clientSales)
      .where(and(eq(clientSales.rok, rok), eq(clientSales.miesiac, miesiac)));
    const salesMap = new Map<number, number>();
    for (const s of salesRows) salesMap.set(s.clientId, Number(s.sprzedaz || 0));

    const cacheRows = await db.execute(sql`
      SELECT client_id,
             COALESCE(SUM(CAST(koszt AS NUMERIC)), 0) AS total,
             COUNT(*)::int                           AS cnt
      FROM ibiznes_invoices
      WHERE rok = ${rok} AND miesiac = ${miesiac} AND client_id IS NOT NULL
      GROUP BY client_id
    `);
    const cacheSum = new Map<number, number>();
    const cacheCount = new Map<number, number>();
    for (const r of cacheRows.rows as any[]) {
      cacheSum.set(Number(r.client_id), Number(r.total || 0));
      cacheCount.set(Number(r.client_id), Number(r.cnt || 0));
    }

    // 5) Union of all client IDs that appear in ANY layer — so we catch missing ones too.
    const touchedIds = new Set<number>([
      ...liveSum.keys(),
      ...salesMap.keys(),
      ...cacheSum.keys(),
    ]);

    const TOLERANCE = 1;
    const rows: Array<any> = [];
    let okCount = 0, aggMismatch = 0, syncMismatch = 0, missingClient = 0;

    for (const cid of touchedIds) {
      const client = clientById.get(cid);
      if (!client) {
        missingClient += 1;
        continue;
      }
      const a = Math.round(salesMap.get(cid) || 0);
      const b = Math.round(cacheSum.get(cid) || 0);
      const c = Math.round(liveSum.get(cid) || 0);
      const diffAB = a - b;
      const diffBC = b - c;
      const aggBad = Math.abs(diffAB) > TOLERANCE;
      const syncBad = Math.abs(diffBC) > TOLERANCE;
      let status: "ok" | "agg_mismatch" | "sync_mismatch" | "both_mismatch" = "ok";
      if (aggBad && syncBad) status = "both_mismatch";
      else if (aggBad) status = "agg_mismatch";
      else if (syncBad) status = "sync_mismatch";

      if (status === "ok") okCount += 1;
      else if (status === "agg_mismatch") aggMismatch += 1;
      else if (status === "sync_mismatch") syncMismatch += 1;
      else { aggMismatch += 1; syncMismatch += 1; }

      rows.push({
        clientId: cid,
        klient: client.klient,
        nip: client.nip,
        alias: client.ibiznesAlias,
        a_clientSales: a,
        b_ibiznesInvoices: b,
        c_ibiznesLive: c,
        liveWzCount: liveCount.get(cid) || 0,
        cachedWzCount: cacheCount.get(cid) || 0,
        diffAB,
        diffBC,
        status,
      });
    }

    // Show mismatches first, then sorted by |diffBC| desc (sync drift is more urgent).
    rows.sort((x, y) => {
      if (x.status === "ok" && y.status !== "ok") return 1;
      if (y.status === "ok" && x.status !== "ok") return -1;
      return Math.abs(y.diffBC) - Math.abs(x.diffBC) || Math.abs(y.diffAB) - Math.abs(x.diffAB);
    });

    const totalsClientSales = Array.from(salesMap.values()).reduce((s, n) => s + n, 0);
    const totalsCache = Array.from(cacheSum.values()).reduce((s, n) => s + n, 0);
    const totalsLive = Array.from(liveSum.values()).reduce((s, n) => s + n, 0);

    const topUnmatched = Array.from(unmatchedLiveByKey.values())
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 20);

    return {
      rok,
      miesiac,
      ok: rows.every((r) => r.status === "ok"),
      counts: {
        total: rows.length,
        ok: okCount,
        aggMismatch,
        syncMismatch,
        missingClient,
      },
      totals: {
        clientSales: Math.round(totalsClientSales),
        ibiznesInvoices: Math.round(totalsCache),
        ibiznesLive: Math.round(totalsLive),
      },
      rows,
      unmatchedLive: {
        sum: Math.round(unmatchedLiveSum),
        count: unmatchedLiveCount,
        topNips: topUnmatched.map((e) => ({ ...e, sum: Math.round(e.sum) })),
      },
    };
  }

  async importFinanceData(miesiac: number, salariesData: Array<any>, costsData: Array<any>, fleetData: Array<any>, replaceMonth: boolean): Promise<{salaries: number; costs: number; fleet: number}> {
    const MONTH_KEYS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paz", "lis", "gru"];
    const mKey = MONTH_KEYS[miesiac - 1];

    if (replaceMonth) {
      const allSalaries = await db.select().from(salaries);
      for (const s of allSalaries) {
        const am = (s.aktywnyMiesiace as Record<string, boolean>) || {};
        if (am[mKey] !== false) {
          am[mKey] = false;
          await db.update(salaries).set({ aktywnyMiesiace: am }).where(eq(salaries.id, s.id));
        }
      }
      const allCosts = await db.select().from(costs);
      for (const c of allCosts) {
        const am = (c.aktywnyMiesiace as Record<string, boolean>) || {};
        if (am[mKey] !== false) {
          am[mKey] = false;
          await db.update(costs).set({ aktywnyMiesiace: am }).where(eq(costs.id, c.id));
        }
      }
      const allFleet = await db.select().from(fleet);
      for (const f of allFleet) {
        const am = (f.aktywnyMiesiace as Record<string, boolean>) || {};
        if (am[mKey] !== false) {
          am[mKey] = false;
          await db.update(fleet).set({ aktywnyMiesiace: am }).where(eq(fleet.id, f.id));
        }
      }
    }

    let salCount = 0;
    for (const s of salariesData) {
      const am: Record<string, boolean> = {};
      am[mKey] = true;
      await db.insert(salaries).values({
        osoba: s.osoba || "Nieznany",
        firma: s.firma || "",
        dzial: s.dzial || "",
        formaZatrudnienia: s.formaZatrudnienia || null,
        netto: s.netto ? String(s.netto) : null,
        brutto: s.brutto ? String(s.brutto) : null,
        vat: s.vat ? String(s.vat) : null,
        kosztPracodawcy: s.kosztPracodawcy ? String(s.kosztPracodawcy) : null,
        aktywnyMiesiace: am,
      });
      salCount++;
    }

    let costCount = 0;
    for (const c of costsData) {
      const am: Record<string, boolean> = {};
      am[mKey] = true;
      await db.insert(costs).values({
        nazwa: c.nazwa || "Bez nazwy",
        firma: c.firma || null,
        dzial: c.dzial || null,
        rodzaj: c.rodzaj || null,
        kategoria: c.kategoria || "Operacyjne",
        netto: c.netto ? String(c.netto) : null,
        koszt: c.koszt ? String(c.koszt) : null,
        notatka: c.notatka || null,
        aktywnyMiesiace: am,
      });
      costCount++;
    }

    let fleetCount = 0;
    for (const f of fleetData) {
      const am: Record<string, boolean> = {};
      am[mKey] = true;
      await db.insert(fleet).values({
        opis: f.opis || "Bez opisu",
        firma: f.firma || null,
        dzial: f.dzial || null,
        rodzaj: f.rodzaj || null,
        netto: f.netto ? String(f.netto) : null,
        koszt: f.koszt ? String(f.koszt) : null,
        aktywnyMiesiace: am,
      });
      fleetCount++;
    }

    return { salaries: salCount, costs: costCount, fleet: fleetCount };
  }

  async importVATCosts(miesiac: number, mKey: string, costsData: Array<any>): Promise<{imported: number}> {
    await db.delete(costs).where(
      and(
        eq(costs.firma, "IMPORT_VAT"),
        sql`aktywny_miesiace->>${mKey} = 'true'`
      )
    );

    let imported = 0;
    for (const c of costsData) {
      const am: Record<string, boolean> = {};
      am[mKey] = true;
      await db.insert(costs).values({
        nazwa: c.nazwa || "Bez nazwy",
        firma: "IMPORT_VAT",
        dzial: c.kategoria || null,
        rodzaj: c.rodzaj || null,
        kategoria: c.kategoria || "Inne",
        netto: c.netto ? String(c.netto) : null,
        koszt: c.koszt ? String(c.koszt) : null,
        notatka: c.notatka || null,
        aktywnyMiesiace: am,
      });
      imported++;
    }

    return { imported };
  }

  async importKsefTemplate(
    fileBuffer: Buffer,
    opts: { replace: boolean }
  ): Promise<{
    imported: number;
    skipped: number;
    total: number;
    byKategoria: Record<string, { count: number; sum: number }>;
    skippedDetails: Array<{ reason: string; klient: string; nrFaktury: string; akcja: string }>;
  }> {
    const { parseKsefKosztoweRows, ALL_MONTHS_TRUE, KSEF_TEMPLATE_FIRMA } = await import("./ksefTemplate");
    const parsed = parseKsefKosztoweRows(fileBuffer);

    if (opts.replace) {
      await db.delete(costs).where(eq(costs.firma, KSEF_TEMPLATE_FIRMA));
    }

    const byKategoria: Record<string, { count: number; sum: number }> = {};
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
      if (!byKategoria[e.kategoria]) byKategoria[e.kategoria] = { count: 0, sum: 0 };
      byKategoria[e.kategoria].count++;
      byKategoria[e.kategoria].sum += e.brutto;
    }

    return {
      imported: parsed.entries.length,
      skipped: parsed.skipped.length,
      total: parsed.entries.reduce((s, e) => s + e.brutto, 0),
      byKategoria,
      skippedDetails: parsed.skipped,
    };
  }
}

export const storage = new DatabaseStorage();
