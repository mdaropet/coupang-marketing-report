"use client";

import { useEffect } from "react";

type AdSeries = {
  spend?: number[];
  revenue?: number[];
  conversionRate?: number[];
  rohs?: number[];
};

type DashboardPayload = {
  data?: {
    adPerformanceByBrand?: Record<string, AdSeries>;
  };
};

export default function AdPerformanceFix() {
  useEffect(() => {
    let frame: HTMLIFrameElement | null = null;
    let data: Record<string, AdSeries> = {};
    let retryTimer: ReturnType<typeof setInterval> | null = null;
    let loadHandler: (() => void) | null = null;
    let changeHandler: ((event: Event) => void) | null = null;
    let clickHandler: ((event: Event) => void) | null = null;

    const formatWon = (value: number) => `${new Intl.NumberFormat("ko-KR").format(value)}원`;

    const selectedIndexes = (doc: Document) => {
      const selects = [...doc.querySelectorAll<HTMLSelectElement>(".range-filter select")];
      const start = Number(selects[0]?.value ?? 0);
      const end = Number(selects[1]?.value ?? 11);
      return Array.from({ length: Math.max(0, end - start + 1) }, (_, offset) => start + offset);
    };

    const rowsForBrand = (brand: string, doc: Document) => {
      const ad = data[brand] || {};
      return selectedIndexes(doc).map(index => ({
        index,
        month: `${index + 1}월`,
        spend: Number(ad.spend?.[index]) || 0,
        revenue: Number(ad.revenue?.[index]) || 0,
        conversion: Number(ad.conversionRate?.[index]) || 0,
        rohs: Number(ad.rohs?.[index]) || 0,
      })).filter(row => row.spend || row.revenue || row.conversion || row.rohs);
    };

    const moneyChart = (rows: ReturnType<typeof rowsForBrand>) => {
      if (!rows.length) return '<div class="safe-ad-empty">선택 브랜드의 광고 성과 데이터가 아직 입력되지 않았습니다.</div>';
      const maxMoney = Math.max(1, ...rows.flatMap(row => [row.spend, row.revenue]));
      const count = rows.length;
      const left = 58;
      const right = 680;
      const base = 228;
      const top = 34;
      const height = base - top;
      const step = count <= 1 ? 0 : (right - left) / (count - 1);
      const bars = rows.map((row, i) => {
        const x = count === 1 ? 360 : left + step * i;
        const revenueHeight = Math.max(row.revenue ? 3 : 0, row.revenue / maxMoney * height);
        const spendHeight = Math.max(row.spend ? 3 : 0, row.spend / maxMoney * height);
        return `<rect class="safe-ad-revenue" x="${x - 25}" y="${base - revenueHeight}" width="22" height="${revenueHeight}" rx="4"></rect><rect class="safe-ad-spend" x="${x + 3}" y="${base - spendHeight}" width="22" height="${spendHeight}" rx="4"></rect><text class="safe-ad-value" x="${x - 14}" y="${Math.max(24, base - revenueHeight - 6)}" text-anchor="middle">${row.revenue ? Math.round(row.revenue / 10000).toLocaleString("ko-KR") + "만" : ""}</text><text class="safe-ad-value spend" x="${x + 14}" y="${Math.max(24, base - spendHeight - 6)}" text-anchor="middle">${row.spend ? Math.round(row.spend / 10000).toLocaleString("ko-KR") + "만" : ""}</text><text class="safe-ad-month" x="${x}" y="250" text-anchor="middle">${row.month}</text>`;
      }).join("");
      return `<div class="safe-ad-card"><div class="safe-ad-card-head"><strong>광고비 대비 전환매출 추이</strong><span>전환매출 · 광고비</span></div><svg class="safe-ad-money-chart" viewBox="0 0 720 270"><line x1="40" y1="228" x2="700" y2="228" class="safe-ad-gridline"></line>${bars}</svg></div>`;
    };

    const rateChart = (rows: ReturnType<typeof rowsForBrand>, key: "conversion" | "rohs", label: string) => {
      if (!rows.length) return `<div class="safe-ad-card safe-ad-rate"><div class="safe-ad-card-head"><strong>${label} 추이</strong><span>단위: %</span></div><div class="safe-ad-rate-empty">입력 데이터 없음</div></div>`;
      const values = rows.map(row => Number(row[key]) || 0);
      const max = Math.max(1, ...values) * 1.15;
      const left = 38;
      const right = 328;
      const top = 26;
      const bottom = 116;
      const height = bottom - top;
      const step = rows.length <= 1 ? 0 : (right - left) / (rows.length - 1);
      const points = rows.map((row, i) => {
        const value = Number(row[key]) || 0;
        return {
          x: rows.length === 1 ? 183 : left + step * i,
          y: bottom - value / max * height,
          value,
          month: row.month,
        };
      });
      return `<div class="safe-ad-card safe-ad-rate"><div class="safe-ad-card-head"><strong>${label} 추이</strong><span>단위: %</span></div><svg viewBox="0 0 360 146"><line x1="34" y1="116" x2="334" y2="116" class="safe-ad-gridline"></line><line x1="34" y1="26" x2="334" y2="26" class="safe-ad-gridline"></line><polyline class="safe-ad-rate-line ${key}" points="${points.map(point => `${point.x},${point.y}`).join(" ")}"></polyline>${points.map(point => `<circle class="safe-ad-rate-dot ${key}" cx="${point.x}" cy="${point.y}" r="3.5"></circle><text class="safe-ad-rate-value" x="${point.x}" y="${Math.max(15, point.y - 7)}" text-anchor="middle">${key === "conversion" ? point.value.toFixed(1) : point.value.toFixed(0)}%</text><text class="safe-ad-month" x="${point.x}" y="138" text-anchor="middle">${point.month}</text>`).join("")}</svg></div>`;
    };

    const ensureStyle = (doc: Document) => {
      if (doc.getElementById("safe-ad-performance-style")) return;
      const style = doc.createElement("style");
      style.id = "safe-ad-performance-style";
      style.textContent = `
        .custom-ad-ops{display:none!important}
        .safe-ad-ops{margin-top:18px;padding:18px;border:1px solid #dfe7f1;border-radius:14px;background:#f8faff}
        .safe-ad-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:12px}.safe-ad-head p{margin:0 0 4px;color:#718096;font-size:9px;font-weight:900;letter-spacing:.08em}.safe-ad-head h3{margin:0;color:#10203d;font-size:18px}.safe-ad-head>span{color:#718096;font-size:10px;font-weight:800}
        .safe-ad-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:12px}.safe-ad-kpis article{background:#fff;border:1px solid #e2eaf5;border-radius:11px;padding:12px}.safe-ad-kpis span{display:block;color:#718096;font-size:9px;font-weight:800}.safe-ad-kpis strong{display:block;margin-top:5px;color:#10203d;font-size:15px}
        .safe-ad-visual{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(290px,.5fr);gap:12px}.safe-ad-rate-stack{display:grid;gap:12px}.safe-ad-card{background:#fff;border:1px solid #e2eaf5;border-radius:12px;padding:12px}.safe-ad-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.safe-ad-card-head strong{color:#10203d;font-size:12px}.safe-ad-card-head span{color:#718096;font-size:9px;font-weight:800}.safe-ad-money-chart,.safe-ad-rate svg{display:block;width:100%;height:auto}.safe-ad-gridline{stroke:#e6edf6;stroke-width:1}.safe-ad-revenue{fill:#2867f0}.safe-ad-spend{fill:#a9bddc}.safe-ad-value{fill:#205ac9;font-size:8px;font-weight:900}.safe-ad-value.spend{fill:#66748a}.safe-ad-month{fill:#526176;font-size:8px;font-weight:850}.safe-ad-rate-line{fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}.safe-ad-rate-line.conversion{stroke:#18a67b}.safe-ad-rate-line.rohs{stroke:#dc5963}.safe-ad-rate-dot{fill:#fff;stroke-width:2.5}.safe-ad-rate-dot.conversion{stroke:#18a67b}.safe-ad-rate-dot.rohs{stroke:#dc5963}.safe-ad-rate-value{fill:#344158;font-size:8px;font-weight:900}.safe-ad-empty,.safe-ad-rate-empty{display:grid;place-items:center;min-height:120px;color:#8a95a6;font-size:10px;font-weight:800}
        @media(max-width:900px){.safe-ad-visual{grid-template-columns:1fr}.safe-ad-kpis{grid-template-columns:repeat(2,1fr)}}
      `;
      doc.head.appendChild(style);
    };

    const render = () => {
      const doc = frame?.contentDocument;
      if (!doc?.body) return;
      ensureStyle(doc);
      const detail = doc.querySelector<HTMLElement>(".brand-trend-panel .brand-detail");
      if (!detail) return;
      const brand = doc.querySelector<HTMLSelectElement>(".report-brand-select")?.value?.trim() || "";
      const visible = Boolean(brand && !brand.includes("전체"));
      let section = detail.querySelector<HTMLElement>(".safe-ad-ops");
      if (!visible) {
        section?.remove();
        return;
      }
      if (!section) {
        section = doc.createElement("section");
        section.className = "safe-ad-ops";
        detail.appendChild(section);
      }
      const rows = rowsForBrand(brand, doc);
      const signature = JSON.stringify([brand, rows]);
      if (section.dataset.signature === signature) return;
      section.dataset.signature = signature;
      const latest = rows.at(-1);
      const month = latest?.month || "선택 월";
      const valueOr = (value: number | undefined, formatter: (value: number) => string) => Number(value) ? formatter(Number(value)) : "입력 대기";
      section.innerHTML = `<div class="safe-ad-head"><div><p>BRAND AD PERFORMANCE</p><h3>${brand} 광고 운영 성과</h3></div><span>광고비·전환매출·전환율·ROHS 월별 추이</span></div><div class="safe-ad-kpis"><article><span>${month} 광고비</span><strong>${valueOr(latest?.spend, formatWon)}</strong></article><article><span>${month} 전환매출</span><strong>${valueOr(latest?.revenue, formatWon)}</strong></article><article><span>${month} 전환율</span><strong>${valueOr(latest?.conversion, value => `${value.toFixed(1)}%`)}</strong></article><article><span>${month} ROHS</span><strong>${valueOr(latest?.rohs, value => `${value.toFixed(0)}%`)}</strong></article></div><div class="safe-ad-visual">${moneyChart(rows)}<div class="safe-ad-rate-stack">${rateChart(rows, "conversion", "전환율")}${rateChart(rows, "rohs", "ROHS")}</div></div>`;
    };

    const attach = () => {
      frame = document.querySelector<HTMLIFrameElement>(".dashboard-frame");
      const doc = frame?.contentDocument;
      if (!frame || !doc?.body) return false;
      if (!changeHandler) {
        changeHandler = event => {
          const target = event.target as Element | null;
          if (target?.matches(".report-brand-select, .range-filter select")) {
            window.setTimeout(render, 120);
            window.setTimeout(render, 450);
          }
        };
        doc.addEventListener("change", changeHandler, true);
      }
      if (!clickHandler) {
        clickHandler = event => {
          const target = event.target as Element | null;
          if (target?.closest(".brand-chart-legend button, .brand-label-grid button")) window.setTimeout(render, 350);
        };
        doc.addEventListener("click", clickHandler, true);
      }
      if (!loadHandler) {
        loadHandler = () => {
          window.setTimeout(render, 200);
          window.setTimeout(render, 700);
        };
        frame.addEventListener("load", loadHandler);
      }
      render();
      window.setTimeout(render, 500);
      return true;
    };

    fetch("/api/dashboard-data", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("dashboard data")))
      .then((payload: DashboardPayload) => {
        data = payload.data?.adPerformanceByBrand || {};
        if (!attach()) {
          retryTimer = setInterval(() => {
            if (attach() && retryTimer) {
              clearInterval(retryTimer);
              retryTimer = null;
            }
          }, 300);
        }
      })
      .catch(() => {});

    return () => {
      if (retryTimer) clearInterval(retryTimer);
      const doc = frame?.contentDocument;
      if (doc && changeHandler) doc.removeEventListener("change", changeHandler, true);
      if (doc && clickHandler) doc.removeEventListener("click", clickHandler, true);
      if (frame && loadHandler) frame.removeEventListener("load", loadHandler);
    };
  }, []);

  return null;
}
