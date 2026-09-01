export type Row = string[];
export type Series = { name: string; values: number[] };
export type TextBlock = { summaries: string[]; plans: string[] };
export type BrandOperations = Record<string, TextBlock>;

export type AdPerformance = {
  spend: number[];
  revenue: number[];
  impressions: number[];
  clicks: number[];
  orders: number[];
  newCustomers: number[];
  clickRate: number[];
  conversionRate: number[];
  repurchaseRate: number[];
  rohs: number[];
  actions: string[];
  assessment: string[];
  plans: string[];
};

export type DashboardSheets = {
  monthly: Row[];
  brand: Row[];
  item: Row[];
  ratio: Row[];
  budget: Row[];
  deduction: Row[];
  accounting: Row[];
};

export type DashboardData = {
  source: "Google Sheets";
  status: string[];
  gmvTarget: number[];
  rocketGmv: number[];
  wingGmv: number[];
  totalGmv: number[];
  marketing: number[];
  products: Series[];
  productAccounting: Series[];
  brands: Series[];
  brandAccounting: Series[];
  brandAccountingTotal: number[];
  operationSummaries: string[];
  salesPlans: string[];
  marketingOperationSummaries: string[];
  marketingSalesPlans: string[];
  brandOperationSummaries: string[];
  brandSalesPlans: string[];
  budgetRows: { name: string; budget: number; spent: number }[];
  budget: number;
  spent: number;
  accounting: {
    rocket: number[];
    wing: number[];
    eventDeduction: number[];
    incentive: number[];
  };
  eventBreakdown: Series[];
  adPerformance: AdPerformance;
  adPerformanceByBrand: Record<string, AdPerformance>;
};

const MONTH_START = 3;
const MONTH_COUNT = 12;
const MAX_ROWS = 500;
const MAX_COLUMNS = 26;
const MAX_CELL_LENGTH = 10_000;
const MAX_LABEL_LENGTH = 100;
const MAX_NOTE_LENGTH = 2_000;

function fail(sheet: string, message: string): never {
  throw new Error(`Invalid ${sheet} sheet: ${message}`);
}

const clean = (value: unknown) => String(value ?? "").trim();
const normalize = (value: unknown) => clean(value).replace(/\s+/g, " ");
const textCell = (value: unknown, limit = MAX_NOTE_LENGTH) => clean(value).slice(0, limit);

function validateGrid(sheet: string, rows: Row[], requiredMarkers: string[]) {
  if (!Array.isArray(rows) || !rows.length) fail(sheet, "required rows are missing");
  if (rows.length > MAX_ROWS || rows.some((row) => !Array.isArray(row) || row.length > MAX_COLUMNS)) {
    fail(sheet, "sheet exceeds the accepted size");
  }
  if (rows.some((row) => row.some((cell) => typeof cell !== "string" || cell.length > MAX_CELL_LENGTH))) {
    fail(sheet, "a cell exceeds the accepted size");
  }
  const cells = new Set(rows.flat().map(normalize).filter(Boolean));
  for (const marker of requiredMarkers) {
    if (!cells.has(normalize(marker))) fail(sheet, `required header '${marker}' is missing`);
  }
}

function numberCell(value: unknown, location: string) {
  const raw = clean(value);
  if (!raw || raw === "-") return 0;
  const normalized = raw.replace(/,/g, "").replace(/원$/u, "").replace(/%$/u, "").trim();
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) {
    throw new Error(`Invalid numeric value at ${location}`);
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`Numeric value is outside the valid range at ${location}`);
  return parsed;
}

function months(row: Row | undefined, location: string) {
  if (!row) throw new Error(`Required row is missing at ${location}`);
  return Array.from({ length: MONTH_COUNT }, (_, index) =>
    numberCell(row[MONTH_START + index], `${location}, month ${index + 1}`),
  );
}

const emptyText = () => Array.from({ length: MONTH_COUNT }, () => "");
const emptyNum = () => Array.from({ length: MONTH_COUNT }, () => 0);

function monthIndex(value: unknown) {
  const match = clean(value).match(/(\d{1,2})월/);
  if (!match) return -1;
  const index = Number(match[1]) - 1;
  return index >= 0 && index < MONTH_COUNT ? index : -1;
}

function expectRow(rows: Row[], rowIndex: number, first: string, second?: string) {
  const row = rows[rowIndex];
  if (!row || normalize(row[0]) !== normalize(first)) {
    throw new Error(`Required row ${rowIndex + 1} '${first}' is missing`);
  }
  if (second !== undefined && normalize(row[1]) !== normalize(second)) {
    throw new Error(`Required row ${rowIndex + 1} '${first} / ${second}' is missing`);
  }
  return row;
}

