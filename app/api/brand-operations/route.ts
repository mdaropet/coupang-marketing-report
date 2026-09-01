import { NextResponse } from "next/server";
import { parseBrandOperations } from "../data/parser";
import { checkRateLimit } from "../data/rate-limit";
import { readSheetRows } from "../data/sheet-client";

const GID = 1036898751;
const API_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: Request) {
  const rate = checkRateLimit(request);
  const headers = {
    ...API_HEADERS,
    "RateLimit-Limit": String(rate.limit),
    "RateLimit-Remaining": String(rate.remaining),
    "RateLimit-Reset": String(rate.resetSeconds),
  };
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { ...headers, "Retry-After": String(rate.resetSeconds) } },
    );
  }
  try {
    const brands = parseBrandOperations(await readSheetRows(GID, "A1:Z500"));
    return NextResponse.json(
      { brands, source: "Google Sheets", updatedAt: new Date().toISOString() },
      { headers },
    );
  } catch (error) {
    console.error("Brand operations refresh failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "원본 데이터를 불러오지 못했습니다." }, { status: 502, headers });
  }
}
