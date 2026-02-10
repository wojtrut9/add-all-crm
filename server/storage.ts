import { db } from "./db";
import { eq, and, gte, lte, sql, like, ilike, or, desc, asc } from "drizzle-orm";
import {
  users, clients, contacts, deliveries, drivers, vehicles,
  clientSales, clientSalesWeekly, salesTargets, salaries, costs,
  fleet, notes, salesHistory,
  type InsertUser, type User,
  type InsertClient, type Client,
  type InsertContact, type Contact,
  type InsertDelivery, type Delivery,
  type InsertNote, type Note,
  type InsertSalary, type InsertCost, type InsertFleet,
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getClients(opiekun?: string): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, data: Partial<Client>): Promise<void>;

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
  getFinanceData(): Promise<any>;
  getMySales(opiekun: string): Promise<any>;
  getPlanData(rok: number, miesiac: number, opiekun?: string): Promise<any>;

  getNotes(autor?: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;

  getDashboardStats(opiekun?: string, rola?: string): Promise<any>;
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

  async createClient(client: InsertClient): Promise<Client> {
    const [created] = await db.insert(clients).values(client).returning();
    return created;
  }

  async updateClient(id: number, data: Partial<Client>): Promise<void> {
    await db.update(clients).set(data).where(eq(clients.id, id));
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

    const allClients = await db.select().from(clients);

    const grupyMap: Record<string, { klientow: number; aktywnych: number; sprzedaz: number; koszt: number; zysk: number }> = {};
    const grupyNames = ["Gosia Premium", "Magda Premium", "Magda Standard", "Weryfikacja - zostana", "Weryfikacja - odejda", "Inne"];

    for (const name of grupyNames) {
      grupyMap[name] = { klientow: 0, aktywnych: 0, sprzedaz: 0, koszt: 0, zysk: 0 };
    }

    for (const client of allClients) {
      const grupa = client.grupaMvp || "Inne";
      const key = grupyNames.find(g => grupa.includes(g.replace("Weryfikacja - zostana", "zostana").replace("Weryfikacja - odejda", "odejda").replace("Gosia Premium", "Gosia Premium").replace("Magda Premium", "Magda Premium").replace("Magda Standard", "Magda Standard"))) || "Inne";

      let matchKey = "Inne";
      if (grupa.includes("Gosia") && grupa.includes("Premium")) matchKey = "Gosia Premium";
      else if (grupa.includes("Magda") && grupa.includes("Premium")) matchKey = "Magda Premium";
      else if (grupa.includes("Magda") && grupa.includes("Standard")) matchKey = "Magda Standard";
      else if (grupa.includes("zostana") || grupa.includes("zostan")) matchKey = "Weryfikacja - zostana";
      else if (grupa.includes("odejda") || grupa.includes("odejd")) matchKey = "Weryfikacja - odejda";

      if (!grupyMap[matchKey]) grupyMap[matchKey] = { klientow: 0, aktywnych: 0, sprzedaz: 0, koszt: 0, zysk: 0 };
      grupyMap[matchKey].klientow++;
      if (client.aktywny) grupyMap[matchKey].aktywnych++;

      const sale = salesData.find(s => s.clientId === client.id);
      if (sale) {
        grupyMap[matchKey].sprzedaz += Number(sale.sprzedaz || 0);
        grupyMap[matchKey].koszt += Number(sale.koszt || 0);
        grupyMap[matchKey].zysk += Number(sale.zysk || 0);
      }
    }

    const groups = Object.entries(grupyMap)
      .filter(([_, v]) => v.klientow > 0)
      .map(([grupa, v]) => ({
        grupa,
        klientow: v.klientow,
        aktywnych: v.aktywnych,
        sprzedaz: v.sprzedaz,
        koszt: v.koszt,
        zysk: v.zysk,
        marza: v.sprzedaz > 0 ? (v.zysk / v.sprzedaz * 100) : 0,
      }));

    return { groups };
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

  async getFinanceData(): Promise<any> {
    const salariesData = await db.select().from(salaries);
    const costsData = await db.select().from(costs);
    const fleetData = await db.select().from(fleet);
    return { salaries: salariesData, costs: costsData, fleet: fleetData };
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

    let clientsList = await db.select().from(clients).where(eq(clients.aktywny, true));
    if (opiekun) {
      clientsList = clientsList.filter(c => c.opiekun === opiekun);
    }

    const prevSales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, prevYear), eq(clientSales.miesiac, prevMonth)));

    const currentSales = await db.select().from(clientSales)
      .where(and(eq(clientSales.rok, rok), eq(clientSales.miesiac, miesiac)));

    const plan = clientsList.map(c => {
      const prev = prevSales.find(s => s.clientId === c.id);
      const current = currentSales.find(s => s.clientId === c.id);
      return {
        clientId: c.id,
        clientName: c.klient,
        grupaMvp: c.grupaMvp,
        prevSales: Number(prev?.sprzedaz || 0),
        currentSales: Number(current?.sprzedaz || 0),
      };
    }).sort((a, b) => b.prevSales - a.prevSales);

    return { plan };
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
    const monthSales = currentTargets.length > 0 ? Number(currentTargets[0].wykonanieObrotu || 0) : 0;

    return {
      totalClients: filteredClients.length,
      activeClients,
      alertClients,
      todayContacts: todayContactsCount,
      tomorrowDeliveries: tomorrowDeliveriesCount,
      monthPlan,
      monthSales,
    };
  }
}

export const storage = new DatabaseStorage();
