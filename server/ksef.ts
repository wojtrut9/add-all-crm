/**
 * Klient API KSeF 2.0 (Krajowy System e-Faktur).
 *
 * Obsługuje:
 *  - uwierzytelnianie tokenem KSeF (RSA-OAEP SHA-256 + challenge),
 *  - cache accessToken/refreshToken w bazie (jeden wiersz na NIP),
 *  - automatyczne odświeżanie wygasłego accessToken przez refreshToken,
 *  - pobieranie metadanych faktur kosztowych (Subject2 = nabywca).
 *
 * Specyfikacja API: https://api-test.ksef.mf.gov.pl/docs/v2 oraz
 * https://github.com/CIRFMF/ksef-docs (autoryzacja + pobieranie faktur).
 *
 * Środowiska:
 *  - test: https://api-test.ksef.mf.gov.pl/v2  (KSEF_ENV=test)
 *  - demo: https://api-demo.ksef.mf.gov.pl/v2  (KSEF_ENV=demo)
 *  - prod: https://api.ksef.mf.gov.pl/v2       (KSEF_ENV=prod)
 *
 * Wymagane zmienne środowiskowe:
 *  - KSEF_TOKEN: poufny token wydany w panelu KSeF (uprawnienie InvoiceRead).
 *  - KSEF_NIP:   NIP kontekstu (ADD ALL Sp. z o.o.).
 *  - KSEF_ENV:   'test' | 'demo' | 'prod' (domyślnie 'test').
 */

import crypto from "node:crypto";
import { db } from "./db";
import { ksefTokenCache } from "../shared/schema";
import { eq } from "drizzle-orm";

const KSEF_ENV = (process.env.KSEF_ENV || "test").toLowerCase();

const BASE_URLS: Record<string, string> = {
  test: "https://api-test.ksef.mf.gov.pl/v2",
  demo: "https://api-demo.ksef.mf.gov.pl/v2",
  prod: "https://api.ksef.mf.gov.pl/v2",
};

export function getKsefBaseUrl(): string {
  return BASE_URLS[KSEF_ENV] || BASE_URLS.test;
}

export function getKsefEnv(): string {
  return KSEF_ENV;
}

export function getKsefNip(): string {
  const nip = process.env.KSEF_NIP || "";
  return nip.replace(/[-\s]/g, "");
}

export function isKsefConfigured(): boolean {
  return Boolean(process.env.KSEF_TOKEN && process.env.KSEF_NIP);
}

/**
 * Zwraca pełną wartość tokena tak jak KSeF eksportuje go z panelu:
 *   `{numerReferencyjny}|nip-{NIP}|{hash}`.
 *
 * Empirycznie zweryfikowane: API KSeF 2.0 (POST /auth/ksef-token) akceptuje
 * `tokenKSeF` w payloadzie `{tokenKSeF}|{timestampMs}` WYŁĄCZNIE w formie
 * całego bundla. Sam hash (mimo że dokumentacja C#/Java tak sugeruje)
 * zwraca błąd "Invalid token encoding". Sprawdzone na env=prod 2026-05-15.
 *
 * Tolerujemy też wklejenie samego hasha (część integratorów ma tylko hash)
 * — w takim wypadku trzeba podać też KSEF_TOKEN_REF i KSEF_NIP.
 */
function buildTokenPayload(raw: string): string {
  return raw.trim();
}

// ── Typy odpowiedzi API ─────────────────────────────────────────────────────

interface PublicKeyCertificate {
  certificate: string;       // Base64 DER X.509
  certificateId: string;
  publicKeyId: string;
  validFrom: string;
  validTo: string;
  usage: string[];           // np. ["KsefTokenEncryption"]
}

interface AuthChallengeResponse {
  challenge: string;
  timestamp: string;
  timestampMs: number;
  clientIp: string;
}

interface AuthInitResponse {
  referenceNumber: string;
  authenticationToken: {
    token: string;
    validUntil: string;
  };
}