function fixedSeries(rows: Row[], startIndex: number, endIndex: number, location: string) {
  const output: Series[] = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const row = rows[index];
    if (!row || !clean(row[0])) continue;
    output.push({
      name: textCell(row[0], MAX_LABEL_LENGTH),
      values: months(row, `${location} row ${index + 1}`),
    });
  }
  if (!output.length) throw new Error(`No series found in ${location}`);
  return output;
}

function repeatedGridSections(rows: Row[], title: string, sheet: string) {
  const result: Series[] = [];
  rows.forEach((row, headingIndex) => {
    if (normalize(row[0]) !== normalize(title)) return;
    for (let index = headingIndex + 2; index < rows.length; index += 1) {
      const candidate = rows[index];
      const name = clean(candidate?.[0]);
      if (!name) break;
      if (normalize(name) === normalize(title)) break;
      result.push({
        name: textCell(name, MAX_LABEL_LENGTH),
        values: months(candidate, `${sheet} row ${index + 1}`),
      });
    }
  });
  if (!result.length) throw new Error(`No '${title}' sections found in ${sheet}`);
  return result;
}

export function parseMonthlyOperations(rows: Row[]): TextBlock {
  validateGrid("monthly", rows, ["쿠팡 GMV", "쿠팡 월별 GMV"]);
  const summaries = emptyText();
  const plans = emptyText();
  for (let index = 14; index < Math.min(rows.length, 20); index += 1) {
    const row = rows[index];
    if (normalize(row?.[0]) !== "쿠팡 월별 GMV") continue;
    const month = monthIndex(row[1]);
    if (month < 0) continue;
    summaries[month] = textCell(row[2]);
    plans[month] = textCell(row[3]);
  }
  return { summaries, plans };
}

export function parseMarketingOperations(rows: Row[]): TextBlock {
  validateGrid("ratio", rows, ["GMV 대비 마케팅비 비율", "마케팅비 운영요약 및 영업계획"]);
  const summaries = emptyText();
  const plans = emptyText();
  for (let index = 10; index < Math.min(rows.length, 16); index += 1) {
    const row = rows[index];
    const month = monthIndex(row?.[0]);
    if (month < 0) continue;
    summaries[month] = textCell(row[2]);
    plans[month] = textCell(row[5]);
  }
  return { summaries, plans };
}

function brandMarker(value: unknown) {
  const match = normalize(value).match(/^브랜드별 운영요약\s*-\s*(.+)$/);
  return match ? textCell(match[1], MAX_LABEL_LENGTH) : "";
}

export function parseBrandOperations(rows: Row[]): BrandOperations {
  validateGrid("brand", rows, ["브랜드별 GMV", "브랜드별 재고매출"]);
  const brands: BrandOperations = {};
  for (let index = 0; index < rows.length; index += 1) {
    const brand = brandMarker(rows[index]?.[0]);
    if (!brand) continue;
    const summaries = emptyText();
    const plans = emptyText();
    for (let next = index + 1; next < rows.length; next += 1) {
      if (brandMarker(rows[next]?.[0])) break;
      const month = monthIndex(rows[next]?.[0]);
      if (month < 0) continue;
      summaries[month] = textCell(rows[next]?.[2]);
      plans[month] = textCell(rows[next]?.[5]);
    }
    brands[brand === "전체" ? "전체" : brand] = { summaries, plans };
  }
  if (!brands["전체"]) throw new Error("Required brand operations block '전체' is missing");
  return brands;
}

function emptyAd(): AdPerformance {
  return {
    spend: emptyNum(),
    revenue: emptyNum(),
    impressions: emptyNum(),
    clicks: emptyNum(),
    orders: emptyNum(),
    newCustomers: emptyNum(),
    clickRate: emptyNum(),
    conversionRate: emptyNum(),
    repurchaseRate: emptyNum(),
    rohs: emptyNum(),
    actions: emptyText(),
    assessment: emptyText(),
    plans: emptyText(),
  };
}

