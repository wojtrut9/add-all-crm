import { db } from "./db";
import { eq, and, gte, lte, sql, like, ilike, or, desc, asc } from "drizzle-orm";
import {
  users, clients, contacts, deliveries, drivers, vehicles,
  clientSales, clientSalesWeekly, salesTargets, salaries, costs,
  fleet, notes, salesHistory, dailyAnalysis,
  type InsertUser, type User,
  type InsertClient, type Client,
  type InsertContact, type Contact,
  type InsertDelivery, type Delivery,
  type InsertNote, type Note,
  type InsertSalary, type InsertCost, type InsertFleet,
  type Cost, type DailyAnalysis,
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

  getContacts(from?: string, to?: string, opiekun?: string): Promise<any[]>;
  getContactsForToday(opiekun?: string): Promise<any[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, data: Partial<Contact>): Promise<void>;
  getContact(id: number): Promise<Contact | undefined>;

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
  getMySales(opiekun: string): Promise<any>;
  getPlanData(rok: number, miesiac: number, opiekun?: string): Promise<any>;
  updateWeeklyPlan(id: number, realizacja: number): Promise<void>;
  updateWeeklyNotatki(clientId: number, rok: number, miesiac: number, notatki: string): Promise<void>;

  getNotes(autor?: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;

  getDashboardStats(opiekun?: string, rola?: string): Promise<any>;

  getDailyAnalysis(rok: number, miesiac: number): Promise<DailyAnalysis[]>;
  getDniRobocze(rok: number, miesiac: number): Promise<number>;
  upsertDailyAnalysis(rok: number, miesiac: number, dzien: number, sprzedaz: string | null): Promise<DailyAnalysis>;
  updateDniRobocze(rok: number, miesiac: number, dniRobocze: number): Promise<void>;
  getMonthlyFixedCosts(miesiac: number): Promise<number>;
  importDailySalesFromContacts(rok: number, miesiac: number): Promise<number>;
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
      })
      .from(clientSales)
      .where(and(eq(clientSales.rok, prevRok), eq(clientSales.miesiac, prevMiesiac)));

    const prevSalesMap = new Map<number, number>();
    for (const ps of prevSalesData) {
      prevSalesMap.set(ps.clientId, Number(ps.sprzedaz || 0));
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
      grupyMap[name] = { klientow: 0, aktywnych: 0, sprzedaz: 0, koszt: 0, zysk: 0, prevSprzedaz: 0, klienci: [] };
    }

    for (const client of allClients) {
      const matchKey = matchGrupa(client.grupaMvp);
      if (!grupyMap[matchKey]) grupyMap[matchKey] = { klientow: 0, aktywnych: 0, sprzedaz: 0, koszt: 0, zysk: 0, prevSprzedaz: 0, klienci: [] };

      const sale = salesMap.get(client.id);
      const sprzedaz = sale ? Number(sale.sprzedaz || 0) : 0;
      const koszt = sale ? Number(sale.koszt || 0) : 0;
      const zysk = sale ? Number(sale.zysk || 0) : 0;
      const marza = sale ? Number(sale.marza || 0) : 0;
      const prevSp = prevSalesMap.get(client.id) || 0;

      grupyMap[matchKey].klientow++;
      if (sprzedaz > 0) grupyMap[matchKey].aktywnych++;
      grupyMap[matchKey].sprzedaz += sprzedaz;
      grupyMap[matchKey].koszt += koszt;
      grupyMap[matchKey].zysk += zysk;
      grupyMap[matchKey].prevSprzedaz += prevSp;

      if (sale) {
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
          zmiana,
          klienci: v.klienci,
        };
      });

    return { groups, prevMiesiac, prevRok };
  }

  async getSalesDashboard(): Promise<any> {
    const targets = await db.select().from(salesTargets).where(eq(salesTargets.rok, 2026)).orderBy(asc(salesTargets.miesiac));
    const historyData = await db.select().from(salesHistory).orderBy(asc(salesHistory.rok), asc(salesHistory.miesiac));

    const historyByYear: Record<number, any[]> = {};
    for (const h of historyData) {
      if (!historyByYear[h.rok]) historyByYear[h.rok] = [];
      historyByYear[h.rok].push(h);
    }

    const history = Object.entries(historyByYear).map(([rok, months]) => ({
      rok: Number(rok),
      months: months.map(m => ({ miesiac: m.miesiac, wartosc: Number(m.wartosc) })),
    }));

    return {
      plan2026: targets.map(t => ({
        miesiac: t.miesiac,
        planObrotu: Number(t.planObrotu || 0),
        wykonanieObrotu: Number(t.wykonanieObrotu || 0),
      })),
      history,
    };
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
        return am[mKey] !== false;
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
      })
      .from(contacts)
      .leftJoin(clients, eq(contacts.clientId, clients.id))
      .where(and(
        eq(contacts.opiekun, opiekun),
        eq(contacts.status, "Zamowil"),
      ))
      .orderBy(desc(contacts.data))
      .limit(20);

    return { monthSales, prevMonthSales, monthTarget, recentOrders };
  }

  async getPlanData(rok: number, miesiac: number, opiekun?: string): Promise<any> {
    const prevMonth = miesiac === 1 ? 12 : miesiac - 1;
    const prevYear = miesiac === 1 ? rok - 1 : rok;

    const weeklyData = await db.select().from(clientSalesWeekly)
      .where(and(eq(clientSalesWeekly.rok, rok), eq(clientSalesWeekly.miesiac, miesiac)));

    const clientIds = [...new Set(weeklyData.map(w => w.clientId))];
    if (clientIds.length === 0) return { groups: [] };

    let allClients = await db.select().from(clients);
    if (opiekun) {
      allClients = allClients.filter(c => c.opiekun === opiekun);
    }
    const clientMap = new Map(allClients.map(c => [c.id, c]));

    const prevSales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, prevYear), eq(clientSales.miesiac, prevMonth)));
    const prevSalesMap = new Map(prevSales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    const currentSales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, rok), eq(clientSales.miesiac, miesiac)));
    const currentSalesMap = new Map(currentSales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    const sty26Sales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, 2026), eq(clientSales.miesiac, 1)));
    const sty26Map = new Map(sty26Sales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    const gru25Sales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, 2025), eq(clientSales.miesiac, 12)));
    const gru25Map = new Map(gru25Sales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

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
      sty26: number;
      cel: number;
      tydz1: number;
      tydz2: number;
      tydz3: number;
      tydz4: number;
      weeklyIds: number[];
      srTyg: number;
      gru25: number;
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

    for (const [cid, weeks] of weeklyByClient) {
      const client = clientMap.get(cid);
      if (!client) continue;

      const grupa = matchGrupa(client.grupaMvp);
      if (!grupyMap[grupa]) grupyMap[grupa] = [];

      const cel = Number(weeks[0]?.plan || 0);
      const sty26 = sty26Map.get(cid) || 0;
      const gru25 = gru25Map.get(cid) || 0;
      const srTyg = sty26 > 0 ? sty26 / 4.3 : 0;

      const weekVals: Record<number, { realizacja: number; id: number }> = {};
      for (const w of weeks) {
        weekVals[w.tydzien] = { realizacja: Number(w.realizacja || 0), id: w.id };
      }

      grupyMap[grupa].push({
        clientId: cid,
        klient: client.klient,
        rabat: client.rabatProcent ? Number(client.rabatProcent) : null,
        sty26,
        cel,
        tydz1: weekVals[1]?.realizacja || 0,
        tydz2: weekVals[2]?.realizacja || 0,
        tydz3: weekVals[3]?.realizacja || 0,
        tydz4: weekVals[4]?.realizacja || 0,
        weeklyIds: [weekVals[1]?.id || 0, weekVals[2]?.id || 0, weekVals[3]?.id || 0, weekVals[4]?.id || 0],
        srTyg: Math.round(srTyg * 100) / 100,
        gru25,
        notatki: weeks[0]?.notatki || null,
        status: weeks[0]?.status || null,
      });
    }

    const groups = grupyOrder
      .filter(name => grupyMap[name] && grupyMap[name].length > 0)
      .map(name => ({
        grupa: name,
        klienci: grupyMap[name].sort((a, b) => b.sty26 - a.sty26),
      }));

    return { groups };
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

  async getDashboardStats(opiekun?: string, rola?: string): Promise<any> {
    const allClients = await db.select().from(clients);
    const filteredClients = opiekun && rola === "handlowiec" ? allClients.filter(c => c.opiekun === opiekun) : allClients;

    const activeClients = filteredClients.filter(c => c.aktywny).length;
    const alertClients = filteredClients.filter(c => (c.brakiZamowien || 0) >= 2).length;

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    const todayContactsCount = (await this.getContacts(today, today, rola === "handlowiec" ? opiekun : undefined)).length;
    const tomorrowDeliveriesCount = (await this.getDeliveries(tomorrow)).length;

    const now = new Date();
    const currentTargets = await db.select().from(salesTargets)
      .where(and(eq(salesTargets.rok, now.getFullYear()), eq(salesTargets.miesiac, now.getMonth() + 1)));

    const monthPlan = currentTargets.length > 0 ? Number(currentTargets[0].planObrotu || 0) : 0;

    const year = now.getFullYear();
    const month = now.getMonth();
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;

    const allMonthContacts = await db.select().from(contacts)
      .where(and(gte(contacts.data, monthStart), lte(contacts.data, monthEnd)));

    const monthSales = allMonthContacts
      .filter(c => c.status === "Zamowil")
      .reduce((sum, c) => sum + Number(c.kwota || 0), 0);

    const getWorkingDaysPassed = () => {
      let count = 0;
      const d = new Date(year, month, 1);
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      while (d <= todayDate) {
        const day = d.getDay();
        if (day >= 1 && day <= 5) count++;
        d.setDate(d.getDate() + 1);
      }
      return count;
    };
    const workingDaysPassed = getWorkingDaysPassed();
    const dailyTarget = monthPlan / 20;
    const expectedSales = dailyTarget * workingDaysPassed;

    const mondayOfWeek = new Date(now);
    const dayOfWeek = mondayOfWeek.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    mondayOfWeek.setDate(mondayOfWeek.getDate() + diff);
    const fridayOfWeek = new Date(mondayOfWeek);
    fridayOfWeek.setDate(fridayOfWeek.getDate() + 4);

    const weekStart = mondayOfWeek.toISOString().split("T")[0];
    const weekEnd = fridayOfWeek.toISOString().split("T")[0];

    const weekContacts = await db.select().from(contacts)
      .where(and(gte(contacts.data, weekStart), lte(contacts.data, weekEnd)));

    const weeklyOrders = ["Gosia", "Magda"].map(name => {
      const hClients = allClients.filter(c => c.opiekun === name && c.aktywny
        && (c.grupaMvp?.includes("Premium") || c.grupaMvp?.includes("Standard")));
      const hContacts = weekContacts.filter(c => c.opiekun === name);
      const ordered = hContacts.filter(c => c.status === "Zamowil").length;
      const contacted = hContacts.filter(c => c.status && c.status !== "Do zrobienia").length;
      return {
        name,
        totalClients: hClients.length,
        totalContacts: hContacts.length,
        contacted,
        ordered,
      };
    });

    let handlowcy: any[] | undefined;
    if (rola === "admin") {
      const handlers = ["Gosia", "Magda"];
      handlowcy = handlers.map(name => {
        const hClients = allClients.filter(c => c.opiekun === name);
        const hActive = hClients.filter(c => c.aktywny);
        const hAlerts = hClients.filter(c => (c.brakiZamowien || 0) >= 2);
        const premiumCount = hClients.filter(c => c.grupaMvp?.includes("Premium")).length;
        const standardCount = hClients.filter(c => c.grupaMvp?.includes("Standard")).length;
        const weryfikacjaCount = hClients.filter(c => c.grupaMvp?.includes("Weryfikacja")).length;
        const inneCount = hClients.filter(c => c.grupaMvp === "Inne").length;
        return {
          name,
          totalClients: hClients.length,
          activeClients: hActive.length,
          alertClients: hAlerts.length,
          premiumClients: premiumCount,
          standardClients: standardCount,
          weryfikacjaClients: weryfikacjaCount,
          inneClients: inneCount,
        };
      });
    }

    return {
      totalClients: filteredClients.length,
      activeClients,
      alertClients,
      todayContacts: todayContactsCount,
      tomorrowDeliveries: tomorrowDeliveriesCount,
      monthPlan,
      monthSales,
      workingDaysPassed,
      expectedSales,
      dailyTarget,
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
}

export const storage = new DatabaseStorage();
