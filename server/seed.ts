import { db } from "./db";
import { hashPassword } from "./auth";
import {
  users, drivers, vehicles, salaries, costs, fleet,
  salesTargets, salesHistory, clients, contacts, deliveries, notes,
  clientSales, clientSalesWeekly,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import clientsData from "./clients-data.json";
import contactsData from "./contacts-data.json";
import deliveriesData from "./deliveries-data.json";
import notesData from "./notes-data.json";
import clientSalesData from "./client-sales-data.json";
import clientSalesWeeklyData from "./client-sales-weekly-data.json";
import clientSalesGru2025Data from "./client-sales-gru2025-data.json";

const ALL_MONTHS_ACTIVE = {
  sty: true, lut: true, mar: true, kwi: true, maj: true, cze: true,
  lip: true, sie: true, wrz: true, paz: true, lis: true, gru: true,
};

export async function seedDatabase() {
  const existingUsers = await db.select().from(users).limit(1);
  const existingClients = await db.select().from(clients).limit(1);
  const existingContacts = await db.select().from(contacts).limit(1);

  if (existingUsers.length > 0 && existingClients.length > 0 && existingContacts.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  if (existingUsers.length === 0) {
    await seedCoreData();
  }

  if (existingClients.length === 0) {
    await seedTableData("clients", clients, clientsData);
  }

  // Seed client sales (December 2025 + January 2026) — match by clientId string to DB id
  const existingSales = await db.select().from(clientSales).limit(1);
  if (existingSales.length === 0) {
    if (clientSalesGru2025Data.length > 0) {
      await seedClientSalesForMonth(clientSalesGru2025Data as any[], 2025, 12);
    }
    if (clientSalesData.length > 0) {
      await seedClientSalesForMonth(clientSalesData as any[], 2026, 1);
    }
  }

  // Seed weekly plan (February 2026)
  const existingWeekly = await db.select().from(clientSalesWeekly).limit(1);
  if (existingWeekly.length === 0 && clientSalesWeeklyData.length > 0) {
    await seedClientSalesWeekly();
  }

  if (existingContacts.length === 0) {
    await seedTableData("contacts", contacts, contactsData);
    await seedTableData("deliveries", deliveries, deliveriesData);
    await seedTableData("notes", notes, notesData);
  }

  console.log("Database seeded successfully!");
}

async function seedTableData(name: string, table: any, data: any[]) {
  try {
    if (data.length === 0) return;
    const batchSize = 20;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await db.insert(table).values(batch).onConflictDoNothing();
    }
    console.log(`Seeded ${data.length} ${name}`);
  } catch (e: any) {
    console.log(`Could not seed ${name}:`, e.message);
  }
}

async function seedClientSalesForMonth(salesData: any[], rok: number, miesiac: number) {
  try {
    // Build map: clientId string (C001) -> DB id
    const allClients = await db.select().from(clients);
    const clientIdMap = new Map<string, number>();
    for (const c of allClients) {
      clientIdMap.set(c.clientId, c.id);
    }

    const batchSize = 20;
    const records: any[] = [];

    for (const sale of salesData) {
      const dbId = clientIdMap.get(sale.clientId);
      if (!dbId) continue;

      records.push({
        clientId: dbId,
        rok,
        miesiac,
        sprzedaz: String(sale.sprzedaz),
        koszt: String(sale.koszt),
        zysk: String(sale.zysk),
        marza: String(sale.marza),
      });
    }

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await db.insert(clientSales).values(batch).onConflictDoNothing();
    }

    const monthNames = ["", "Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paz", "Lis", "Gru"];
    console.log(`Seeded ${records.length} client sales (${monthNames[miesiac]} ${rok})`);
  } catch (e: any) {
    console.log(`Could not seed client sales (${rok}-${miesiac}):`, e.message);
  }
}

async function seedClientSalesWeekly() {
  try {
    const allClients = await db.select().from(clients);
    const clientIdMap = new Map<string, number>();
    for (const c of allClients) {
      clientIdMap.set(c.clientId, c.id);
    }

    let count = 0;
    const batchSize = 20;
    const records: any[] = [];

    for (const plan of clientSalesWeeklyData as any[]) {
      const dbId = clientIdMap.get(plan.clientId);
      if (!dbId) continue;

      records.push({
        clientId: dbId,
        rok: plan.rok,
        miesiac: plan.miesiac,
        tydzien: plan.tydzien,
        plan: plan.plan,
        realizacja: plan.realizacja || "0",
      });
    }

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await db.insert(clientSalesWeekly).values(batch).onConflictDoNothing();
    }

    console.log(`Seeded ${records.length} weekly plan records (February 2026)`);
  } catch (e: any) {
    console.log("Could not seed weekly plan:", e.message);
  }
}

