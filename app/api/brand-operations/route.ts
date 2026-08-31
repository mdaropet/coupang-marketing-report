import { NextResponse } from "next/server";

const SPREADSHEET_ID = "1QPX7i199rMYkYo0aXwzwjTaauJ7oWLAPworBD7VV5OQ";
const GID = "1036898751";

type Row = string[];

type BrandOperations = {
  summaries: string[];
  plans: string[];
};

function parseCsv(input: string): Row[] {
  const rows: Row[] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { value += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(value); value = ""; }
    else if (char === "\n") { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += char;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

const clean = (value: unknown) => String(value ?? "").trim();
const normalize = (value: unknown) => clean(value).replace(/\s+/g, " ");
const empty = () => Array.from({ length: 12 }, () => "");

function monthIndex(value: unknown) {
  const match = clean(value).match(/(\d{1,2})월/);
  return match ? Math.max(0, Math.min(11, Number(match[1]) - 1)) : -1;
}

function markerBrand(value: unknown) {
  const text = normalize(value);
  const match = text.match(/^브랜드별 운영요약\s*-\s*(.+)$/);
  return match ? clean(match[1]) : "";
}

export async function GET() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}&range=A25:F125&_=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
    if (!response.ok) throw new Error(`Google Sheets response ${response.status}`);
    const rows = parseCsv(await response.text());
    const brands: Record<string, BrandOperations> = {};

    for (let i = 0; i < rows.length; i += 1) {
      const brand = markerBrand(rows[i]?.[0]);
      if (!brand) continue;
      const summaries = empty();
      const plans = empty();
      for (let j = i + 1; j < rows.length; j += 1) {
        if (markerBrand(rows[j]?.[0])) break;
        const index = monthIndex(rows[j]?.[0]);
        if (index < 0) continue;
        summaries[index] = clean(rows[j]?.[2]);
        plans[index] = clean(rows[j]?.[5]);
      }
      brands[brand] = { summaries, plans };
    }

    return NextResponse.json(
      { source: "Google Sheets A25:F125", brands, updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" } },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "브랜드 운영요약 조회 오류" }, { status: 500 });
  }
}
