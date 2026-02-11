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

export async function seedDatabase() {
  const existingUsers = await db.select().from(users).limit(1);
  const existingClients = await db.select().from(clients).limit(1);
  const existingContacts = await db.select().from(contacts).limit(1);

  if (existingUsers.length === 0) {
    await seedCoreData();
  }

  if (existingClients.length === 0) {
    await seedTableData("clients", clients, clientsData);
  } else {
    await seedTableData("clients", clients, clientsData);
  }

  if (existingContacts.length === 0) {
    await seedTableData("contacts", contacts, contactsData);
    await seedTableData("deliveries", deliveries, deliveriesData);
    await seedTableData("notes", notes, notesData);
  }

  const existingSales = await db.select().from(clientSales).limit(1);
  if (existingSales.length === 0) {
    await seedTableData("client_sales", clientSales, clientSalesData as any);
  }

  const existingWeekly = await db.select().from(clientSalesWeekly).limit(1);
  if (existingWeekly.length === 0) {
    await seedTableData("client_sales_weekly", clientSalesWeekly, clientSalesWeeklyData as any);
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
    { osoba: "Malgorzata Rojek", firma: "Sp. z o.o.", dzial: "SPRZEDAZ", formaZatrudnienia: "UoP", netto: "8000", brutto: "0", kosztPracodawcy: "14500", aktywnyMiesiace: { sty: true, lut: true, mar: true, kwi: true, maj: true, cze: true, lip: true, sie: true, wrz: true, paz: true, lis: true, gru: true } },
    { osoba: "Piotr Radzynski", firma: "Sp. z o.o.", dzial: "LOGISTYKA", formaZatrudnienia: "UoP", netto: "6000", brutto: "0", kosztPracodawcy: "10400", aktywnyMiesiace: { sty: true, lut: true, mar: true, kwi: true, maj: true, cze: true, lip: true, sie: true, wrz: true, paz: true, lis: true, gru: true } },
    { osoba: "Paulina Zielinska", firma: "Sp. z o.o.", dzial: "OPERACJE", formaZatrudnienia: "UoP", netto: "4300", brutto: "6002", kosztPracodawcy: "5654", aktywnyMiesiace: { sty: true, lut: true, mar: true, kwi: true, maj: true, cze: true, lip: true, sie: true, wrz: true, paz: true, lis: true, gru: true } },
    { osoba: "Firma zewnetrzna", firma: "Sp. z o.o.", dzial: "LOGISTYKA", formaZatrudnienia: "FV", netto: "7800", brutto: "0", kosztPracodawcy: "7800", aktywnyMiesiace: { sty: true, lut: true, mar: true, kwi: true, maj: true, cze: true, lip: true, sie: true, wrz: true, paz: true, lis: true, gru: true } },
    { osoba: "Magdalena Grzelak", firma: "Sp. z o.o.", dzial: "SPRZEDAZ", formaZatrudnienia: "UoP", netto: "5000", brutto: "6850", kosztPracodawcy: "8400", aktywnyMiesiace: { sty: true, lut: true, mar: true, kwi: true, maj: true, cze: true, lip: true, sie: true, wrz: true, paz: true, lis: true, gru: true } },
    { osoba: "Dysponowanie pracownikami JDG", firma: "Sp. z o.o.", dzial: "ZARZADZANIE", formaZatrudnienia: "FV", netto: "21000", brutto: "0", kosztPracodawcy: "22674.54", aktywnyMiesiace: { sty: true, lut: true, mar: true, kwi: true, maj: true, cze: true, lip: true, sie: true, wrz: true, paz: true, lis: true, gru: true } },
    { osoba: "Zarzad p. Ania i p. Adam", firma: "Sp. z o.o.", dzial: "ZARZADZANIE", formaZatrudnienia: "FV", netto: "11000", brutto: "0", kosztPracodawcy: "7400", aktywnyMiesiace: { sty: true, lut: true, mar: true, kwi: true, maj: true, cze: true, lip: true, sie: true, wrz: true, paz: true, lis: true, gru: true } },
    { osoba: "Czeki nowe", firma: "Sp. z o.o.", dzial: "SPRZEDAZ", formaZatrudnienia: null, netto: "0", brutto: "0", kosztPracodawcy: "8640", aktywnyMiesiace: { sty: true, lut: true, mar: true, kwi: true, maj: true, cze: true, lip: true, sie: true, wrz: true, paz: true, lis: true, gru: true } },
    { osoba: "Anita Sklodowska", firma: "JDG", dzial: "LOGISTYKA", formaZatrudnienia: "UoP", netto: "3511", brutto: "4666", kosztPracodawcy: "5621.59", aktywnyMiesiace: { sty: true, lut: true, mar: true, kwi: true, maj: true, cze: true, lip: true, sie: true, wrz: true, paz: true, lis: true, gru: true } },
    { osoba: "Dominik Zmudzki", firma: "JDG", dzial: "LOGISTYKA", formaZatrudnienia: "UoP", netto: "3511", brutto: "4666", kosztPracodawcy: "5621.59", aktywnyMiesiace: { sty: true, lut: true, mar: true, kwi: true, maj: true, cze: true, lip: true, sie: true, wrz: true, paz: true, lis: true, gru: true } },
    { osoba: "Marek Zielinski", firma: "JDG", dzial: "LOGISTYKA", formaZatrudnienia: "UoP", netto: "3511", brutto: "4666", kosztPracodawcy: "5621.59", aktywnyMiesiace: { sty: true, lut: true, mar: true, kwi: true, maj: true, cze: true, lip: true, sie: true, wrz: true, paz: true, lis: true, gru: true } },
    { osoba: "Teresa Kochman", firma: "JDG", dzial: "OPERACJE", formaZatrudnienia: "UoP", netto: "4000", brutto: "2547", kosztPracodawcy: "3320", aktywnyMiesiace: { sty: true, lut: true, mar: true, kwi: true, maj: true, cze: true, lip: true, sie: true, wrz: true, paz: true, lis: true, gru: true } },
  ]);

  await db.insert(costs).values([
    { nazwa: "Ksiegowosc", dzial: "ZARZADZANIE", koszt: "5845", aktywnyMiesiace: {} },
    { nazwa: "Najem magazyn", dzial: "ZARZADZANIE", koszt: "10000", aktywnyMiesiace: {} },
    { nazwa: "Artykuly biurowe/spozywcze", dzial: "ZARZADZANIE", koszt: "930", aktywnyMiesiace: {} },
    { nazwa: "Media (prad, woda, smieci)", dzial: "ZARZADZANIE", koszt: "1301", aktywnyMiesiace: {} },
    { nazwa: "Paliwo", dzial: "LOGISTYKA", koszt: "5000", aktywnyMiesiace: {} },
    { nazwa: "Marketing", dzial: "SPRZEDAZ", koszt: "470", aktywnyMiesiace: {} },
    { nazwa: "Budzet handlowy", dzial: "SPRZEDAZ", koszt: "100", aktywnyMiesiace: {} },
    { nazwa: "Dodatkowe (transport, poczta)", dzial: "INNY", koszt: "940", aktywnyMiesiace: {} },
    { nazwa: "Naprawy/przeglady", dzial: "LOGISTYKA", koszt: "1700", aktywnyMiesiace: {} },
    { nazwa: "Fundusz nieprzewidziany", dzial: "ZARZADZANIE", koszt: "700", aktywnyMiesiace: {} },
    { nazwa: "Finansowanie/raty", dzial: "DORADZTWO", koszt: "1824", aktywnyMiesiace: {} },
    { nazwa: "Zarzadzanie Operacyjne od JDG", dzial: "ZARZADZANIE", koszt: "5000", aktywnyMiesiace: {} },
  ]);

  await db.insert(fleet).values([
    { opis: "Dzierzawa z AddAll JDG", rodzaj: "Dzierzawa", koszt: "3900", aktywnyMiesiace: {} },
    { opis: "Opel Movano LEASING", rodzaj: "Leasing", koszt: "2475", aktywnyMiesiace: {} },
    { opis: "Ford Custom leasing", rodzaj: "Leasing", koszt: "1687", aktywnyMiesiace: {} },
    { opis: "2xBMW rata leasingowa", rodzaj: "Leasing", koszt: "3298", aktywnyMiesiace: {} },
    { opis: "GPS Widziszwszystko", rodzaj: "Usluga", koszt: "300", aktywnyMiesiace: {} },
    { opis: "Paliwo flota", rodzaj: "Eksploatacja", koszt: "2714", aktywnyMiesiace: {} },
    { opis: "Naprawy przeglady opony", rodzaj: "Eksploatacja", koszt: "1204", aktywnyMiesiace: {} },
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
