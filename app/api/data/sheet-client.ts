import { createSign } from "node:crypto";
import type { Row } from "./parser";

const SHEET_ID = "1QPX7i199rMYkYo0aXwzwjTaauJ7oWLAPworBD7VV5OQ";
const SERVICE_ACCOUNT_EMAIL =
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
  "aropetsales@neural-myth-506709-f5.iam.gserviceaccount.com";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const READ_ONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const SHEET_TITLES = new Map<number, string>([
  [1761957984, "쿠팡_2026년 월별 GMV 실적"],
  [1036898751, "쿠팡_로켓 브랜드별 GMV 및 재고매출"],
  [1506076158, "쿠팡_품목별 GMV 및 재고매출"],
  [607458845, "쿠팡_GMV대비 마케팅비 비중"],
  [2000735419, "쿠팡_마케팅비 예산 집행 내역"],
  [1519343097, "쿠팡_매출차감행사비 내역"],
  [1123039991, "쿠팡_회계매출 세부내역"],
]);

let tokenCache: { accessToken: string; expiresAt: number } | null = null;
const rowCache = new Map<string, { rows: Row[]; expiresAt: number }>();
const rowRequests = new Map<string, Promise<Row[]>>();
const ROW_CACHE_MS = 5_000;

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function privateKey() {
  const value = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  ).trim();
  if (!value?.includes("BEGIN PRIVATE KEY")) {
    throw new Error("Google service-account private key is not configured");
  }
  return value;
}

async function accessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: SERVICE_ACCOUNT_EMAIL,
      scope: READ_ONLY_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsignedJwt = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();
  const assertion = `${unsignedJwt}.${base64Url(signer.sign(privateKey()))}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Google OAuth authentication failed");

  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Google OAuth token is missing");
  tokenCache = {
    accessToken: body.access_token,
    expiresAt: Date.now() + Math.min(body.expires_in || 3600, 3600) * 1000,
  };
  return body.access_token;
}

async function googleJson<T>(url: string): Promise<T> {
  const token = await accessToken();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Google Sheets API failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function readSheetRows(gid: number, range: string): Promise<Row[]> {
  const title = SHEET_TITLES.get(gid);
  if (!title) throw new Error("Configured Google Sheet tab was not found");
  const cacheKey = `${gid}:${range}`;
  const cached = rowCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.rows;
  const pending = rowRequests.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    const quotedTitle = `'${title.replace(/'/g, "''")}'`;
    const data = await googleJson<{ values?: unknown[][] }>(
      `${GOOGLE_SHEETS_API}/${SHEET_ID}/values/${encodeURIComponent(`${quotedTitle}!${range}`)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,
    );
    const rows = (data.values || []).map((row) =>
      row.map((cell) => (cell == null ? "" : String(cell))),
    );
    rowCache.set(cacheKey, { rows, expiresAt: Date.now() + ROW_CACHE_MS });
    return rows;
  })().finally(() => {
    rowRequests.delete(cacheKey);
  });
  rowRequests.set(cacheKey, request);
  return request;
}
