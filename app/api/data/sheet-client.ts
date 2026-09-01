import { createSign } from "node:crypto";
import type { Row } from "./parser";

const SHEET_ID = "1QPX7i199rMYkYo0aXwzwjTaauJ7oWLAPworBD7VV5OQ";
const SERVICE_ACCOUNT_EMAIL =
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
  "aropetsales@neural-myth-506709-f5.iam.gserviceaccount.com";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const READ_ONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

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
  const metadata = await googleJson<{
    sheets?: { properties?: { sheetId?: number; title?: string } }[];
  }>(`${GOOGLE_SHEETS_API}/${SHEET_ID}?fields=sheets(properties(sheetId,title))`);
  const title = metadata.sheets?.find((sheet) => sheet.properties?.sheetId === gid)?.properties?.title;
  if (!title) throw new Error("Configured Google Sheet tab was not found");
  const quotedTitle = `'${title.replace(/'/g, "''")}'`;
  const data = await googleJson<{ values?: unknown[][] }>(
    `${GOOGLE_SHEETS_API}/${SHEET_ID}/values/${encodeURIComponent(`${quotedTitle}!${range}`)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,
  );
  return (data.values || []).map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
}