function parseAdBlock(rows: Row[], brand: string): AdPerformance {
  const result = emptyAd();
  const start = rows.findIndex((row) => normalize(row[0]) === `${normalize(brand)} 광고 운영 성과`);
  if (start < 0) return result;
  const header = rows[start + 1] || [];
  let monthColumns = header
    .map((cell, column) => ({ index: monthIndex(cell), column }))
    .filter((entry) => entry.index >= 0);

  if (monthColumns.length >= 2) {
    const first = monthColumns[0];
    const last = monthColumns.at(-1)!;
    if (last.column - first.column === last.index - first.index) {
      monthColumns = Array.from({ length: last.column - first.column + 1 }, (_, offset) => ({
        index: first.index + offset,
        column: first.column + offset,
      }));
    }
  }

  for (let rowIndex = start + 2; rowIndex < Math.min(rows.length, start + 20); rowIndex += 1) {
    const label = normalize(rows[rowIndex]?.[0]);
    if (!label || (rowIndex > start + 2 && label.endsWith("광고 운영 성과"))) break;
    monthColumns.forEach(({ index, column }) => {
      const raw = clean(rows[rowIndex]?.[column]);
      if (["액션", "성과판단", "향후계획"].includes(label)) {
        if (label === "액션") result.actions[index] = textCell(raw);
        else if (label === "성과판단") result.assessment[index] = textCell(raw);
        else result.plans[index] = textCell(raw);
        return;
      }
      let value = numberCell(raw, `item ${brand} ${label}, month ${index + 1}`);
      if (["클릭률", "전환율", "재구매율", "ROHS", "ROAS"].includes(label) && !raw.includes("%") && value > 0 && value <= 1) {
        value *= 100;
      }
      if (label === "광고비") result.spend[index] = value;
      else if (label === "전환매출") result.revenue[index] = value;
      else if (label === "노출수") result.impressions[index] = value;
      else if (label === "클릭수") result.clicks[index] = value;
      else if (label === "주문수") result.orders[index] = value;
      else if (label === "신규고객" || label === "신규고객수") result.newCustomers[index] = value;
      else if (label === "클릭률") result.clickRate[index] = value;
      else if (label === "전환율") result.conversionRate[index] = value;
      else if (label === "재구매율") result.repurchaseRate[index] = value;
      else if (label === "ROHS" || label === "ROAS") result.rohs[index] = value;
    });
  }
  return result;
}

function parseEventBreakdown(rows: Row[]) {
  const names = ["1. 펫페어", "2. 펫페스티벌", "3. 타임프로모션", "4. 골드박스", "5. 자체프로모션", "6. 펫용품위크", "7. 펫푸드위크"];
  const header = expectRow(rows, 1, "매출차감");
  const monthColumns = header
    .map((cell, column) => ({ index: monthIndex(cell), column }))
    .filter(({ index }) => index >= 0);
  if (!monthColumns.length) throw new Error("Required deduction month headers are missing");

  return names.map((name, categoryIndex) => {
    const values = emptyNum();
    const start = rows.findIndex((row) => normalize(row[0]) === normalize(name));
    if (start < 0) return { name, values };
    let end = rows.length;
    for (const nextName of names.slice(categoryIndex + 1)) {
      const next = rows.findIndex((row, index) => index > start && normalize(row[0]) === normalize(nextName));
      if (next >= 0) { end = next; break; }
    }
    for (let rowIndex = start; rowIndex < end; rowIndex += 1) {
      const row = rows[rowIndex];
      const isTotalRow = !clean(row[0]) && !clean(row[1]) && monthColumns.some(({ column }) => clean(row[column]));
      if (isTotalRow) continue;
      monthColumns.forEach(({ index, column }) => {
        values[index] += numberCell(row[column], `deduction row ${rowIndex + 1}, month ${index + 1}`);
      });
    }
    return { name, values };
  });
}

