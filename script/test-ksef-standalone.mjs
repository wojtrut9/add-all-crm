/**
 * Minimalny standalone test KSeF — bez TSX, bez importu projektu.
 * Działa na czystym Node 20+ (potrzeba: globalne fetch + crypto.X509Certificate).
 *
 * Uruchomienie:
 *   node script/test-ksef-standalone.mjs
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ── Wczytaj .env (zawsze nadpisuje shell env — żeby zmiana w pliku miała
//    natychmiastowy skutek bez czyszczenia środowiska shella).
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}

const ENV = (process.env.KSEF_ENV || "test").toLowerCase();
const BASE_URLS = {
  test: "https://api-test.ksef.mf.gov.pl/v2",
  demo: "https://api-demo.ksef.mf.gov.pl/v2",
  prod: "https://api.ksef.mf.gov.pl/v2",
};
const BASE_URL = BASE_URLS[ENV] || BASE_URLS.test;
const NIP = (process.env.KSEF_NIP || "").replace(/[-\s]/g, "");
const RAW_TOKEN = process.env.KSEF_TOKEN || "";

// UWAGA: KSeF 2.0 API wymaga przesłania CAŁEGO bundla `{ref}|nip-{NIP}|{hash}`
// jako wartość tokenKSeF w payloadzie `{tokenKSeF}|{timestampMs}`. Sam hash
// (mimo że dokumentacja C#/Java tak sugeruje) zwraca "Invalid token encoding".
const TOKEN = RAW_TOKEN.trim();

console.log("════════════════════════════════════════════════════════════");
console.log("  KSeF STANDALONE SMOKE TEST");
console.log("════════════════════════════════════════════════════════════");
console.log("Środowisko:", ENV.toUpperCase());
console.log("Base URL:  ", BASE_URL);
console.log("NIP:       ", NIP || "(brak)");
console.log("Token:     ", TOKEN ? `(${TOKEN.length} znaków, ${TOKEN.slice(0, 6)}…${TOKEN.slice(-4)})` : "(brak)");
console.log();

if (!TOKEN || !NIP) {
  console.error("✗ KSEF_TOKEN lub KSEF_NIP nie ustawione w .env");
  process.exit(1);
}

async function ksef(method, pathStr, { body, bearer, query } = {}) {
  const url = new URL(BASE_URL + pathStr);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KSeF ${method} ${pathStr} → ${res.status}: ${text.slice(0, 500)}`);
  }
  if (res.status === 204) return undefined;
  return await res.json();
}

async function main() {
  // 1. Challenge
  console.log("[1/5] POST /auth/challenge");
  const challenge = await ksef("POST", "/auth/challenge");
  console.log("    challenge:", challenge.challenge);
  console.log("    timestamp:", challenge.timestamp, `(ms: ${challenge.timestampMs})`);
  console.log();

  // 2. Klucz publiczny
  console.log("[2/5] GET /security/public-key-certificates");
  const certs = await ksef("GET", "/security/public-key-certificates");
  const now = new Date();
  const tokenCert = certs
    .filter((c) => c.usage.includes("KsefTokenEncryption"))
    .filter((c) => new Date(c.validFrom) <= now && new Date(c.validTo) > now)
    .sort((a, b) => new Date(b.validTo) - new Date(a.validTo))[0];
  if (!tokenCert) throw new Error("Brak aktywnego certyfikatu KsefTokenEncryption");
  console.log("    cert publicKeyId:", tokenCert.publicKeyId.slice(0, 30) + "…");
  console.log("    ważny do:        ", tokenCert.validTo);

  const certDer = Buffer.from(tokenCert.certificate, "base64");
  const x509 = new crypto.X509Certificate(certDer);
  const publicKeyPem = x509.publicKey.export({ format: "pem", type: "spki" });
  console.log();

  // 3. Szyfrowanie tokena
  console.log("[3/5] Szyfrowanie tokena RSA-OAEP SHA-256");
  const payload = Buffer.from(`${TOKEN}|${challenge.timestampMs}`, "utf-8");
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    payload,
  );
  const encryptedB64 = encrypted.toString("base64");
  console.log("    encryptedToken (Base64):", encryptedB64.slice(0, 40) + "…", `(${encryptedB64.length} znaków)`);
  console.log();

  // 4. /auth/ksef-token
  console.log("[4/5] POST /auth/ksef-token");
  const initResp = await ksef("POST", "/auth/ksef-token", {
    body: {
      challenge: challenge.challenge,
      contextIdentifier: { type: "Nip", value: NIP },
      encryptedToken: encryptedB64,
      publicKeyId: tokenCert.publicKeyId,
    },
  });
  console.log("    referenceNumber:    ", initResp.referenceNumber);
  console.log("    authenticationToken:", initResp.authenticationToken.token.slice(0, 30) + "…");
  console.log("    ważny do:           ", initResp.authenticationToken.validUntil);

  // Polling statusu
  const refNum = initResp.referenceNumber;
  const tempToken = initResp.authenticationToken.token;
  let lastStatus = 0;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const status = await ksef("GET", `/auth/${refNum}`, { bearer: tempToken });
    lastStatus = status.status.code;
    if (lastStatus === 200) {
      console.log(`    auth status: ${lastStatus} ${status.status.description}`);
      break;
    }
    if (lastStatus !== 100) {
      console.log();
      console.log("    FULL STATUS RESPONSE FROM KSEF:");
      console.log(JSON.stringify(status, null, 2));
      throw new Error(`Auth failed: ${lastStatus} ${status.status.description}`);
    }
    process.stdout.write(`\r    auth status: ${lastStatus} (oczekiwanie...)`);
    await new Promise((r) => setTimeout(r, 800));
  }
  console.log();
  if (lastStatus !== 200) throw new Error("Auth timeout");

  // Redeem
  const tokens = await ksef("POST", "/auth/token/redeem", { bearer: tempToken });
  console.log("    accessToken:", tokens.accessToken.token.slice(0, 30) + "…");
  console.log("    ważny do:   ", tokens.accessToken.validUntil);
  console.log();

  // 5. Query metadata (ostatnie 30 dni)
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 30);
  const dateFrom = start.toISOString().slice(0, 10);
  const dateTo = today.toISOString().slice(0, 10);

  console.log(`[5/5] POST /invoices/query/metadata (zakres: ${dateFrom} .. ${dateTo})`);
  const response = await ksef("POST", "/invoices/query/metadata", {
    bearer: tokens.accessToken.token,
    query: { pageOffset: 0, pageSize: 250, sortOrder: "Asc" },
    body: {
      subjectType: "Subject2",
      dateRange: {
        dateType: "Issue",
        from: `${dateFrom}T00:00:00+01:00`,
        to: `${dateTo}T23:59:59+01:00`,
      },
    },
  });

  console.log(`    hasMore: ${response.hasMore}, isTruncated: ${response.isTruncated}`);
  console.log(`    pobrano: ${response.invoices.length} faktur`);
  console.log();

  if (response.invoices.length === 0) {
    console.log("ℹ Środowisko TEST jest puste dla NIP", NIP);
    console.log("  - To normalne na TE (faktury są resetowane / współdzielone).");
    console.log("  - Do realnych danych użyj KSEF_ENV=prod z produkcyjnym tokenem.");
    return;
  }

  console.log("────────────────────────────────────────────────────────────");
  let totalNet = 0;
  let totalGross = 0;
  const bySupplier = new Map();
  for (const inv of response.invoices) {
    totalNet += inv.netAmount || 0;
    totalGross += inv.grossAmount || 0;
    const key = inv.seller?.nip || "?";
    const e = bySupplier.get(key) ?? { name: inv.seller?.name || "?", net: 0, count: 0 };
    e.net += inv.netAmount || 0;
    e.count += 1;
    bySupplier.set(key, e);
  }
  console.log("Suma netto: ", totalNet.toFixed(2), "PLN");
  console.log("Suma brutto:", totalGross.toFixed(2), "PLN");
  console.log();
  console.log("Top 10 dostawców:");
  for (const [nip, info] of [...bySupplier.entries()].sort((a, b) => b[1].net - a[1].net).slice(0, 10)) {
    console.log(`  ${nip.padEnd(12)} ${info.net.toFixed(2).padStart(12)} PLN  (${info.count} FV)  ${info.name}`);
  }
  console.log();

  console.log("Przykład 3 faktur:");
  for (const inv of response.invoices.slice(0, 3)) {
    console.log(`  [${inv.issueDate}] ${inv.invoiceNumber}  netto: ${inv.netAmount} ${inv.currency}`);
    console.log(`    Sprzedawca: ${inv.seller?.name} (NIP ${inv.seller?.nip})`);
    console.log(`    KSeF#: ${inv.ksefNumber}`);
  }
}

main()
  .then(() => {
    console.log();
    console.log("✓ Smoke test zakończony pomyślnie.");
    process.exit(0);
  })
  .catch((err) => {
    console.error();
    console.error("✗ BŁĄD:", err.message);
    process.exit(1);
  });
