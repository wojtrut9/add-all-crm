import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authMiddleware, adminOnly, generateToken, comparePassword } from "./auth";
import { seedDatabase } from "./seed";
import { migrateDatabase } from "./migrate";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await migrateDatabase();
  await seedDatabase();

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Brak danych logowania" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Nieprawidlowe dane logowania" });
      }

      const valid = await comparePassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Nieprawidlowe dane logowania" });
      }

      const token = generateToken({
        id: user.id,
        username: user.username,
        imie: user.imie,
        rola: user.rola,
      });

      res.json({
        token,
        user: { id: user.id, username: user.username, imie: user.imie, rola: user.rola },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/dashboard/stats", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const opiekun = user.rola === "handlowiec" ? user.imie : undefined;
      const stats = await storage.getDashboardStats(opiekun, user.rola);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/contacts/today", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const opiekun = user.rola === "handlowiec" ? user.imie : undefined;
      const contacts = await storage.getContactsForToday(opiekun);
      res.json(contacts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clients", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const opiekun = user.rola === "handlowiec" ? user.imie : undefined;
      const clients = await storage.getClients(opiekun);
      res.json(clients);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clients/:id", authMiddleware, async (req, res) => {
    try {
      const client = await storage.getClient(Number(req.params.id));
      if (!client) return res.status(404).json({ message: "Klient nie znaleziony" });
      res.json(client);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clients", authMiddleware, async (req, res) => {
    try {
      const nextId = await storage.getNextClientId();
      const clientData = { ...req.body, clientId: req.body.clientId || nextId, brakiZamowien: 0 };
      const created = await storage.createClient(clientData);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/clients/:id", authMiddleware, async (req, res) => {
    try {
      await storage.updateClient(Number(req.params.id), req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/clients/:id", authMiddleware, async (req, res) => {
    try {
      await storage.deleteClient(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clients/import", authMiddleware, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Brak pliku" });

      const content = req.file.buffer.toString("utf-8");
      const lines = parseCSV(content);
      let created = 0;
      let skipped = 0;

      for (const row of lines) {
        if (!row.Klient && !row.klient) continue;

        const klientName = row.Klient || row.klient || "";
        const csvClientId = row.Client_ID || row.client_id || "";

        const existing = await storage.getClientByNameOrClientId(klientName, csvClientId || undefined);
        if (existing) {
          skipped++;
          continue;
        }

        const notatki = row.Notatki || row.notatki || "";
        const parsed = parseNotatkiFields(notatki);

        try {
          await storage.createClient({
            klient: klientName,
            clientId: csvClientId || `C${Date.now()}`,
            opiekun: row.Opiekun || row.opiekun || "Weryfikacja",
            segment: row.Segment || row.segment || "Weryfikacja",
            grupaMvp: row.Grupa_MVP || row.grupa_mvp || null,
            status: row.Status || row.status || "Aktywny",
            aktywny: row.Aktywny === "1" || row.aktywny === "1" || row.Aktywny === "true",
            telefon: row.Telefon || row.telefon || null,
            telefonDodatkowy: row.Telefon_dodatkowy || row.telefon_dodatkowy || null,
            email: row.Email || row.email || null,
            emailDodatkowe: row.Email_dodatkowe || row.email_dodatkowe || null,
            preferowanaFormaKontaktu: row.Preferowana_forma_kontaktu || null,
            zamowieniaGdzie: row.Zamówienia_gdzie || row.Zamowienia_gdzie || null,
            dniZamowien: row.Dni_zamówień || row.Dni_zamowien || null,
            rytmKontaktu: row.Rytm_kontaktu || row.rytm_kontaktu || null,
            miasto: row.Miasto || row.miasto || null,
            kraj: row.Kraj || row.kraj || null,
            notatki: notatki,
            rabatProcent: parsed.rabat || null,
            warunkiPlatnosci: parsed.warunkiPlatnosci || null,
            terminPlatnosciDni: parsed.terminPlatnosci ? Number(parsed.terminPlatnosci) : null,
            limitKredytowy: parsed.limitKredytowy || null,
            osobaKontaktowa: parsed.osobaKontaktowa || null,
            brakiZamowien: 0,
          });
          created++;
        } catch (e: any) {
          skipped++;
        }
      }

      res.json({ created, skipped });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/contacts", authMiddleware, async (req, res) => {
    try {
      const { from, to } = req.query;
      const user = (req as any).user;
      const opiekun = user.rola === "handlowiec" ? user.imie : undefined;
      const contacts = await storage.getContacts(from as string, to as string, opiekun);
      res.json(contacts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clients/fix-columns", authMiddleware, adminOnly, async (req, res) => {
    try {
      const VALID_DAYS = ["Poniedziałek", "Poniedzialek", "Wtorek", "Środa", "Sroda", "Czwartek", "Piątek", "Piatek", "Sobota", "Niedziela"];
      const VALID_RYTM = ["1x/tydzień", "1x/tydzien", "2x/tydzień", "2x/tydzien", "1x/miesiąc", "1x/miesiac", "2x/miesiąc", "2x/miesiac", "co 3 miesiące", "co 3 miesiace", "co 2 miesiące", "co 2 miesiace", "co tydzień", "co tydzien"];
      const VALID_CITIES = ["Warszawa", "Gdańsk", "Kraków", "Wrocław", "Poznań", "Łódź", "Gdansk", "Krakow", "Wroclaw", "Poznan", "Lodz", "Piaseczno", "Pruszków", "Pruszkow", "Legionowo", "Łomianki", "Lomianki", "Bielawa", "Mszczonów", "Mszczonow", "Mińsk", "Minsk", "Konstancin"];

      const isDay = (val: string): boolean => VALID_DAYS.some(d => val.includes(d));
      const isRytm = (val: string): boolean => VALID_RYTM.some(r => val.toLowerCase().includes(r.toLowerCase()));
      const isCity = (val: string): boolean => VALID_CITIES.some(c => val.includes(c));

      const allClients = await storage.getClients();
      let fixed = 0, alreadyOk = 0, couldNotFix = 0;
      const log: string[] = [];

      for (const client of allClients) {
        const dniOrig = client.dniZamowien || "";
        if (dniOrig && isDay(dniOrig)) {
          const rytmOrig = client.rytmKontaktu || "";
          if (rytmOrig && isDay(rytmOrig) && !isRytm(rytmOrig)) {
            const allFields = [
              client.preferowanaFormaKontaktu,
              client.zamowieniaGdzie,
              client.dniZamowien,
              client.rytmKontaktu,
              client.miasto,
              client.kraj
            ].filter(Boolean) as string[];

            const dayFields = allFields.filter(f => isDay(f));
            const realDni = dayFields.length > 1 ? dayFields.join(",") : dayFields[0] || dniOrig;
            const realRytm = allFields.find(f => isRytm(f));
            const realMiasto = allFields.find(f => isCity(f));

            const updates: any = {};
            if (realDni !== dniOrig) updates.dniZamowien = realDni;
            if (realRytm && realRytm !== rytmOrig) updates.rytmKontaktu = realRytm;
            if (realMiasto && realMiasto !== client.miasto) updates.miasto = realMiasto;
            updates.kraj = "Poland";

            if (Object.keys(updates).length > 1) {
              await storage.updateClient(client.id, updates);
              log.push(`Naprawiono: ${client.klient} — dniZamowien: ${dniOrig} -> ${updates.dniZamowien || dniOrig}, rytmKontaktu: ${rytmOrig} -> ${updates.rytmKontaktu || rytmOrig}`);
              fixed++;
            } else {
              alreadyOk++;
            }
          } else {
            alreadyOk++;
          }
          continue;
        }

        if (!dniOrig) {
          alreadyOk++;
          continue;
        }

        const allFields = [
          client.preferowanaFormaKontaktu,
          client.zamowieniaGdzie,
          client.dniZamowien,
          client.rytmKontaktu,
          client.miasto,
          client.kraj
        ].filter(Boolean) as string[];

        const dayFields = allFields.filter(f => isDay(f));
        const realDni = dayFields.length > 1 ? dayFields.join(",") : dayFields[0];
        const realRytm = allFields.find(f => isRytm(f));
        const realMiasto = allFields.find(f => isCity(f));
        const realForma = allFields.find(f => ["Sms", "SMS", "Telefon"].includes(f));
        const realGdzie = allFields.find(f => ["Skalo", "Email", "SMS", "WhatsApp", "Telefon"].includes(f) && f !== realForma);

        if (realDni || realRytm) {
          const updates: any = {
            dniZamowien: realDni || null,
            rytmKontaktu: realRytm || null,
            miasto: realMiasto || null,
            kraj: "Poland",
          };
          if (realForma) updates.preferowanaFormaKontaktu = realForma;
          if (realGdzie) updates.zamowieniaGdzie = realGdzie;

          await storage.updateClient(client.id, updates);
          log.push(`Naprawiono: ${client.klient} — dniZamowien: ${dniOrig} -> ${updates.dniZamowien}, rytmKontaktu: ${client.rytmKontaktu} -> ${updates.rytmKontaktu}`);
          fixed++;
        } else {
          couldNotFix++;
          log.push(`Nie naprawiono: ${client.klient} — brak danych do naprawy`);
        }
      }

      console.log("=== FIX COLUMNS LOG ===");
      log.forEach(l => console.log(l));
      console.log(`Fixed: ${fixed}, OK: ${alreadyOk}, Could not fix: ${couldNotFix}`);

      res.json({ fixed, alreadyOk, couldNotFix, log });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/contacts/generate-week", authMiddleware, async (req, res) => {
    try {
      const { weekStart } = req.body;
      const user = (req as any).user;
      const opiekun = user.rola === "handlowiec" ? user.imie : undefined;

      const allClients = await storage.getClients(opiekun);
      const activeClients = allClients.filter(c => c.aktywny);

      let count = 0;
      const dayMap: Record<string, number> = {
        "Poniedzialek": 0, "Poniedziałek": 0, "Pon": 0, "pn": 0,
        "Wtorek": 1, "Wt": 1,
        "Sroda": 2, "Środa": 2, "Sr": 2, "Śr": 2,
        "Czwartek": 3, "Czw": 3, "Cz": 3,
        "Piatek": 4, "Piątek": 4, "Pt": 4,
        "Sobota": 5, "Sob": 5,
        "Niedziela": 6, "Nd": 6,
      };

      const wsDate = new Date(weekStart);
      const weekOfMonth = Math.ceil(wsDate.getDate() / 7);

      for (const client of activeClients) {
        const rytm = (client.rytmKontaktu || "").toLowerCase();

        let shouldGenerate = false;
        if (rytm.includes("1x/tydz") || rytm.includes("1x tyg") || rytm === "co tydzien" || rytm === "co tydzień") {
          shouldGenerate = true;
        } else if (rytm.includes("2x/tydz") || rytm.includes("2x tyg") || rytm.includes("2x w tyg")) {
          shouldGenerate = true;
        } else if (rytm.includes("1x/mies") || rytm.includes("1x mies") || rytm === "co miesiac" || rytm === "co miesiąc") {
          shouldGenerate = weekOfMonth === 1;
        } else if (rytm.includes("2x/mies") || rytm.includes("2x mies")) {
          shouldGenerate = weekOfMonth === 1 || weekOfMonth === 3;
        } else if (rytm.includes("co 3 mies") || rytm.includes("kwartal")) {
          const monthNum = wsDate.getMonth();
          shouldGenerate = weekOfMonth === 1 && monthNum % 3 === 0;
        } else if (rytm.includes("co 2 mies")) {
          const monthNum = wsDate.getMonth();
          shouldGenerate = weekOfMonth === 1 && monthNum % 2 === 0;
        } else if (rytm) {
          shouldGenerate = true;
        }

        if (!shouldGenerate) continue;

        const dniStr = (client.dniZamowien || "").replace(/\s*i\s*/g, ",");
        let dni = dniStr.split(",").map(d => d.trim()).filter(d => d);

        if (dni.length === 0 || !dni.some(d => dayMap[d] !== undefined)) {
          if (rytm) {
            dni = [];
            if (rytm.includes("2x")) {
              dni.push("Poniedziałek", "Czwartek");
            } else {
              dni.push("Poniedziałek");
            }
          } else {
            continue;
          }
        }

        for (const dzien of dni) {
          const dayIndex = dayMap[dzien];
          if (dayIndex === undefined || dayIndex > 4) continue;

          const contactDate = new Date(wsDate);
          contactDate.setDate(contactDate.getDate() + dayIndex);
          const dateStr = contactDate.toISOString().split("T")[0];

          const existing = await storage.getContacts(dateStr, dateStr, client.opiekun);
          const alreadyExists = existing.some(c => c.clientId === client.id && c.data === dateStr);
          if (alreadyExists) continue;

          await storage.createContact({
            clientId: client.id,
            opiekun: client.opiekun,
            data: dateStr,
            status: "Do zrobienia",
            typ: "Cykliczny",
            priorytet: (client.brakiZamowien || 0) >= 2 ? "Pilny" : "Normalny",
            formaKontaktu: client.preferowanaFormaKontaktu || null,
          });
          count++;
        }
      }

      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/contacts/:id", authMiddleware, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, ...rest } = req.body;

      const contact = await storage.getContact(id);
      if (!contact) return res.status(404).json({ message: "Kontakt nie znaleziony" });

      const updateData: any = { ...rest };
      if (status) updateData.status = status;

      await storage.updateContact(id, updateData);

      if (status === "Zamowil") {
        await storage.updateClient(contact.clientId, { brakiZamowien: 0 });

        const contactDate = new Date(contact.data);
        let nextDay = new Date(contactDate);
        nextDay.setDate(nextDay.getDate() + 1);
        while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
          nextDay.setDate(nextDay.getDate() + 1);
        }

        const client = await storage.getClient(contact.clientId);

        await storage.createDelivery({
          dataDostawy: nextDay.toISOString().split("T")[0],
          clientId: contact.clientId,
          opiekun: contact.opiekun,
          wartoscNettoWz: "0",
          platnosc: client?.warunkiPlatnosci || "do potwierdzenia",
        });
      } else if (status === "Nie zamowil") {
        const client = await storage.getClient(contact.clientId);
        if (client) {
          await storage.updateClient(contact.clientId, {
            brakiZamowien: (client.brakiZamowien || 0) + 1,
          });
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/deliveries", authMiddleware, async (req, res) => {
    try {
      const date = req.query.date as string || new Date().toISOString().split("T")[0];
      const deliveries = await storage.getDeliveries(date);
      res.json(deliveries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/deliveries/:id", authMiddleware, async (req, res) => {
    try {
      await storage.updateDelivery(Number(req.params.id), req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/deliveries", authMiddleware, async (req, res) => {
    try {
      const delivery = await storage.createDelivery(req.body);
      res.json(delivery);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/drivers", authMiddleware, async (req, res) => {
    try {
      const drivers = await storage.getDrivers();
      res.json(drivers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/drivers", authMiddleware, async (req, res) => {
    try {
      const driver = await storage.createDriver(req.body.imie);
      res.json(driver);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/vehicles", authMiddleware, async (req, res) => {
    try {
      const vehicles = await storage.getVehicles();
      res.json(vehicles);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/vehicles", authMiddleware, async (req, res) => {
    try {
      const vehicle = await storage.createVehicle(req.body.nazwa);
      res.json(vehicle);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sales-analysis", authMiddleware, adminOnly, async (req, res) => {
    try {
      const rok = Number(req.query.rok) || 2026;
      const miesiac = Number(req.query.miesiac) || 1;
      const data = await storage.getSalesAnalysis(rok, miesiac);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sales-dashboard", authMiddleware, adminOnly, async (req, res) => {
    try {
      const data = await storage.getSalesDashboard();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/finance", authMiddleware, adminOnly, async (req, res) => {
    try {
      const miesiac = req.query.miesiac ? Number(req.query.miesiac) : undefined;
      const data = await storage.getFinanceData(miesiac);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/finance/costs", authMiddleware, adminOnly, async (req, res) => {
    try {
      const cost = await storage.createCost(req.body);
      res.json(cost);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/finance/costs/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
      const cost = await storage.updateCost(Number(req.params.id), req.body);
      res.json(cost);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/finance/costs/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
      await storage.deleteCost(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/finance/import", authMiddleware, adminOnly, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Brak pliku" });
      }

      const XLSX = await import("xlsx");
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });

      const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("raport")) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        return res.status(400).json({ message: "Plik Excel jest pusty" });
      }

      const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      let detectedYear = 2026;
      let detectedMonth = 1;
      for (let i = 0; i < Math.min(10, allRows.length); i++) {
        const rowText = String(allRows[i] || "");
        const dateMatch = rowText.match(/OD\s+(\d{4})-(\d{2})-\d{2}/i);
        if (dateMatch) {
          detectedYear = parseInt(dateMatch[1]);
          detectedMonth = parseInt(dateMatch[2]);
          break;
        }
      }

      const miesiac = Number(req.body.miesiac) || detectedMonth;
      if (miesiac < 1 || miesiac > 12) {
        return res.status(400).json({ message: "Nieprawidlowy miesiac" });
      }

      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(20, allRows.length); i++) {
        const row = allRows[i];
        if (!row) continue;
        const rowStr = row.map((c: any) => String(c || "").toLowerCase());
        if (rowStr.some((c: string) => c === "lp." || c === "lp") && rowStr.some((c: string) => c.includes("netto"))) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx === -1) {
        return res.status(400).json({ message: "Nieprawidłowy format pliku. Oczekiwany: Raport Zestawienie Zakupu VAT z iBiznes." });
      }

      const cleanContractorName = (raw: string): string => {
        return raw
          .replace(/^"(.*)"$/, "$1")
          .replace(/SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ/gi, "Sp. z o.o.")
          .replace(/SPÓAKA AKCYJNA ODDZIAA W POLSCE/gi, "S.A.")
          .replace(/SPÓŁKA AKCYJNA/gi, "S.A.")
          .split(/\s+ul\./i)[0]
          .split(/\s+al\./i)[0]
          .split(/\s+Aleje\s/i)[0]
          .split(/\s+Aleja\s/i)[0]
          .split(/\s+Rondo\s/i)[0]
          .replace(/\s*\d{2}-\d{3}\s+\S+/g, "")
          .replace(/\s*PL\d{10,}$/i, "")
          .replace(/\s*DE\d{9,}$/i, "")
          .replace(/\s*\d{10,}$/i, "")
          .replace(/\s*null,\s*\d+\s*$/i, "")
          .replace(/\s+/g, " ")
          .trim();
      }

      const categorize = (numer: string, kontrahent: string): string => {
        const n = numer.toLowerCase();
        const k = kontrahent.toLowerCase();

        if (k.includes("pracownicy") || n.includes("lista_płac") || n.includes("lista_p")) return "Wynagrodzenia";
        if (k.includes("add all adam") || k.includes("rękawek") || k.includes("rekawek") || k.includes("małgorzata rojek") || k.includes("malgorzata rojek") || k.includes("rojek") || n.includes("harmonogram_spłaty") || n.includes("harmonogram_splaty")) return "Wynagrodzenia zarząd (JDG)";
        if (n.includes("zus") || k.includes("zakład ubezpieczeń") || k.includes("zaklad ubezpieczen")) return "ZUS";
        if (n.includes("urząd_skarbowy") || n.includes("urzad_skarbowy") || k.includes("izba administracji skarbowej") || k.includes("urząd skarbowy")) return "Podatki (US)";
        if (k.includes("przychodnia") || k.includes("centrum medyczne")) return "Medycyna pracy";
        if (k.includes("pekao leasing")) return "Leasing";
        if (k.includes("union tank")) return "Paliwo";
        if (k.includes("nootoo") || k.includes("tarnopolska") || k.includes("żyrafa") || k.includes("latająca") || k.includes("zyrafa") || k.includes("latajaca")) return "Transport";
        if (k.includes("euler hermes")) return "Ubezpieczenia";
        if (k.includes("etl") || k.includes("kancelari") || k.includes("doradztw")) return "Księgowość";
        if (k.includes("pge") || k.includes("axpo")) return "Media/Prąd";
        if (k.includes("firmatec")) return "IT/Serwis";
        if (k.includes("chatgpt") || k.includes("subscription") || k.includes("widziszwszystko")) return "IT/Subskrypcje";
        if (k.includes("123drukuj") || k.includes("agdstrefa")) return "Biuro";
        if (k.includes("dpd") || k.includes("poczta polska")) return "Wysyłka/Poczta";
        if (k.includes("polskie epłat") || k.includes("epłatności") || k.includes("eplatnosci")) return "Płatności/Terminal";
        if (k.includes("iglotex") || k.includes("skalo") || k.includes("znatury")) return "Towary/Produkty";
        if (k.includes("ekoba")) return "Serwis/Naprawa";
        return "Inne";
      }

      const importedCosts: any[] = [];
      let totalNetto = 0;
      let totalBrutto = 0;

      for (let i = headerRowIdx + 1; i < allRows.length; i++) {
        const row = allRows[i];
        if (!row || row.length === 0) continue;

        const lp = row[0];
        if (lp === null || lp === undefined) continue;
        if (typeof lp !== "number" && isNaN(Number(lp))) continue;

        const numer = String(row[1] || "");
        const kontrahentRaw = String(row[4] || "");
        const stawkaVat = String(row[5] || "");
        const netto = parseFloat(String(row[6] || 0)) || 0;
        const vatKwota = parseFloat(String(row[7] || 0)) || 0;
        const brutto = parseFloat(String(row[8] || 0)) || 0;

        const kontrahentName = cleanContractorName(kontrahentRaw);
        if (!kontrahentName || (netto === 0 && brutto === 0)) continue;

        const kategoria = categorize(numer, kontrahentName);

        totalNetto += netto;
        totalBrutto += brutto;

        importedCosts.push({
          nazwa: kontrahentName,
          firma: "IMPORT_VAT",
          dzial: kategoria,
          rodzaj: numer,
          kategoria,
          netto,
          koszt: brutto,
          notatka: stawkaVat || null,
        });
      }

      if (importedCosts.length === 0) {
        return res.status(400).json({ message: "Nieprawidłowy format pliku. Oczekiwany: Raport Zestawienie Zakupu VAT z iBiznes." });
      }

      const MONTH_KEYS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paz", "lis", "gru"];
      const MONTH_NAMES = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
      const mKey = MONTH_KEYS[miesiac - 1];

      const result = await storage.importVATCosts(miesiac, mKey, importedCosts);

      const catSummary: Record<string, number> = {};
      for (const c of importedCosts) {
        catSummary[c.kategoria] = (catSummary[c.kategoria] || 0) + c.koszt;
      }

      res.json({
        message: `Zaimportowano ${importedCosts.length} pozycji kosztowych za ${MONTH_NAMES[miesiac - 1]} ${detectedYear}. Razem: ${Math.round(totalBrutto).toLocaleString("pl-PL")} PLN brutto.`,
        imported: importedCosts.length,
        rok: detectedYear,
        miesiac,
        totalNetto: Math.round(totalNetto),
        totalBrutto: Math.round(totalBrutto),
        categories: catSummary,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/daily-analysis", authMiddleware, adminOnly, async (req, res) => {
    try {
      const rok = Number(req.query.rok) || new Date().getFullYear();
      const miesiac = Number(req.query.miesiac) || (new Date().getMonth() + 1);
      const entries = await storage.getDailyAnalysis(rok, miesiac);
      const fixedCosts = await storage.getMonthlyFixedCosts(miesiac);
      const dniRobocze = await storage.getDniRobocze(rok, miesiac);
      res.json({ entries, fixedCosts, dniRobocze });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/daily-analysis", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { rok, miesiac, dzien, sprzedaz } = req.body;
      const entry = await storage.upsertDailyAnalysis(rok, miesiac, dzien, sprzedaz);
      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/daily-analysis/dni-robocze", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { rok, miesiac, dniRobocze } = req.body;
      await storage.updateDniRobocze(rok, miesiac, dniRobocze);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/daily-analysis/import", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { rok, miesiac } = req.body;
      const daysImported = await storage.importDailySalesFromContacts(rok, miesiac);
      res.json({ daysImported });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/my-sales", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const data = await storage.getMySales(user.imie);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/plan/available-months", authMiddleware, async (req, res) => {
    try {
      const months = await storage.getAvailablePlanMonths();
      res.json(months);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/plan", authMiddleware, async (req, res) => {
    try {
      const now = new Date();
      const rok = Number(req.query.rok) || now.getFullYear();
      const miesiac = Number(req.query.miesiac) || (now.getMonth() + 1);
      const user = (req as any).user;
      const opiekun = user.rola === "handlowiec" ? user.imie : undefined;
      const data = await storage.getPlanData(rok, miesiac, opiekun);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/plan/realization", authMiddleware, async (req, res) => {
    try {
      const now = new Date();
      const rok = Number(req.query.rok) || now.getFullYear();
      const miesiac = Number(req.query.miesiac) || (now.getMonth() + 1);
      const user = (req as any).user;
      const opiekun = user.rola === "handlowiec" ? user.imie : undefined;
      const data = await storage.getPlanRealization(rok, miesiac, opiekun);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/wz/import", authMiddleware, adminOnly, upload.single("file"), async (req, res) => {
    try {
      const XLSX = await import("xlsx");
      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: "Brak pliku" });

      const rok = Number(req.body.rok);
      const miesiac = Number(req.body.miesiac);
      const addToExisting = req.body.addToExisting === "true";
      if (!rok || !miesiac) return res.status(400).json({ message: "Brak rok/miesiac" });

      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      const aggregated: Record<string, number> = {};
      for (const row of rawRows) {
        const typ = String(row[0] || "").trim();
        if (typ !== "WZ") continue;
        const klientName = String(row[6] || "").trim();
        const wartoscNetto = parseFloat(String(row[17] || "0").replace(/\s/g, "").replace(",", ".")) || 0;
        if (!klientName || wartoscNetto === 0) continue;
        aggregated[klientName] = (aggregated[klientName] || 0) + wartoscNetto;
      }

      const allClients = await storage.getClients();
      const clientNameMap = new Map<string, number>();
      for (const c of allClients) {
        clientNameMap.set(c.klient.trim().toLowerCase(), c.id);
      }

      const importData: Array<{clientId: number; sprzedaz: number}> = [];
      const notFound: string[] = [];
      let total = 0;

      for (const [name, value] of Object.entries(aggregated)) {
        const nameKey = name.trim().toLowerCase();
        let clientId = clientNameMap.get(nameKey);

        if (!clientId) {
          for (const c of allClients) {
            const cName = c.klient.trim().toLowerCase();
            if (cName.includes(nameKey) || nameKey.includes(cName)) {
              clientId = c.id;
              break;
            }
          }
        }

        if (!clientId) {
          const nameNorm = nameKey.replace(/[\s\-_]/g, "");
          for (const c of allClients) {
            const cNorm = c.klient.trim().toLowerCase().replace(/[\s\-_]/g, "");
            if (cNorm.includes(nameNorm) || nameNorm.includes(cNorm)) {
              clientId = c.id;
              break;
            }
          }
        }

        if (!clientId) {
          notFound.push(name);
        } else {
          importData.push({ clientId, sprzedaz: Math.round(value * 100) / 100 });
          total += value;
        }
      }

      await storage.importWzData(rok, miesiac, importData, addToExisting);

      res.json({
        imported: importData.length,
        total: Math.round(total),
        notFound,
        details: Object.entries(aggregated).map(([name, value]) => ({ name, value: Math.round(value) })),
      });
    } catch (err: any) {
      console.error("WZ import error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/sales-data/import", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { rok, miesiac, data } = req.body;
      if (!rok || !miesiac || !data || !Array.isArray(data)) {
        return res.status(400).json({ message: "Brak wymaganych danych (rok, miesiac, data)" });
      }
      const result = await storage.importClientSales(rok, miesiac, data);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/sales-data", authMiddleware, adminOnly, async (req, res) => {
    try {
      const rok = Number(req.query.rok);
      const miesiac = Number(req.query.miesiac);
      if (!rok || !miesiac) return res.status(400).json({ message: "Brak rok/miesiac" });
      const deleted = await storage.deleteClientSalesForMonth(rok, miesiac);
      res.json({ deleted });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/sales-data/check", authMiddleware, adminOnly, async (req, res) => {
    try {
      const rok = Number(req.query.rok);
      const miesiac = Number(req.query.miesiac);
      if (!rok || !miesiac) return res.status(400).json({ message: "Brak rok/miesiac" });
      const { db: dbInstance } = await import("./db");
      const { clientSales: cs } = await import("@shared/schema");
      const { eq: eqFn, and: andFn } = await import("drizzle-orm");
      const existing = await dbInstance.select().from(cs)
        .where(andFn(eqFn(cs.rok, rok), eqFn(cs.miesiac, miesiac)));
      res.json({ exists: existing.length > 0, count: existing.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/plan/import", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { rok, miesiac, data } = req.body;
      if (!rok || !miesiac || !data || !Array.isArray(data)) {
        return res.status(400).json({ message: "Brak wymaganych danych" });
      }
      const result = await storage.importMonthlyPlan(rok, miesiac, data);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/plan/monthly", authMiddleware, adminOnly, async (req, res) => {
    try {
      const rok = Number(req.query.rok);
      const miesiac = Number(req.query.miesiac);
      if (!rok || !miesiac) return res.status(400).json({ message: "Brak rok/miesiac" });
      const deleted = await storage.deleteMonthlyPlan(rok, miesiac);
      res.json({ deleted });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/plan/check", authMiddleware, adminOnly, async (req, res) => {
    try {
      const rok = Number(req.query.rok);
      const miesiac = Number(req.query.miesiac);
      if (!rok || !miesiac) return res.status(400).json({ message: "Brak rok/miesiac" });
      const { db: dbInstance } = await import("./db");
      const { clientSalesWeekly: csw } = await import("@shared/schema");
      const { eq: eqFn, and: andFn } = await import("drizzle-orm");
      const existing = await dbInstance.select().from(csw)
        .where(andFn(eqFn(csw.rok, rok), eqFn(csw.miesiac, miesiac)));
      res.json({ exists: existing.length > 0, count: existing.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/plan/auto-generate", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { rok, miesiac, wspolczynnik } = req.body;
      if (!rok || !miesiac) return res.status(400).json({ message: "Brak rok/miesiac" });
      const result = await storage.autoGeneratePlan(rok, miesiac, wspolczynnik || 1.05);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/sales-targets/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { planObrotu, wykonanieObrotu } = req.body;
      const updated = await storage.updateSalesTarget(id, { planObrotu, wykonanieObrotu });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/sales-targets", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { rok, targets } = req.body;
      if (!rok || !targets) return res.status(400).json({ message: "Brak rok/targets" });
      const result = await storage.updateSalesTargetsBulk(rok, targets);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/sales-targets/sync-execution", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { rok } = req.body;
      if (!rok) return res.status(400).json({ message: "Brak rok" });
      const result = await storage.syncSalesTargetsForYear(rok);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/notes", authMiddleware, async (req, res) => {
    try {
      const notes = await storage.getNotes();
      res.json(notes);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/notes", authMiddleware, async (req, res) => {
    try {
      const note = await storage.createNote(req.body);
      res.json(note);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}

function parseCSV(content: string): Record<string, string>[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "\n" && !inQuotes) {
      lines.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) lines.push(current);

  if (lines.length < 2) return [];

  const headers = lines[0].replace(/\r$/, "").split(",").map(h => h.replace(/^"|"$/g, "").trim());
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    if (!line.trim()) continue;

    const values: string[] = [];
    let val = "";
    let inQ = false;

    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        if (inQ && line[j + 1] === '"') {
          val += '"';
          j++;
        } else {
          inQ = !inQ;
        }
      } else if (c === "," && !inQ) {
        values.push(val);
        val = "";
      } else {
        val += c;
      }
    }
    values.push(val);

    const row: Record<string, string> = {};
    for (let k = 0; k < headers.length; k++) {
      row[headers[k]] = (values[k] || "").trim();
    }
    results.push(row);
  }

  return results;
}

function parseNotatkiFields(notatki: string): {
  rabat?: string; warunkiPlatnosci?: string; terminPlatnosci?: string;
  limitKredytowy?: string; osobaKontaktowa?: string;
} {
  const result: any = {};

  const rabatMatch = notatki.match(/Rabat\s*\(%?\)?\s*:?\s*(\d+)/i) || notatki.match(/Rabat\s+(\d+)%/i);
  if (rabatMatch) result.rabat = rabatMatch[1];

  const warunkiMatch = notatki.match(/Warunki\s+p[łl]atno[śs]ci\s*:?\s*([^\n|]+)/i);
  if (warunkiMatch) result.warunkiPlatnosci = warunkiMatch[1].trim();

  const terminMatch = notatki.match(/Termin\s+p[łl]atno[śs]ci\s*\(dni\)\s*:?\s*(\d+)/i);
  if (terminMatch) result.terminPlatnosci = terminMatch[1];

  const limitMatch = notatki.match(/Limit\s+kredytowy\s*:?\s*(\d+)/i);
  if (limitMatch) result.limitKredytowy = limitMatch[1];

  const kontaktMatch = notatki.match(/Kontakt:\s*([^\n|]+)/i);
  if (kontaktMatch) {
    const val = kontaktMatch[1].trim();
    if (!val.toLowerCase().includes("brak")) result.osobaKontaktowa = val;
  }

  return result;
}
