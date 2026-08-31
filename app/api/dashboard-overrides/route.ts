import { NextResponse } from "next/server";

const SHEET_ID = "1QPX7i199rMYkYo0aXwzwjTaauJ7oWLAPworBD7VV5OQ";
const MONTHLY_GID = "1761957984";
const DEDUCTION_GID = "1519343097";

type Row = string[];

function parseCsv(input: string): Row[] {
  const rows: Row[] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { value += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else value += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(value); value = ""; }
    else if (ch === '\n') { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += ch;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  return rows;
}
const clean = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => {
  const n = Number(clean(v).replace(/[,%원\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
async function fetchRange(gid: string, range: string) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}&range=${encodeURIComponent(range)}&_=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet ${gid} ${range}: ${res.status}`);
  return parseCsv(await res.text());
}

export async function GET() {
  try {
    const [monthly, deduction] = await Promise.all([
      fetchRange(MONTHLY_GID, "A14:D20"),
      fetchRange(DEDUCTION_GID, "A2:G38"),
    ]);

    const monthlyRows = monthly.filter(r => clean(r[0]) === "쿠팡 월별 GMV");
    const monthlyOps = monthlyRows.map(r => ({
      month: clean(r[1]),
      summary: clean(r[2]),
      plan: clean(r[3]),
    }));

    const categories = ["1. 펫페어", "2. 펫페스티벌", "3. 타임프로모션", "4. 골드박스", "5. 자체프로모션", "6. 펫용품위크", "7. 펫푸드위크"];
    const header = deduction[0] || [];
    const augustCol = header.findIndex(c => clean(c).includes("8월"));
    let current = "";
    const breakdown = Object.fromEntries(categories.map(c => [c, 0])) as Record<string, number>;
    for (let i = 1; i < deduction.length; i += 1) {
      const row = deduction[i];
      const first = clean(row[0]);
      const second = clean(row[1]);
      if (categories.includes(first)) current = first;
      if (!current) continue;
      if (!first && !second) continue;
      if (augustCol >= 0) breakdown[current] += num(row[augustCol]);
    }
    const augustTotal = Object.values(breakdown).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      monthlyOps,
      augustDeduction: { total: augustTotal, breakdown },
      source: "Google Sheets exact ranges",
      updatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "override error" }, { status: 502 });
  }
}
