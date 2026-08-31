import { NextResponse } from "next/server";

const SPREADSHEET_ID = "1QPX7i199rMYkYo0aXwzwjTaauJ7oWLAPworBD7VV5OQ";
const MONTHLY_GID = "1761957984";

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

export async function GET() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${MONTHLY_GID}&range=A14:D20&_=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
    if (!response.ok) throw new Error(`Google Sheets 응답 오류: ${response.status}`);
    const rows = parseCsv(await response.text());
    const summaries = Array.from({ length: 12 }, () => "");
    const plans = Array.from({ length: 12 }, () => "");
    for (const row of rows) {
      if (clean(row[0]) !== "쿠팡 월별 GMV") continue;
      const match = clean(row[1]).match(/(\d{1,2})월/);
      if (!match) continue;
      const index = Number(match[1]) - 1;
      if (index < 0 || index > 11) continue;
      summaries[index] = clean(row[2]);
      plans[index] = clean(row[3]);
    }
    return NextResponse.json(
      { summaries, plans, source: "Google Sheets A14:D20", updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unknown error" }, { status: 500 });
  }
}
