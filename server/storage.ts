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
  getAvailablePlanMonths(): Promise<Array<{rok: number; miesiac: number}>>;
  updateWeeklyPlan(id: number, realizacja: number): Promise<void>;
  updateWeeklyNotatki(clientId: number, rok: number, miesiac: number, notatki: string): Promise<void>;

  getNotes(autor?: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;

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
  importDailySalesFromContacts(rok: number, miesiac: number): Promise<number>;

  importWzData(rok: number, miesiac: number, data: Array<{clientId: number; sprzedaz: number}>, addToExisting: boolean): Promise<void>;
  getPlanRealization(rok: number, miesiac: number, opiekun?: string): Promise<any>;
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
        koszt: clientSales.koszt,
        zysk: clientSales.zysk,
        marza: clientSales.marza,
      })
      .from(clientSales)
      .where(and(eq(clientSales.rok, prevRok), eq(clientSales.miesiac, prevMiesiac)));

    const prevSalesMap = new Map<number, { sprzedaz: number; koszt: number; zysk: number; marza: number }>();
    for (const ps of prevSalesData) {
      prevSalesMap.set(ps.clientId, {
        sprzedaz: Number(ps.sprzedaz || 0),
        koszt: Number(ps.koszt || 0),
        zysk: Number(ps.zysk || 0),
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

    return { groups, prevMiesiac, prevRok, prevTotalSales, prevTotalCost, prevTotalProfit, prevTotalMarza };
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
    for (const [, val] of clientTotals) {
      if (val.total > maxTotal) {
        maxTotal = val.total;
        bestClient = { name: val.name, kwota: val.total };
      }
    }

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

      grupyMap[grupa].push({
        clientId: cid,
        klient: client.klient,
        rabat: client.rabatProcent ? Number(client.rabatProcent) : null,
        prev1: prev1Val,
        prev2: prev2Val,
        cel,
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

      const weeklyPlan = String(row.cel / 4);
      for (let tydzien = 1; tydzien <= 4; tydzien++) {
        await db.insert(clientSalesWeekly).values({
          clientId,
          rok,
          miesiac,
          tydzien,
          plan: weeklyPlan,
          realizacja: "0",
        });
      }
      imported++;
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
    if (data.planObrotu !== undefined) updateData.planObrotu = String(data.planObrotu);
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
      const existing = await db.select().from(salesTargets)
        .where(and(eq(salesTargets.rok, rok), eq(salesTargets.miesiac, t.miesiac)));
      if (existing.length > 0) {
        await db.update(salesTargets)
          .set({ planObrotu: String(t.planObrotu) })
          .where(and(eq(salesTargets.rok, rok), eq(salesTargets.miesiac, t.miesiac)));
      } else {
        await db.insert(salesTargets).values({
          rok,
          miesiac: t.miesiac,
          planObrotu: String(t.planObrotu),
          wykonanieObrotu: "0",
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

    const allClients = await db.select().from(clients).where(eq(clients.aktywny, true));

    const prevSales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, prevYear), eq(clientSales.miesiac, prevMonth)));
    const prevMap = new Map(prevSales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    const prev2Sales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, prev2Year), eq(clientSales.miesiac, prev2Month)));
    const prev2Map = new Map(prev2Sales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    const prev3Sales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, prev3Year), eq(clientSales.miesiac, prev3Month)));
    const prev3Map = new Map(prev3Sales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    let generated = 0;
    let skipped = 0;

    for (const client of allClients) {
      let baseSales = prevMap.get(client.id) || 0;

      if (baseSales === 0) {
        const vals = [prev2Map.get(client.id) || 0, prev3Map.get(client.id) || 0].filter(v => v > 0);
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
          clientId: client.id,
          rok,
          miesiac,
          tydzien,
          plan: weeklyPlan,
          realizacja: "0",
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

    const countWorkdays = (y: number, m: number, upToDay: number) => {
      let count = 0;
      for (let d = 1; d <= upToDay; d++) {
        const dow = new Date(y, m, d).getDay();
        if (dow >= 1 && dow <= 5) count++;
      }
      return count;
    };
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalWorkdays = countWorkdays(year, month, daysInMonth);
    const workingDaysPassed = countWorkdays(year, month, now.getDate());
    const dailyTarget = totalWorkdays > 0 ? monthPlan / totalWorkdays : 0;
    const expectedSales = dailyTarget * workingDaysPassed;
    const tempo = workingDaysPassed > 0 ? monthSales / workingDaysPassed : 0;
    const prognoza = tempo * totalWorkdays;
    const prognozaOnTrack = prognoza >= monthPlan;

    const uniqueOrderedClients = new Set(allMonthContacts.filter(c => c.status === "Zamowil").map(c => c.clientId)).size;
    const spadkiSprzedazy = allClients.filter(c => c.aktywny && (c as any).spadekSprzedazy).length;

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

  async importWzData(rok: number, miesiac: number, data: Array<{clientId: number; sprzedaz: number}>, addToExisting: boolean): Promise<void> {
    for (const row of data) {
      const existing = await db.select().from(clientSales)
        .where(and(
          eq(clientSales.clientId, row.clientId),
          eq(clientSales.rok, rok),
          eq(clientSales.miesiac, miesiac)
        ));

      if (existing.length > 0) {
        const newVal = addToExisting ? Number(existing[0].sprzedaz || 0) + row.sprzedaz : row.sprzedaz;
        await db.update(clientSales)
          .set({ sprzedaz: String(newVal) })
          .where(eq(clientSales.id, existing[0].id));
      } else {
        await db.insert(clientSales).values({
          clientId: row.clientId,
          rok,
          miesiac,
          sprzedaz: String(row.sprzedaz),
        });
      }
    }
  }

  async getPlanRealization(rok: number, miesiac: number, opiekun?: string): Promise<any> {
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === rok && (now.getMonth() + 1) === miesiac;
    const isPastMonth = rok < now.getFullYear() || (rok === now.getFullYear() && miesiac < (now.getMonth() + 1));

    const countWorkdays = (y: number, m: number, upToDay: number) => {
      let count = 0;
      for (let d = 1; d <= upToDay; d++) {
        const dow = new Date(y, m - 1, d).getDay();
        if (dow >= 1 && dow <= 5) count++;
      }
      return count;
    };

    const daysInMonth = new Date(rok, miesiac, 0).getDate();
    const dniRoboczeMiesiac = countWorkdays(rok, miesiac, daysInMonth);
    let dniRoboczeMiniete: number;
    if (isCurrentMonth) {
      dniRoboczeMiniete = countWorkdays(rok, miesiac, now.getDate());
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
    const weeklyByClient = new Map<number, number>();
    for (const w of weeklyData) {
      if (!weeklyByClient.has(w.clientId)) {
        weeklyByClient.set(w.clientId, Number(w.plan || 0));
      }
    }

    const currentSales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, rok), eq(clientSales.miesiac, miesiac)));
    const salesMap = new Map(currentSales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    const prevMonth = miesiac === 1 ? 12 : miesiac - 1;
    const prevYear = miesiac === 1 ? rok - 1 : rok;
    const prevSales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, prevYear), eq(clientSales.miesiac, prevMonth)));
    const prevMap = new Map(prevSales.map(s => [s.clientId, Number(s.sprzedaz || 0)]));

    const rows: any[] = [];
    for (const client of allClients) {
      let cel = weeklyByClient.get(client.id) || 0;
      if (cel === 0) {
        const prevSale = prevMap.get(client.id) || 0;
        if (prevSale > 0) cel = prevSale * 1.05;
      }

      const realizacja = salesMap.get(client.id) || 0;
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
        roznica: Math.round(roznica),
        procent: Math.round(procent * 10) / 10,
      });
    }

    rows.sort((a, b) => b.procent - a.procent);

    const sumaCel = rows.reduce((s, r) => s + r.cel, 0);
    const sumaCelNaDzis = rows.reduce((s, r) => s + r.celNaDzis, 0);
    const sumaRealizacja = rows.reduce((s, r) => s + r.realizacja, 0);
    const sumaRoznica = sumaRealizacja - sumaCelNaDzis;
    const sumaProcent = sumaCelNaDzis > 0 ? (sumaRealizacja / sumaCelNaDzis) * 100 : 0;

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
      sumaRealizacja,
      sumaRoznica: Math.round(sumaRoznica),
      sumaProcent: Math.round(sumaProcent * 10) / 10,
      perOpiekun,
    };
  }
}

export const storage = new DatabaseStorage();
