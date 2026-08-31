"use client";

import { useEffect, useRef } from "react";

export default function Home() {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let observer: MutationObserver | null = null;
    let dashboardData: any = null;
    let changeHandler: (() => void) | null = null;
    let activeDoc: Document | null = null;

    const install = () => {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      activeDoc = doc;

      if (!doc.getElementById("event-live-outside-style")) {
        const style = doc.createElement("style");
        style.id = "event-live-outside-style";
        style.textContent = `
          .event-live-wrap.event-live-outside{margin:14px 0 22px;padding:22px 24px;border:1px solid #dfe7f1;border-radius:16px;background:#fff;box-shadow:0 7px 18px rgba(16,32,61,.04)}
          .event-live-wrap.event-live-outside .event-live-list{display:grid;gap:10px;margin-top:0}
          .event-live-wrap.event-live-outside .event-live-row{display:grid;grid-template-columns:150px minmax(0,1fr) 90px;align-items:center;gap:12px}
          .event-live-wrap.event-live-outside .event-live-name{color:#526176;font-size:11px;font-weight:850}
          .event-live-wrap.event-live-outside .event-live-track{height:22px;border-radius:7px;background:#edf1f6;overflow:hidden}
          .event-live-wrap.event-live-outside .event-live-bar{display:block;height:100%;min-width:2px;border-radius:7px;background:#2867f0}
          .event-live-wrap.event-live-outside .event-live-value{text-align:right;color:#10203d;font-size:11px;font-weight:900;font-variant-numeric:tabular-nums}
          .event-live-wrap.event-live-outside .event-live-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;padding:11px 13px;border:1px solid #dfe7f1;border-radius:10px;background:#f8faff}
          .event-live-wrap.event-live-outside .event-live-summary span{color:#718096;font-size:10px;font-weight:800}
          .event-live-wrap.event-live-outside .event-live-summary strong{color:#205ac9;font-size:14px}
          @media(max-width:760px){.event-live-wrap.event-live-outside .event-live-row{grid-template-columns:110px minmax(0,1fr) 76px}.event-live-wrap.event-live-outside .event-live-name,.event-live-wrap.event-live-outside .event-live-value{font-size:9px}}
        `;
        doc.head.appendChild(style);
      }

      if (!doc.getElementById("exact-value-table-style")) {
        const style = doc.createElement("style");
        style.id = "exact-value-table-style";
        style.textContent = `
          .exact-values{margin:16px 0 6px;border:1px solid #dfe7f1;border-radius:14px;background:#fff;overflow:hidden;box-shadow:0 4px 14px rgba(16,32,61,.035)}
          .exact-values-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:13px 16px 11px;background:#f8faff;border-bottom:1px solid #e5ebf3}
          .exact-values-head strong{color:#17233b;font-size:12px;font-weight:900}
          .exact-values-head span{color:#77869b;font-size:9px;font-weight:750;white-space:nowrap}
          .exact-values-scroll{width:100%;overflow-x:auto;overscroll-behavior-inline:contain}
          .exact-values table{width:100%;min-width:max-content;border-collapse:collapse;font-variant-numeric:tabular-nums}
          .exact-values th,.exact-values td{padding:9px 12px;border-right:1px solid #edf1f6;border-bottom:1px solid #edf1f6;text-align:right;white-space:nowrap;font-size:10px}
          .exact-values th{background:#fbfcfe;color:#66758a;font-weight:850}
          .exact-values td{color:#26364f;font-weight:750}
          .exact-values th:first-child,.exact-values td:first-child{position:sticky;left:0;z-index:2;min-width:145px;text-align:left;background:#fff;color:#16243d;font-weight:900;box-shadow:1px 0 0 #e7edf4}
          .exact-values thead th:first-child{background:#fbfcfe;z-index:3}
          .exact-values tr:last-child td{border-bottom:0}
          .exact-values th:last-child,.exact-values td:last-child{border-right:0}
          .exact-values .is-percent{color:#205ac9}
          .exact-values-budget table{min-width:720px}
          .exact-values-budget td:first-child,.exact-values-budget th:first-child{min-width:190px}
          .report-item-summary > #exact-brand-gmv,.report-item-summary .brand-accounting-block > #exact-brand-inventory{display:none!important}
          .report-brand-summary .exact-item-table{display:none!important}
          @media(max-width:760px){.exact-values-head{align-items:flex-start;flex-direction:column;gap:4px}.exact-values th,.exact-values td{padding:8px 9px;font-size:9px}.exact-values th:first-child,.exact-values td:first-child{min-width:115px}}
        `;
        doc.head.appendChild(style);
      }

      const moveEventDetail = () => {
        const panel = doc.querySelector(".event-spend-panel");
        if (!panel) return;
        const inside = panel.querySelector(".event-live-wrap");
        if (inside) {
          inside.classList.add("event-live-outside");
          panel.insertAdjacentElement("afterend", inside);
          return;
        }
        const next = panel.nextElementSibling;
        if (next?.classList.contains("event-live-wrap")) next.classList.add("event-live-outside");
      };

      const normalizeMonthlyOperationLabels = () => {
        doc.querySelectorAll(".operation-plan-monthly article > div > strong").forEach(node => {
          const current = node.textContent?.trim() || "";
          const normalized = current.replace(/^\d{1,2}월\s+/, "");
          if (normalized && normalized !== current) node.textContent = normalized;
        });
      };

      const won = (value: unknown) => new Intl.NumberFormat("ko-KR").format(Math.round(Number(value) || 0));
      const indexes = () => {
        const selects = [...doc.querySelectorAll<HTMLSelectElement>(".range-filter select")];
        const start = Math.max(0, Number(selects[0]?.value ?? 0));
        const end = Math.max(start, Number(selects[1]?.value ?? 11));
        return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
      };
      const knownBrands = ["아메리칸솔루션", "캐네디언샌드", "잘싸모래", "클레버메이트", "브리젠 파테", "포우리패드", "더스트몬"];
      const brandOf = (name: unknown) => knownBrands.find(brand => String(name || "").startsWith(brand)) || String(name || "").split(/\s+/)[0];

      type ValueRow = { label: string; values: unknown[]; percent?: boolean };

      const upsertMonthlyTable = (id: string, anchor: Element | null, title: string, rows: ValueRow[], monthIndexes: number[], extraClass = "") => {
        if (!anchor || !dashboardData) return;
        let box = doc.getElementById(id);
        if (!box) {
          box = doc.createElement("section");
          box.id = id;
          box.className = `exact-values ${extraClass}`.trim();
        }
        if (box.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", box);
        const signature = JSON.stringify([monthIndexes, rows.map(row => [row.label, row.percent, monthIndexes.map(index => row.values?.[index])])]);
        if (box.dataset.signature === signature) return;
        box.dataset.signature = signature;
        const header = monthIndexes.map(index => `<th>${index + 1}월</th>`).join("");
        const body = rows.map(row => `<tr><td>${row.label}</td>${monthIndexes.map(index => `<td class="${row.percent ? "is-percent" : ""}">${row.percent ? `${Number(row.values?.[index] || 0).toFixed(2)}%` : `${won(row.values?.[index])}원`}</td>`).join("")}</tr>`).join("");
        box.innerHTML = `<div class="exact-values-head"><strong>${title}</strong><span>${rows.some(row => row.percent) ? "금액: 원 · 비율: %" : "단위: 원"} · Google Sheets 연동</span></div><div class="exact-values-scroll"><table><thead><tr><th>항목</th>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
      };

      const upsertBudgetTable = (anchor: Element | null) => {
        if (!anchor || !dashboardData) return;
        let box = doc.getElementById("exact-budget-values");
        if (!box) {
          box = doc.createElement("section");
          box.id = "exact-budget-values";
          box.className = "exact-values exact-values-budget";
        }
        if (box.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", box);
        const rows = dashboardData.budgetRows || [];
        const signature = JSON.stringify(rows);
        if (box.dataset.signature === signature) return;
        box.dataset.signature = signature;
        const body = rows.map((row: any) => {
          const budget = Number(row.budget) || 0;
          const spent = Number(row.spent) || 0;
          const remaining = budget - spent;
          const rate = budget ? spent / budget * 100 : 0;
          return `<tr><td>${row.name}</td><td>${won(budget)}원</td><td>${won(spent)}원</td><td>${won(remaining)}원</td><td class="is-percent">${rate.toFixed(2)}%</td></tr>`;
        }).join("");
        const totalBudget = Number(dashboardData.budget) || 0;
        const totalSpent = Number(dashboardData.spent) || 0;
        const totalRate = totalBudget ? totalSpent / totalBudget * 100 : 0;
        box.innerHTML = `<div class="exact-values-head"><strong>마케팅비 예산 집행 정확 수치</strong><span>단위: 원 · Google Sheets 연동</span></div><div class="exact-values-scroll"><table><thead><tr><th>항목</th><th>KPI 예산</th><th>집행누적</th><th>잔여예산</th><th>집행률</th></tr></thead><tbody>${body}<tr><td>합계</td><td>${won(totalBudget)}원</td><td>${won(totalSpent)}원</td><td>${won(totalBudget - totalSpent)}원</td><td class="is-percent">${totalRate.toFixed(2)}%</td></tr></tbody></table></div>`;
      };

      const renderExactValueTables = () => {
        if (!dashboardData) return;
        const monthIndexes = indexes();

        const monthlyPanel = doc.querySelector(".gmv-target-panel");
        upsertMonthlyTable(
          "exact-monthly-gmv",
          monthlyPanel?.querySelector(":scope > .chart-scroll") || null,
          "월별 GMV 정확 수치",
          [
            { label: "GMV 목표", values: dashboardData.gmvTarget || [] },
            { label: "로켓 GMV", values: dashboardData.rocketGmv || [] },
            { label: "윙 GMV", values: dashboardData.wingGmv || [] },
            { label: "총 GMV", values: dashboardData.totalGmv || [] },
          ],
          monthIndexes,
        );

        const brandPanel = doc.querySelector(".brand-trend-panel");
        const brandGmvChart = brandPanel?.querySelector(":scope > .brand-chart") || null;
        upsertMonthlyTable(
          "exact-brand-gmv",
          brandGmvChart,
          "로켓 브랜드별 GMV 정확 수치",
          (dashboardData.brands || []).map((entry: any) => ({ label: entry.name, values: entry.values || [] })),
          monthIndexes,
        );
        const brandInventoryChart = brandPanel?.querySelector(".brand-accounting-block > .brand-chart") || null;
        upsertMonthlyTable(
          "exact-brand-inventory",
          brandInventoryChart,
          "로켓 브랜드별 재고매출 정확 수치",
          (dashboardData.brandAccounting || []).map((entry: any) => ({ label: entry.name, values: entry.values || [] })),
          monthIndexes,
        );

        const selectedBrand = (doc.querySelector<HTMLSelectElement>(".report-brand-select")?.value || "").trim();
        const detail = doc.querySelector(".brand-detail");
        const productCharts = detail ? [...detail.querySelectorAll(".product-detail-chart")] : [];
        if (detail && selectedBrand && selectedBrand !== "전체") {
          const productRows = (dashboardData.products || [])
            .filter((entry: any) => brandOf(entry.name) === selectedBrand)
            .map((entry: any) => ({ label: entry.name, values: entry.values || [] }));
          const inventoryRows = (dashboardData.productAccounting || [])
            .filter((entry: any) => brandOf(entry.name) === selectedBrand)
            .map((entry: any) => ({ label: entry.name, values: entry.values || [] }));
          const firstAnchor = productCharts[0] || detail.querySelector(".product-chart") || null;
          upsertMonthlyTable("exact-item-gmv", firstAnchor, `${selectedBrand} 품목별 GMV 정확 수치`, productRows, monthIndexes, "exact-item-table");
          const firstTable = doc.getElementById("exact-item-gmv");
          const secondAnchor = productCharts[1] || firstTable || firstAnchor;
          upsertMonthlyTable("exact-item-inventory", secondAnchor, `${selectedBrand} 품목별 재고매출 정확 수치`, inventoryRows, monthIndexes, "exact-item-table");
        }

        const ratioPanel = doc.querySelector(".hero-panel");
        const ratios = Array.from({ length: 12 }, (_, index) => {
          const total = Number(dashboardData.totalGmv?.[index]) || 0;
          const spend = Number(dashboardData.marketing?.[index]) || 0;
          return total ? spend / total * 100 : 0;
        });
        upsertMonthlyTable(
          "exact-marketing-ratio",
          ratioPanel?.querySelector(":scope > .chart-scroll") || null,
          "GMV 대비 마케팅비 정확 수치",
          [
            { label: "로켓 GMV", values: dashboardData.rocketGmv || [] },
            { label: "윙 GMV", values: dashboardData.wingGmv || [] },
            { label: "총 GMV", values: dashboardData.totalGmv || [] },
            { label: "마케팅비", values: dashboardData.marketing || [] },
            { label: "GMV 대비 마케팅비", values: ratios, percent: true },
          ],
          monthIndexes,
        );

        const budgetPanel = doc.querySelector(".budget-panel");
        upsertBudgetTable(budgetPanel?.querySelector(":scope > .budget-list") || null);

        const spendPanel = doc.querySelector(".monthly-chart-grid .spend-panel:not(.event-spend-panel)");
        upsertMonthlyTable(
          "exact-monthly-spend",
          spendPanel?.querySelector(".marketing-spend-bars") || null,
          "월별 마케팅비 정확 수치",
          [{ label: "마케팅비", values: dashboardData.marketing || [] }],
          monthIndexes,
        );

        const eventPanel = doc.querySelector(".event-spend-panel");
        const eventVisual = doc.querySelector(".event-live-wrap.event-live-outside") || eventPanel;
        upsertMonthlyTable(
          "exact-event-spend",
          eventVisual,
          "매출차감행사비 정확 수치",
          (dashboardData.eventBreakdown || []).map((entry: any) => ({ label: String(entry.name || "").replace(/^\d+\.\s*/, ""), values: entry.values || [] })),
          monthIndexes,
        );

        const accountingPanel = [...doc.querySelectorAll("main > section.panel")].find(section => section.querySelector("h2")?.textContent?.trim() === "쿠팡 회계매출 세부내역");
        const accounting = dashboardData.accounting || {};
        const totalAccounting = Array.from({ length: 12 }, (_, index) => (Number(accounting.rocket?.[index]) || 0) + (Number(accounting.wing?.[index]) || 0));
        upsertMonthlyTable(
          "exact-accounting",
          accountingPanel?.querySelector(".accounting-detail") || null,
          "쿠팡 회계매출 정확 수치",
          [
            { label: "로켓 회계매출", values: accounting.rocket || [] },
            { label: "윙 회계매출", values: accounting.wing || [] },
            { label: "쿠팡 전체 회계매출", values: totalAccounting },
            { label: "매출차감행사비", values: accounting.eventDeduction || [] },
            { label: "판매장려금", values: accounting.incentive || [] },
          ],
          monthIndexes,
        );
      };

      const applyAdjustments = () => {
        moveEventDetail();
        normalizeMonthlyOperationLabels();
        renderExactValueTables();
      };

      applyAdjustments();
      observer?.disconnect();
      observer = new MutationObserver(applyAdjustments);
      observer.observe(doc.body, { childList: true, subtree: true });

      if (changeHandler) doc.removeEventListener("change", changeHandler, true);
      changeHandler = () => setTimeout(applyAdjustments, 180);
      doc.addEventListener("change", changeHandler, true);

      fetch("/api/dashboard-data", { cache: "no-store" })
        .then(response => response.ok ? response.json() : Promise.reject(new Error("dashboard data")))
        .then(payload => {
          dashboardData = payload.data || null;
          setTimeout(applyAdjustments, 0);
        })
        .catch(() => {});
    };

    frame.addEventListener("load", install);
    if (frame.contentDocument?.readyState === "complete") install();

    return () => {
      frame.removeEventListener("load", install);
      observer?.disconnect();
      if (activeDoc && changeHandler) activeDoc.removeEventListener("change", changeHandler, true);
    };
  }, []);

  return (
    <main className="dashboard-shell">
      <iframe
        ref={frameRef}
        className="dashboard-frame"
        src="/dashboard/report.html"
        title="쿠팡 성과 대시보드 정적 디자인 미리보기"
      />
    </main>
  );
}
