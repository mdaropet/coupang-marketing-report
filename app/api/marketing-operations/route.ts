import { NextResponse } from "next/server";

const SPREADSHEET_ID = "1QPX7i199rMYkYo0aXwzwjTaauJ7oWLAPworBD7VV5OQ";
const GID = "607458845";

type Row = string[];

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
const monthIndex = (value: unknown) => {
  const match = clean(value).match(/(\d{1,2})월/);
  return match ? Number(match[1]) - 1 : -1;
};

export async function GET() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}&range=A9:F16&_=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
    if (!response.ok) throw new Error(`Google Sheets 응답 오류: ${response.status}`);
    const rows = parseCsv(await response.text());
    const summaries = Array.from({ length: 12 }, () => "");
    const plans = Array.from({ length: 12 }, () => "");
    rows.forEach((row) => {
      const index = monthIndex(row[0]);
      if (index < 0 || index > 11) return;
      summaries[index] = clean(row[2]);
      plans[index] = clean(row[5]);
    });
    return NextResponse.json(
      { source: "Google Sheets A9:F16", summaries, plans, updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" } },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unknown error" }, { status: 500 });
  }
}
