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

  app.post("/api/clients/import", authMiddleware, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Brak pliku" });

      const content = req.file.buffer.toString("utf-8");
      const lines = parseCSV(content);
      let count = 0;

      for (const row of lines) {
        if (!row.Klient && !row.klient) continue;

        const notatki = row.Notatki || row.notatki || "";
        const parsed = parseNotatkiFields(notatki);

        try {
          await storage.createClient({
            klient: row.Klient || row.klient || "",
            clientId: row.Client_ID || row.client_id || `C${Date.now()}`,
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
          count++;
        } catch (e: any) {
          // skip duplicates
        }
      }

      res.json({ count });
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

  app.post("/api/contacts/generate-week", authMiddleware, async (req, res) => {
    try {
      const { weekStart } = req.body;
      const user = (req as any).user;
      const opiekun = user.rola === "handlowiec" ? user.imie : undefined;

      const allClients = await storage.getClients(opiekun);
      const activeClients = allClients.filter(c => c.aktywny);

      let count = 0;
      const dayMap: Record<string, number> = {
        "Poniedzialek": 0, "Poniedziałek": 0,
        "Wtorek": 1,
        "Sroda": 2, "Środa": 2,
        "Czwartek": 3,
        "Piatek": 4, "Piątek": 4,
        "Sobota": 5,
        "Niedziela": 6,
      };

      const wsDate = new Date(weekStart);
      const weekOfMonth = Math.ceil(wsDate.getDate() / 7);

      for (const client of activeClients) {
        const rytm = (client.rytmKontaktu || "").toLowerCase();
        const dniStr = client.dniZamowien || "";

        let shouldGenerate = false;
        if (rytm.includes("1x/tydz") || rytm.includes("2x/tydz")) {
          shouldGenerate = true;
        } else if (rytm.includes("1x/mies")) {
          shouldGenerate = weekOfMonth === 1;
        } else if (rytm.includes("2x/mies")) {
          shouldGenerate = weekOfMonth === 1 || weekOfMonth === 3;
        } else if (rytm.includes("co 3 mies")) {
          const monthNum = wsDate.getMonth();
          shouldGenerate = weekOfMonth === 1 && monthNum % 3 === 0;
        } else {
          shouldGenerate = true;
        }

        if (!shouldGenerate) continue;

        const dni = dniStr.split(",").map(d => d.trim());
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
      const { status, kwota, ...rest } = req.body;

      const contact = await storage.getContact(id);
      if (!contact) return res.status(404).json({ message: "Kontakt nie znaleziony" });

      const updateData: any = { ...rest };
      if (status) updateData.status = status;
      if (kwota !== undefined) updateData.kwota = kwota;

      await storage.updateContact(id, updateData);

      if (status === "Zamowil") {
        await storage.updateClient(contact.clientId, { brakiZamowien: 0 });

        if (kwota && Number(kwota) > 0) {
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
            wartoscNettoWz: kwota,
            platnosc: client?.warunkiPlatnosci || "do potwierdzenia",
          });
        }
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
      const data = await storage.getFinanceData();
      res.json(data);
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

  app.get("/api/plan", authMiddleware, async (req, res) => {
    try {
      const rok = Number(req.query.rok) || 2026;
      const miesiac = Number(req.query.miesiac) || 2;
      const user = (req as any).user;
      const opiekun = user.rola === "handlowiec" ? user.imie : undefined;
      const data = await storage.getPlanData(rok, miesiac, opiekun);
      res.json(data);
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