async function seedCoreData() {
  console.log("Seeding database...");

  const adminPass = await hashPassword("admin123");
  const gosiaPass = await hashPassword("gosia123");
  const magdaPass = await hashPassword("magda123");
  const logiPass = await hashPassword("logi123");

  await db.insert(users).values([
    { username: "admin", password: adminPass, imie: "Administrator", rola: "admin" },
    { username: "gosia", password: gosiaPass, imie: "Gosia", rola: "handlowiec" },
    { username: "magda", password: magdaPass, imie: "Magda", rola: "handlowiec" },
    { username: "logistyka", password: logiPass, imie: "Logistyka", rola: "logistyka" },
  ]);

  await db.insert(drivers).values([
    { imie: "Czarek" },
    { imie: "Piotr" },
    { imie: "Martyna" },
    { imie: "Dominik" },
    { imie: "FIRMA" },
    { imie: "Firma zewnetrzna" },
    { imie: "Firma Transportowa" },
  ]);

  await db.insert(vehicles).values([
    { nazwa: "Ford" },
    { nazwa: "BMW" },
    { nazwa: "Pomaranczowy" },
    { nazwa: "Niebieski" },
    { nazwa: "Bialy nowy" },
  ]);

  await db.insert(salaries).values([
    { osoba: "Malgorzata Rojek", firma: "Sp. z o.o.", dzial: "SPRZEDAZ", formaZatrudnienia: "UoP", netto: "8000", brutto: "0", kosztPracodawcy: "14500", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { osoba: "Piotr Radzynski", firma: "Sp. z o.o.", dzial: "LOGISTYKA", formaZatrudnienia: "UoP", netto: "6000", brutto: "0", kosztPracodawcy: "10400", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { osoba: "Paulina Zielinska", firma: "Sp. z o.o.", dzial: "OPERACJE", formaZatrudnienia: "UoP", netto: "4300", brutto: "6002", kosztPracodawcy: "5654", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { osoba: "Firma zewnetrzna", firma: "Sp. z o.o.", dzial: "LOGISTYKA", formaZatrudnienia: "FV", netto: "7800", brutto: "6116.61", kosztPracodawcy: "7800", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { osoba: "Magdalena Grzelak", firma: "Sp. z o.o.", dzial: "SPRZEDAZ", formaZatrudnienia: "UoP", netto: "5000", brutto: "6850", kosztPracodawcy: "8400", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { osoba: "Dysponowanie pracownikami JDG", firma: "Sp. z o.o.", dzial: "ZARZADZANIE", formaZatrudnienia: "FV", netto: "21000", brutto: "0", kosztPracodawcy: "22674.54", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { osoba: "Zarzad p. Ania i p. Adam", firma: "Sp. z o.o.", dzial: "ZARZADZANIE", formaZatrudnienia: "FV", netto: "11000", brutto: "0", kosztPracodawcy: "7400", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { osoba: "Czeki nowe", firma: "Sp. z o.o.", dzial: "SPRZEDAZ", formaZatrudnienia: null, netto: "0", brutto: "0", kosztPracodawcy: "8640", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { osoba: "Anita Sklodowska", firma: "JDG", dzial: "LOGISTYKA", formaZatrudnienia: "UoP", netto: "3511", brutto: "4666", kosztPracodawcy: "5621.59", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { osoba: "Dominik Zmudzki", firma: "JDG", dzial: "LOGISTYKA", formaZatrudnienia: "UoP", netto: "3511", brutto: "4666", kosztPracodawcy: "5621.59", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { osoba: "Marek Zielinski", firma: "JDG", dzial: "LOGISTYKA", formaZatrudnienia: "UoP", netto: "3511", brutto: "4666", kosztPracodawcy: "5621.59", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { osoba: "Teresa Kochman", firma: "JDG", dzial: "OPERACJE", formaZatrudnienia: "UoP", netto: "4000", brutto: "2547", kosztPracodawcy: "3320", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
  ]);

  await db.insert(costs).values([
    { nazwa: "Ksiegowosc", dzial: "DORADZTWO", koszt: "5845", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { nazwa: "Najem magazyn", dzial: "MAGAZYN", koszt: "10000", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { nazwa: "Artykuly biurowe", dzial: "INNY", koszt: "380", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { nazwa: "Artykuly spozywcze", dzial: "INNY", koszt: "550", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { nazwa: "Media (prad, woda, smieci)", dzial: "ZARZADZANIE", koszt: "1301", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { nazwa: "Paliwo", dzial: "LOGISTYKA", koszt: "5000", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { nazwa: "Marketing", dzial: "SPRZEDAZ", koszt: "470", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { nazwa: "Budzet handlowy", dzial: "SPRZEDAZ", koszt: "100", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { nazwa: "Dodatkowe (transport, poczta)", dzial: "INNY", koszt: "940", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { nazwa: "Naprawy/przeglady", dzial: "LOGISTYKA", koszt: "1700", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { nazwa: "Fundusz nieprzewidziany", dzial: "ZARZADZANIE", koszt: "700", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { nazwa: "Finansowanie/raty", dzial: "DORADZTWO", koszt: "1824", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { nazwa: "Zarzadzanie Operacyjne od JDG", dzial: "ZARZADZANIE", koszt: "5000", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { nazwa: "Artykuly budowlane/wyposazenie", dzial: "INNY", koszt: "5", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { nazwa: "Budzet na prezenty klienci", dzial: "SPRZEDAZ", koszt: "6000", aktywnyMiesiace: {
      sty: false, lut: false, mar: false, kwi: false, maj: false, cze: false,
      lip: false, sie: false, wrz: false, paz: false, lis: true, gru: false,
    }},
    { nazwa: "Budzet na prezenty pracownicy", dzial: "ZARZADZANIE", koszt: "10000", aktywnyMiesiace: {
      sty: false, lut: false, mar: false, kwi: false, maj: false, cze: false,
      lip: false, sie: false, wrz: false, paz: false, lis: false, gru: true,
    }},
  ]);

  await db.insert(fleet).values([
    { opis: "Dzierzawa z AddAll JDG", rodzaj: "Dzierzawa", koszt: "3900", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { opis: "Opel Movano LEASING", rodzaj: "Leasing", koszt: "2475", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { opis: "Ford Custom leasing", rodzaj: "Leasing", koszt: "1687", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { opis: "2xBMW rata leasingowa", rodzaj: "Leasing", koszt: "3298", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { opis: "GPS Widziszwszystko", rodzaj: "Usluga", koszt: "300", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { opis: "Paliwo flota", rodzaj: "Eksploatacja", koszt: "2714", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
    { opis: "Naprawy przeglady opony", rodzaj: "Eksploatacja", koszt: "1204", aktywnyMiesiace: ALL_MONTHS_ACTIVE },
  ]);

  const plan2026 = [450000, 450000, 480000, 500000, 480000, 480000, 480000, 480000, 500000, 520000, 520000, 520000];
  await db.insert(salesTargets).values(
    plan2026.map((plan, i) => ({
      rok: 2026,
      miesiac: i + 1,
      planObrotu: String(plan),
      wykonanieObrotu: i === 0 ? "361376" : "0",
    }))
  );

  const historyData: Record<number, number[]> = {
    2021: [76748, 97200, 116720, 231579, 132611, 146733, 156973, 157337, 187834, 185438, 225276, 226584],
    2022: [158856, 179042, 225250, 224587, 266557, 274665, 252263, 295688, 298446, 337719, 378226, 410150],
    2023: [329707, 358484, 394903, 343711, 386671, 412280, 365324, 368797, 404277, 441641, 417416, 484211],
    2024: [401663, 428475, 431370, 471086, 447356, 443643, 453842, 457660, 495675, 515817, 417538, 500000],
    2025: [503721, 516838, 515000, 520000, 416425, 420000, 420000, 417178, 442288, 415390, 500000, 450000],
  };

  for (const [rok, months] of Object.entries(historyData)) {
    await db.insert(salesHistory).values(
      months.map((val, i) => ({
        rok: Number(rok),
        miesiac: i + 1,
        wartosc: String(val),
      }))
    );
  }

  console.log("Core data seeded!");
}