interface AuthStatusResponse {
  status: { code: number; description: string };
  startDate: string;
  authenticationMethodInfo?: { code: string; displayName: string; category: string };
}

interface AuthTokensResponse {
  accessToken: { token: string; validUntil: string };
  refreshToken: { token: string; validUntil: string };
}

export interface KsefInvoiceMetadata {
  ksefNumber: string;
  invoiceNumber: string;
  issueDate: string;          // yyyy-MM-dd
  invoicingDate: string;
  acquisitionDate: string;
  permanentStorageDate: string;
  seller: { nip: string; name?: string };
  buyer: {
    identifier: { type: string; value: string };
    name?: string;
  };
  netAmount: number;
  grossAmount: number;
  vatAmount: number;
  currency: string;
  invoiceHash: string;
  formCode?: { value?: string };
}

interface QueryMetadataResponse {
  hasMore: boolean;
  isTruncated: boolean;
  invoices: KsefInvoiceMetadata[];
}

// ── HTTP helper ─────────────────────────────────────────────────────────────

async function ksefRequest<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  options: { body?: unknown; bearer?: string; query?: Record<string, string | number> } = {},
): Promise<T> {
  const url = new URL(getKsefBaseUrl() + path);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.bearer) headers.Authorization = `Bearer ${options.bearer}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KSeF ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Klucz publiczny + szyfrowanie tokena ────────────────────────────────────

let cachedPublicKey: { keyPem: string; publicKeyId: string; certValidTo: Date } | null = null;

async function getKsefPublicKey(): Promise<{ keyPem: string; publicKeyId: string }> {
  if (cachedPublicKey && cachedPublicKey.certValidTo > new Date()) {
    return { keyPem: cachedPublicKey.keyPem, publicKeyId: cachedPublicKey.publicKeyId };
  }

  const certs = await ksefRequest<PublicKeyCertificate[]>("GET", "/security/public-key-certificates");
  const now = new Date();
  // Wybierz pierwszy aktywny certyfikat z usage="KsefTokenEncryption".
  const tokenCerts = certs
    .filter((c) => c.usage.includes("KsefTokenEncryption"))
    .filter((c) => new Date(c.validFrom) <= now && new Date(c.validTo) > now)
    .sort((a, b) => new Date(b.validTo).getTime() - new Date(a.validTo).getTime());

  if (tokenCerts.length === 0) {
    throw new Error("KSeF: brak aktywnego certyfikatu z usage=KsefTokenEncryption");
  }
  const cert = tokenCerts[0];

  // Certyfikat jest w formacie DER zakodowany Base64. Wyciągamy z niego klucz
  // publiczny i konwertujemy na PEM (crypto.publicEncrypt go zaakceptuje).
  const certDer = Buffer.from(cert.certificate, "base64");
  const x509 = new crypto.X509Certificate(certDer);
  const keyPem = x509.publicKey.export({ format: "pem", type: "spki" }) as string;

  cachedPublicKey = {
    keyPem,
    publicKeyId: cert.publicKeyId,
    certValidTo: new Date(cert.validTo),
  };
  return { keyPem, publicKeyId: cert.publicKeyId };
}

function encryptTokenForKsef(token: string, timestampMs: number, publicKeyPem: string): string {
  const payload = Buffer.from(`${token}|${timestampMs}`, "utf-8");
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    payload,
  );
  return encrypted.toString("base64");
}

// ── Pełna procedura auth tokenem KSeF ───────────────────────────────────────

async function authenticateWithKsefToken(): Promise<AuthTokensResponse> {
  const rawToken = process.env.KSEF_TOKEN;
  const nip = getKsefNip();

  if (!rawToken) throw new Error("KSEF_TOKEN nie jest ustawiony");
  if (!nip) throw new Error("KSEF_NIP nie jest ustawiony");

  const token = buildTokenPayload(rawToken);

  // 1. Challenge
  const challenge = await ksefRequest<AuthChallengeResponse>("POST", "/auth/challenge");

  // 2. Klucz publiczny + szyfrowanie tokena
  const { keyPem, publicKeyId } = await getKsefPublicKey();
  const encryptedToken = encryptTokenForKsef(token, challenge.timestampMs, keyPem);

  // 3. /auth/ksef-token
  const initResponse = await ksefRequest<AuthInitResponse>("POST", "/auth/ksef-token", {
    body: {
      challenge: challenge.challenge,
      contextIdentifier: { type: "Nip", value: nip },
      encryptedToken,
      publicKeyId,
    },
  });

  const tempToken = initResponse.authenticationToken.token;
  const referenceNumber = initResponse.referenceNumber;

  // 4. Czekaj aż status uwierzytelnienia = 200 (success). Max 30s.
  const deadline = Date.now() + 30_000;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    const status = await ksefRequest<AuthStatusResponse>(
      "GET",
      `/auth/${referenceNumber}`,
      { bearer: tempToken },
    );
    lastStatus = status.status.code;
    if (lastStatus === 200) break;
    // Kody błędów (415, 425, 450, …) — przerwij od razu.
    if (lastStatus !== 100) {
      throw new Error(`KSeF auth failed: ${lastStatus} ${status.status.description}`);
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  if (lastStatus !== 200) throw new Error("KSeF auth timeout (>30s)");

  // 5. Redeem → accessToken + refreshToken
  return ksefRequest<AuthTokensResponse>("POST", "/auth/token/redeem", { bearer: tempToken });
}

async function refreshAccessToken(refreshToken: string): Promise<{ token: string; validUntil: string }> {
  // Endpoint zwraca obiekt z polem accessToken (refresh nie wymaga body).
  const res = await ksefRequest<{ accessToken: { token: string; validUntil: string } }>(
    "POST",
    "/auth/token/refresh",
    { bearer: refreshToken },
  );
  return res.accessToken;
}

// ── Cache tokenów w DB ──────────────────────────────────────────────────────

const TOKEN_SAFETY_MARGIN_MS = 60_000; // odśwież 60s przed wygaśnięciem

async function loadCachedTokens(nip: string) {
  const rows = await db
    .select()
    .from(ksefTokenCache)
    .where(eq(ksefTokenCache.nip, nip))
    .limit(1);
  return rows[0] ?? null;
}

async function saveTokens(
  nip: string,
  tokens: { accessToken: { token: string; validUntil: string }; refreshToken: { token: string; validUntil: string } },
) {
  const existing = await loadCachedTokens(nip);
  const values = {
    nip,
    environment: getKsefEnv(),
    accessToken: tokens.accessToken.token,
    accessValidUntil: new Date(tokens.accessToken.validUntil),
    refreshToken: tokens.refreshToken.token,
    refreshValidUntil: new Date(tokens.refreshToken.validUntil),
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(ksefTokenCache).set(values).where(eq(ksefTokenCache.id, existing.id));
  } else {
    await db.insert(ksefTokenCache).values(values);
  }
}

async function saveAccessToken(nip: string, accessToken: { token: string; validUntil: string }) {
  await db
    .update(ksefTokenCache)
    .set({
      accessToken: accessToken.token,
      accessValidUntil: new Date(accessToken.validUntil),
      updatedAt: new Date(),
    })
    .where(eq(ksefTokenCache.nip, nip));
}

/**
 * Zwraca ważny accessToken — wykorzystując cache, refreshToken, lub pełną
 * procedurę auth w razie potrzeby.
 */
export async function getKsefAccessToken(): Promise<string> {
  if (!isKsefConfigured()) {
    throw new Error("KSeF: brak konfiguracji (KSEF_TOKEN / KSEF_NIP)");
  }
  const nip = getKsefNip();
  const cached = await loadCachedTokens(nip);
  const now = Date.now();

  // Cache pasuje do bieżącego środowiska i accessToken jeszcze ważny?
  if (cached && cached.environment === getKsefEnv()) {
    if (
      cached.accessToken &&
      cached.accessValidUntil &&
      cached.accessValidUntil.getTime() - TOKEN_SAFETY_MARGIN_MS > now
    ) {
      return cached.accessToken;
    }

    // Spróbuj odświeżyć przez refreshToken.
    if (
      cached.refreshToken &&
      cached.refreshValidUntil &&
      cached.refreshValidUntil.getTime() - TOKEN_SAFETY_MARGIN_MS > now
    ) {
      try {
        const newAccess = await refreshAccessToken(cached.refreshToken);
        await saveAccessToken(nip, newAccess);
        return newAccess.token;
      } catch (err: any) {
        // Refresh nieudany (np. token unieważniony) — fallback do pełnego auth.
        console.warn(`[ksef] refresh failed, falling back to full auth: ${err.message}`);
      }
    }
  }

  // Pełna procedura auth.
  const tokens = await authenticateWithKsefToken();
  await saveTokens(nip, tokens);
  return tokens.accessToken.token;
}

// ── Diagnostyka ─────────────────────────────────────────────────────────────

export async function testKsefConnection(): Promise<{ ok: boolean; message?: string }> {
  if (!isKsefConfigured()) {
    return { ok: false, message: "Brak KSEF_TOKEN/KSEF_NIP w env" };
  }
  try {
    await getKsefAccessToken();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

// ── Pobieranie metadanych faktur ────────────────────────────────────────────

/**
 * Pobiera metadane wszystkich faktur kosztowych (Subject2 = nabywca) w
 * podanym zakresie dat. API limituje zakres do 3 miesięcy, więc rozbijamy
 * dłuższe zakresy na 3-miesięczne kawałki.
 *
 * Daty w formacie yyyy-MM-dd; konwertowane na ISO-8601 z offsetem WAW.
 */
export async function fetchKsefCostInvoices(
  dateFrom: string,
  dateTo: string,
): Promise<KsefInvoiceMetadata[]> {
  const accessToken = await getKsefAccessToken();
  const ranges = splitIntoMonthChunks(dateFrom, dateTo, 3);
  const all: KsefInvoiceMetadata[] = [];

  for (const range of ranges) {
    let pageOffset = 0;
    const pageSize = 250; // max wg specyfikacji
    while (true) {
      const response = await ksefRequest<QueryMetadataResponse>(
        "POST",
        "/invoices/query/metadata",
        {
          bearer: accessToken,
          query: { pageOffset, pageSize, sortOrder: "Asc" },
          body: {
            subjectType: "Subject2",
            dateRange: {
              dateType: "Issue",
              from: `${range.from}T00:00:00+01:00`,
              to: `${range.to}T23:59:59+01:00`,
            },
          },
        },
      );
      all.push(...response.invoices);
      if (!response.hasMore || response.invoices.length === 0) break;
      pageOffset++;
      if (pageOffset > 200) {
        // Sanity guard: 200 stron × 250 = 50k faktur — nie powinno się zdarzyć
        // dla pojedynczej firmy w 3-miesięcznym oknie.
        console.warn(`[ksef] paginacja przekroczyła 200 stron dla zakresu ${range.from}..${range.to}`);
        break;
      }
    }
  }

  return all;
}

/** Dzieli zakres [from..to] na N-miesięczne kawałki (włącznie z brzegami). */
function splitIntoMonthChunks(
  dateFrom: string,
  dateTo: string,
  maxMonths: number,
): Array<{ from: string; to: string }> {
  const result: Array<{ from: string; to: string }> = [];
  const finalDate = new Date(dateTo + "T00:00:00Z");
  let cursor = new Date(dateFrom + "T00:00:00Z");

  while (cursor <= finalDate) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCMonth(chunkEnd.getUTCMonth() + maxMonths);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() - 1);
    if (chunkEnd > finalDate) chunkEnd.setTime(finalDate.getTime());

    result.push({
      from: cursor.toISOString().slice(0, 10),
      to: chunkEnd.toISOString().slice(0, 10),
    });

    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}
