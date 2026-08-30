import { NextResponse } from "next/server";

const SPREADSHEET_ID = "1QPX7i199rMYkYo0aXwzwjTaauJ7oWLAPworBD7VV5OQ";
const MONTH_START = 3;
const MONTH_COUNT = 12;

type Row = string[];
type Series = { name: string; values: number[] };
type TextBlock = { summaries: string[]; plans: string[] };
type AdPerformance = {
  spend: number[];
  revenue: number[];
  conversionRate: number[];
  rohs: number[];
  assessment: string[];
  plans: string[];
};

const GIDS = {
  monthly: "1761957984",
  brand: "1036898751",
  item: "1506076158",
  ratio: "607458845",
  budget: "2000735419",
  deduction: "1519343097",
  accounting: "1123039991",
} as const;

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
function num(value: unknown) {
  const raw = clean(value);
  if (!raw || raw === "-") return 0;
  const parsed = Number(raw.replace(/[,%원\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function months(row?: Row) { return Array.from({ length: MONTH_COUNT }, (_, index) => num(row?.[MONTH_START + index])); }
function emptyText() { return Array.from({ length: MONTH_COUNT }, () => ""); }
function emptyNum() { return Array.from({ length: MONTH_COUNT }, () => 0); }
function monthIndex(label: unknown) {
  const match = clean(label).match(/(\d{1,2})월/);
  return match ? Math.max(0, Math.min(11, Number(match[1]) - 1)) : -1;
}
function findRow(rows: Row[], first: string, second?: string, occurrence = 0) {
  const matches = rows.filter((row) => normalize(row[0]) === normalize(first) && (second === undefined || normalize(row[1]) === normalize(second)));
  return matches[occurrence];
}
function findRows(rows: Row[], first: string) { return rows.filter((row) => normalize(row[0]) === normalize(first)); }
function section(rows: Row[], title: string, occurrence = 0): Row[] {
  const indexes = rows.map((row, index) => normalize(row[0]) === normalize(title) ? index : -1).filter((index) => index >= 0);
  const heading = indexes[occurrence] ?? -1;
  if (heading < 0) return [];
  const out: Row[] = [];
  for (let i = heading + 1; i < rows.length; i += 1) {
    const row = rows[i];
    const first = clean(row[0]);
    if (!first) { if (out.length) break; continue; }
    if (first === "구분" || first === "실적" || first === "예상") continue;
    if (/^(품목별|브랜드별|잘싸모래 광고 운영 성과|클레버메이트 광고 운영 성과|포우리패드 광고 운영 성과|캐네디언샌드 광고 운영 성과|브리젠 파테 광고 운영 성과|더스트몬 광고 운영 성과|아메리칸솔루션 광고 운영 성과)/.test(first)) break;
    out.push(row);
  }
  return out;
}
function collectRepeatedSections(rows: Row[], title: string): Series[] {
  const result: Series[] = [];
  let occurrence = 0;
  while (true) {
    const entries = section(rows, title, occurrence);
    if (!entries.length) break;
    for (const row of entries) {
      const name = clean(row[0]);
      if (name && !/^(실적|예상)$/.test(name)) result.push({ name, values: months(row) });
    }
    occurrence += 1;
  }
  return result;
}
function parseMonthlyText(rows: Row[]): TextBlock {
  const summaries = emptyText();
  const plans = emptyText();
  rows.forEach((row) => {
    if (normalize(row[0]) !== "쿠팡 월별 GMV") return;
    const index = monthIndex(row[1]);
    if (index < 0) return;
    summaries[index] = clean(row[2]);
    plans[index] = clean(row[3]);
  });
  return { summaries, plans };
}
function parseSummaryBlock(rows: Row[], marker: string, summaryColumn = 2, planColumn = 5): TextBlock {
  const summaries = emptyText();
  const plans = emptyText();
  const start = rows.findIndex((row) => normalize(row[0]) === normalize(marker));
  if (start < 0) return { summaries, plans };
  for (let i = start + 1; i < rows.length; i += 1) {
    const first = clean(rows[i][0]);
    if (i > start + 1 && /운영요약\s*-/.test(first)) break;
    const index = monthIndex(first);
    if (index < 0) continue;
    summaries[index] = clean(rows[i][summaryColumn]);
    plans[index] = clean(rows[i][planColumn]);
  }
  return { summaries, plans };
}
function parseMarketingSummary(rows: Row[]): TextBlock {
  const summaries = emptyText();
  const plans = emptyText();
  const start = rows.findIndex((row) => normalize(row[0]) === "마케팅비 운영요약 및 영업계획");
  if (start < 0) return { summaries, plans };
  for (let i = start + 1; i < rows.length; i += 1) {
    const index = monthIndex(rows[i][0]);
    if (index < 0) continue;
    summaries[index] = clean(rows[i][2]);
    plans[index] = clean(rows[i][5]);
  }
  return { summaries, plans };
}
function parseAdBlock(rows: Row[], brand: string): AdPerformance {
  const result: AdPerformance = { spend: emptyNum(), revenue: emptyNum(), conversionRate: emptyNum(), rohs: emptyNum(), assessment: emptyText(), plans: emptyText() };
  const start = rows.findIndex((row) => normalize(row[0]) === `${brand} 광고 운영 성과`);
  if (start < 0) return result;
  const header = rows[start + 1] || [];
  const monthColumns = header.map((cell, column) => ({ index: monthIndex(cell), column })).filter((entry) => entry.index >= 0);
  const labels: Record<string, keyof AdPerformance> = { 광고비: "spend", 전환매출: "revenue", 전환율: "conversionRate", ROHS: "rohs", 성과판단: "assessment", 향후계획: "plans" };
  for (let i = start + 2; i < Math.min(rows.length, start + 10); i += 1) {
    const key = labels[normalize(rows[i][0])];
    if (!key) continue;
    monthColumns.forEach(({ index, column }) => {
      if (key === "assessment" || key === "plans") result[key][index] = clean(rows[i][column]);
      else {
        const rawValue = clean(rows[i][column]);
        let value = num(rawValue);
        if ((key === "conversionRate" || key === "rohs") && !rawValue.includes("%") && value > 0 && value <= 1) value *= 100;
        result[key][index] = value;
      }
    });
  }
  return result;
}
async function fetchSheet(gid: string): Promise<Row[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}&_=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
  if (!response.ok) throw new Error(`Google Sheets ${gid} 응답 오류: ${response.status}`);
  return parseCsv(await response.text());
}

export async function GET() {
  try {
    const [monthly, brand, item, ratio, budget, deduction, accountingRows] = await Promise.all([
      fetchSheet(GIDS.monthly), fetchSheet(GIDS.brand), fetchSheet(GIDS.item), fetchSheet(GIDS.ratio), fetchSheet(GIDS.budget), fetchSheet(GIDS.deduction), fetchSheet(GIDS.accounting),
    ]);
    const monthlyTotals = findRows(monthly, "쿠팡 총 GMV");
    const rocketRow = findRow(monthly, "쿠팡 로켓 GMV");
    const rocketIndex = monthly.indexOf(rocketRow);
    const statusRow = rocketIndex > 0 ? monthly[rocketIndex - 1] : undefined;
    const monthlyText = parseMonthlyText(monthly);
    const brandText = parseSummaryBlock(brand, "브랜드별 운영요약 - 전체");
    const marketingText = parseMarketingSummary(ratio);
    const brandGmv = section(brand, "브랜드별 GMV").filter((row) => !normalize(row[0]).startsWith("로켓 총"));
    const brandInventorySection = section(brand, "브랜드별 재고매출");
    const brandInventoryTotal = brandInventorySection.find((row) => normalize(row[0]).startsWith("로켓 총"));
    const brandInventory = brandInventorySection.filter((row) => !normalize(row[0]).startsWith("로켓 총"));
    const knownBrands = ["잘싸모래", "클레버메이트", "포우리패드", "캐네디언샌드", "브리젠 파테", "더스트몬", "아메리칸솔루션"];
    const adPerformanceByBrand = Object.fromEntries(knownBrands.map((name) => [name, parseAdBlock(item, name)]));
    const budgetRows = ["쿠팡 로켓 디스플레이 광고", "쿠팡 로켓 마케팅비(CPC)", "쿠팡 윙 마케팅비(CPC)"].map((name) => {
      const row = findRow(budget, name);
      return { name, budget: num(row?.[3]), spent: num(row?.[4]) };
    });
    const budgetTotal = findRow(budget, "합계");
    const deductionTotal = deduction.at(-1) || [];
    const eventDeduction = Array.from({ length: 12 }, (_, index) => index >= 3 && index <= 7 ? num(deductionTotal[index - 1]) : 0);
    const data = {
      status: Array.from({ length: 12 }, (_, index) => clean(statusRow?.[MONTH_START + index]) || (index <= 7 ? "실적" : "예상")),
      rocketGmv: months(rocketRow),
      wingGmv: months(findRow(monthly, "쿠팡 윙 GMV")),
      totalGmv: months(monthlyTotals.at(-1)),
      gmvTarget: months(monthlyTotals[0]),
      marketing: months(findRow(ratio, "마케팅비")),
      products: collectRepeatedSections(item, "품목별 GMV"),
      productAccounting: collectRepeatedSections(item, "품목별 재고매출"),
      brands: brandGmv.map((row) => ({ name: clean(row[0]), values: months(row) })),
      brandAccounting: brandInventory.map((row) => ({ name: clean(row[0]), values: months(row) })),
      brandAccountingTotal: months(brandInventoryTotal),
      operationSummaries: monthlyText.summaries,
      salesPlans: monthlyText.plans,
      brandOperationSummaries: brandText.summaries,
      brandSalesPlans: brandText.plans,
      marketingOperationSummaries: marketingText.summaries,
      marketingSalesPlans: marketingText.plans,
      accounting: {
        rocket: months(findRow(accountingRows, "쿠팡로켓", "회계매출")),
        wing: months(findRow(accountingRows, "쿠팡윙", "회계매출")),
        eventDeduction: months(findRow(accountingRows, "쿠팡로켓", "매출차감행사비 - 쿠폰행사")),
        incentive: months(findRow(accountingRows, "쿠팡로켓", "매출차감행사비 - 판매장려금")),
      },
      eventDeduction,
      budgetRows,
      budget: num(budgetTotal?.[3]),
      spent: num(budgetTotal?.[4]),
      adPerformance: adPerformanceByBrand["잘싸모래"],
      adPerformanceByBrand,
      refreshedAt: new Date().toISOString(),
      sourceMap: {
        monthly: { gid: GIDS.monthly, rows: "3-20" }, brand: { gid: GIDS.brand, rows: "2-86" }, item: { gid: GIDS.item, rows: "3-160" }, ratio: { gid: GIDS.ratio, rows: "2-16" }, budget: { gid: GIDS.budget, rows: "2-12" }, deduction: { gid: GIDS.deduction, rows: "2-38" }, accounting: { gid: GIDS.accounting, rows: "2-9" },
      },
    };
    if (!data.rocketGmv.some(Boolean) || !data.totalGmv.some(Boolean)) throw new Error("필수 월별 GMV 데이터를 찾지 못했습니다.");
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "시트 연동 오류" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
