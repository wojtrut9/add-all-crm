import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import cron from "node-cron";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message: "Internal Server Error" });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });

  // iBiznes sync twice daily at 13:00 and 16:00 (Europe/Warsaw)
  if (process.env.IBIZNES_DB_URL) {
    cron.schedule(
      "0 13,16 * * *",
      async () => {
        log("Starting scheduled iBiznes sync", "ibiznes-cron");
        try {
          const { runIbiznesSync } = await import("./ibiznesSync");
          await runIbiznesSync("cron");
          log("Scheduled iBiznes sync completed", "ibiznes-cron");
        } catch (err: any) {
          log(`Scheduled iBiznes sync failed: ${err.message}`, "ibiznes-cron");
        }
      },
      { timezone: "Europe/Warsaw" }
    );
    log("iBiznes sync scheduled (13:00 & 16:00 Europe/Warsaw)", "ibiznes-cron");
  }

  // KSeF sync raz dziennie o 06:00 (Europe/Warsaw) — faktury kosztowe pojawiają
  // się w KSeF w ciągu doby od wystawienia, ranny sync wyciąga wczorajsze FV.
  if (process.env.KSEF_TOKEN && process.env.KSEF_NIP) {
    cron.schedule(
      "0 6 * * *",
      async () => {
        log("Starting scheduled KSeF sync", "ksef-cron");
        try {
          const { runKsefSync } = await import("./ksefSync");
          await runKsefSync("cron");
          log("Scheduled KSeF sync completed", "ksef-cron");
        } catch (err: any) {
          log(`Scheduled KSeF sync failed: ${err.message}`, "ksef-cron");
        }
      },
      { timezone: "Europe/Warsaw" }
    );
    log("KSeF sync scheduled (06:00 Europe/Warsaw)", "ksef-cron");
  }

  } catch (err) {
    console.error("FATAL: Failed to start server:", err);
    process.exit(1);
  }
})();
