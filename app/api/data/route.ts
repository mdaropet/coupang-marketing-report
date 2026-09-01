import { createSign } from "node:crypto";
import { NextResponse } from "next/server";
import { parseDashboardSheets, type DashboardSheets, type Row } from "./parser";
import { checkRateLimit } from "./rate-limit";

const SHEET_ID = "1QPX7i199rMYkYo0aXwzwjTaauJ7oWLAPworBD7VV5OQ";
const GIDS = {
  monthly: 1761957984,
  brand: 1036898751,
  item: 1506076158,
  ratio: 607458845,
  budget: 2000735419,
  deduction: 1519343097,
  accounting: 1123039991,
} as const;
const SHEETS: Record<keyof DashboardSheets, { gid: number; title: string }> = {
  monthly: { gid: GIDS.monthly, title: "쿠팡_2026년 월별 GMV 실적" },
  brand: { gid: GIDS.brand, title: "쿠팡_로켓 브랜드별 GMV 및 재고매출" },
  item: { gid: GIDS.item, title: "쿠팡_품목별 GMV 및 재고매출" },
  ratio: { gid: GIDS.ratio, title: "쿠팡_GMV대비 마케팅비 비중" },
  budget: { gid: GIDS.budget, title: "쿠팡_마케팅비 예산 집행 내역" },
  deduction: { gid: GIDS.deduction, title: "쿠팡_매출차감행사비 내역" },
  accounting: { gid: GIDS.accounting, title: "쿠팡_회계매출 세부내역" },
};
const SERVICE_ACCOUNT_EMAIL =
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
  "aropetsales@neural-myth-506709-f5.iam.gserviceaccount.com";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const READ_ONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const API_SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

let tokenCache: { accessToken: string; expiresAt: number } | null = null;
let sheetCache: { data: DashboardSheets; expiresAt: number } | null = null;
let sheetRequest: Promise<DashboardSheets> | null = null;
// Coalesce duplicate dashboard loads without serving stale data after a Sheets failure.
const SHEET_CACHE_MS = 5_000;

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

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
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

async function fetchDashboardSheets(): Promise<DashboardSheets> {
  const entries = Object.entries(SHEETS) as [keyof DashboardSheets, (typeof SHEETS)[keyof DashboardSheets]][];
  const params = new URLSearchParams({
    majorDimension: "ROWS",
    valueRenderOption: "FORMATTED_VALUE",
  });
  for (const [, sheet] of entries) {
    const quotedTitle = `'${sheet.title.replace(/'/g, "''")}'`;
    params.append("ranges", `${quotedTitle}!A1:Z500`);
  }
  const response = await googleJson<{
    valueRanges?: { values?: unknown[][] }[];
  }>(`${GOOGLE_SHEETS_API}/${SHEET_ID}/values:batchGet?${params.toString()}`);
  if (response.valueRanges?.length !== entries.length) {
    throw new Error("Google Sheets batch response is incomplete");
  }
  return Object.fromEntries(
    entries.map(([key, sheet], index) => {
      const values = response.valueRanges?.[index]?.values;
      if (!values) throw new Error(`Configured Google Sheet tab was not found: ${sheet.gid}`);
      const rows: Row[] = values.map((row) =>
        row.map((cell) => (cell == null ? "" : String(cell))),
      );
      return [key, rows] as const;
    }),
  ) as DashboardSheets;
}

async function dashboardSheets(): Promise<DashboardSheets> {
  if (sheetCache && sheetCache.expiresAt > Date.now()) return sheetCache.data;
  if (sheetRequest) return sheetRequest;
  sheetRequest = fetchDashboardSheets()
    .then((data) => {
      sheetCache = { data, expiresAt: Date.now() + SHEET_CACHE_MS };
      return data;
    })
    .finally(() => {
      sheetRequest = null;
    });
  return sheetRequest;
}

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request);
  const rateLimitHeaders = {
    "RateLimit-Limit": String(rateLimit.limit),
    "RateLimit-Remaining": String(rateLimit.remaining),
    "RateLimit-Reset": String(rateLimit.resetSeconds),
  };
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      {
        status: 429,
        headers: {
          ...API_SECURITY_HEADERS,
          ...rateLimitHeaders,
          "Retry-After": String(rateLimit.resetSeconds),
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }

  try {
    const data = parseDashboardSheets(await dashboardSheets());
    return NextResponse.json(
      { data, source: "Google Sheets", updatedAt: new Date().toISOString() },
      {
        headers: {
          ...API_SECURITY_HEADERS,
          ...rateLimitHeaders,
          "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error) {
    console.error(
      "Dashboard data refresh failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "원본 데이터를 불러오지 못했습니다." },
      {
        status: 502,
        headers: {
          ...API_SECURITY_HEADERS,
          ...rateLimitHeaders,
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }
}