export function parseDashboardSheets(sheets: DashboardSheets): DashboardData {
  validateGrid("monthly", sheets.monthly, ["쿠팡 GMV", "목표", "실적", "예상"]);
  validateGrid("brand", sheets.brand, ["브랜드별 GMV", "브랜드별 재고매출"]);
  validateGrid("item", sheets.item, ["품목별 GMV", "품목별 재고매출"]);
  validateGrid("ratio", sheets.ratio, ["GMV 대비 마케팅비 비율", "마케팅비"]);
  validateGrid("budget", sheets.budget, ["KPI예산", "집행누적", "잔여예산"]);
  validateGrid("deduction", sheets.deduction, ["매출차감"]);
  validateGrid("accounting", sheets.accounting, ["쿠팡매출 세부내역", "회계매출"]);

  const goalRow = expectRow(sheets.monthly, 4, "쿠팡 총 GMV");
  const rocketRow = expectRow(sheets.monthly, 8, "쿠팡 로켓 GMV");
  const wingRow = expectRow(sheets.monthly, 9, "쿠팡 윙 GMV");
  const totalRow = expectRow(sheets.monthly, 10, "쿠팡 총 GMV");
  const statusRow = sheets.monthly[7];
  if (!statusRow || !Array.from({ length: MONTH_COUNT }, (_, index) => clean(statusRow[MONTH_START + index])).some(Boolean)) {
    throw new Error("Required monthly status row 8 is missing");
  }

  expectRow(sheets.brand, 3, "로켓 총 GMV");
  const brands = fixedSeries(sheets.brand, 4, 10, "brand GMV");
  const brandInventoryTotal = expectRow(sheets.brand, 14, "로켓 총 재고매출");
  const brandAccounting = fixedSeries(sheets.brand, 15, 21, "brand inventory sales");

  const budgetNames = ["쿠팡 로켓 디스플레이 광고", "쿠팡 로켓 마케팅비(CPC)", "쿠팡 윙 마케팅비(CPC)"];
  const budgetRows = budgetNames.map((name, offset) => {
    const row = expectRow(sheets.budget, 2 + offset, name);
    return {
      name,
      budget: numberCell(row[3], `budget row ${3 + offset}, KPI budget`),
      spent: numberCell(row[4], `budget row ${3 + offset}, cumulative spend`),
    };
  });
  const budgetTotal = expectRow(sheets.budget, 5, "합계");

  const accountingInventory = expectRow(sheets.accounting, 3, "쿠팡로켓", "재고매출");
  void accountingInventory;
  const accountingEvent = expectRow(sheets.accounting, 4, "쿠팡로켓", "매출차감행사비 - 쿠폰행사");
  const accountingIncentive = expectRow(sheets.accounting, 5, "쿠팡로켓", "매출차감행사비 - 판매장려금");
  const accountingRocket = expectRow(sheets.accounting, 6, "쿠팡로켓", "회계매출");
  const accountingWing = expectRow(sheets.accounting, 7, "쿠팡윙", "회계매출");

  const monthlyOperations = parseMonthlyOperations(sheets.monthly);
  const marketingOperations = parseMarketingOperations(sheets.ratio);
  const brandOperations = parseBrandOperations(sheets.brand);
  const productGmv = repeatedGridSections(sheets.item, "품목별 GMV", "item");
  const productAccounting = repeatedGridSections(sheets.item, "품목별 재고매출", "item");
  const marketingRow = expectRow(sheets.ratio, 4, "마케팅비");
  const brandNames = [...new Set(["잘싸모래", ...brands.map((entry) => entry.name)])];
  const adPerformanceByBrand = Object.fromEntries(brandNames.map((name) => [name, parseAdBlock(sheets.item, name)]));

  const data: DashboardData = {
    source: "Google Sheets",
    status: Array.from({ length: MONTH_COUNT }, (_, index) => {
      const value = clean(statusRow[MONTH_START + index]);
      if (value !== "실적" && value !== "예상") throw new Error(`Invalid status at monthly row 8, month ${index + 1}`);
      return value;
    }),
    gmvTarget: months(goalRow, "monthly goal row 5"),
    rocketGmv: months(rocketRow, "monthly rocket row 9"),
    wingGmv: months(wingRow, "monthly wing row 10"),
    totalGmv: months(totalRow, "monthly total row 11"),
    marketing: months(marketingRow, "ratio marketing row 5"),
    products: productGmv,
    productAccounting,
    brands,
    brandAccounting,
    brandAccountingTotal: months(brandInventoryTotal, "brand inventory total row 15"),
    operationSummaries: monthlyOperations.summaries,
    salesPlans: monthlyOperations.plans,
    marketingOperationSummaries: marketingOperations.summaries,
    marketingSalesPlans: marketingOperations.plans,
    brandOperationSummaries: brandOperations["전체"].summaries,
    brandSalesPlans: brandOperations["전체"].plans,
    budgetRows,
    budget: numberCell(budgetTotal[3], "budget total KPI budget"),
    spent: numberCell(budgetTotal[4], "budget total cumulative spend"),
    accounting: {
      rocket: months(accountingRocket, "accounting rocket row 7"),
      wing: months(accountingWing, "accounting wing row 8"),
      eventDeduction: months(accountingEvent, "accounting event row 5"),
      incentive: months(accountingIncentive, "accounting incentive row 6"),
    },
    eventBreakdown: parseEventBreakdown(sheets.deduction),
    adPerformance: adPerformanceByBrand["잘싸모래"],
    adPerformanceByBrand,
  };

  if (!data.rocketGmv.some(Boolean) || !data.totalGmv.some(Boolean)) {
    throw new Error("Required monthly GMV values are missing");
  }
  return data;
}
