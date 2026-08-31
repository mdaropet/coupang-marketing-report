"use client";

import { useEffect } from "react";

type AdSeries = {
  spend?: number[];
  revenue?: number[];
  conversionRate?: number[];
  rohs?: number[];
};

type DashboardPayload = { data?: { adPerformanceByBrand?: Record<string, AdSeries> } };

export default function AdPerformanceFix() {
  useEffect(() => {
    let data: Record<string, AdSeries> = {};
    let timer: ReturnType<typeof setInterval> | null = null;

    const formatWon = (value: number) => `${new Intl.NumberFormat("ko-KR").format(value)}원`;
    const selectedIndexes = (doc: Document) => {
      const selects = [...doc.querySelectorAll<HTMLSelectElement>(".range-filter select")];
      const startRaw = Number(selects[0]?.value ?? 0);
      const endRaw = Number(selects[1]?.value ?? 11);
      const start = Number.isFinite(startRaw) ? Math.max(0, Math.min(11, startRaw)) : 0;
      const end = Number.isFinite(endRaw) ? Math.max(start, Math.min(11, endRaw)) : 11;
      return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
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

    const rateCard = (rows: ReturnType<typeof rowsForBrand>, key: "conversion" | "rohs", label: string) => {
      if (!rows.length) return `<article class="ad-shot-rate"><div><strong>${label} 추이</strong><span>단위: %</span></div><p>입력 데이터 없음</p></article>`;
      const max = Math.max(1, ...rows.map(row => Number(row[key]) || 0)) * 1.15;
      const points = rows.map((row, i) => {
        const x = rows.length === 1 ? 180 : 36 + (288 * i) / (rows.length - 1);
        const value = Number(row[key]) || 0;
        const y = 116 - (value / max) * 82;
        return { x, y, value, month: row.month };
      });
      return `<article class="ad-shot-rate"><div><strong>${label} 추이</strong><span>단위: %</span></div><svg viewBox="0 0 360 145"><line x1="32" y1="116" x2="332" y2="116" class="ad-shot-grid"></line><polyline class="ad-shot-line ${key}" points="${points.map(p => `${p.x},${p.y}`).join(" ")}"></polyline>${points.map(p => `<circle class="ad-shot-dot ${key}" cx="${p.x}" cy="${p.y}" r="3.5"></circle><text x="${p.x}" y="${Math.max(15, p.y - 7)}" text-anchor="middle" class="ad-shot-point">${key === "conversion" ? p.value.toFixed(1) : p.value.toFixed(0)}%</text><text x="${p.x}" y="138" text-anchor="middle" class="ad-shot-month">${p.month}</text>`).join("")}</svg></article>`;
    };

    const moneyArea = (rows: ReturnType<typeof rowsForBrand>) => {
      if (!rows.length) return `<div class="ad-shot-money-empty">선택 브랜드의 광고 성과 데이터가 아직 입력되지 않았습니다.</div>`;
      const maxMoney = Math.max(1, ...rows.flatMap(row => [row.spend, row.revenue]));
      const bars = rows.map((row, i) => {
        const x = rows.length === 1 ? 350 : 70 + (560 * i) / (rows.length - 1);
        const rh = Math.max(row.revenue ? 3 : 0, (row.revenue / maxMoney) * 176);
        const sh = Math.max(row.spend ? 3 : 0, (row.spend / maxMoney) * 176);
        return `<rect x="${x - 24}" y="${218 - rh}" width="21" height="${rh}" rx="4" class="ad-shot-revenue"></rect><rect x="${x + 3}" y="${218 - sh}" width="21" height="${sh}" rx="4" class="ad-shot-spend"></rect><text x="${x}" y="242" text-anchor="middle" class="ad-shot-month">${row.month}</text>`;
      }).join("");
      return `<div class="ad-shot-money"><svg viewBox="0 0 700 255"><line x1="36" y1="218" x2="664" y2="218" class="ad-shot-grid"></line>${bars}</svg></div>`;
    };

    const ensureStyle = (doc: Document) => {
      doc.getElementById("hide-all-brand-ad-performance")?.remove();
      if (doc.getElementById("ad-shot-style")) return;
      const style = doc.createElement("style");
      style.id = "ad-shot-style";
      style.textContent = `
        .brand-trend-panel .custom-ad-ops,.brand-trend-panel .ad-performance-summary,.brand-trend-panel .ad-performance-inline,.brand-trend-panel .report-ad-clean{display:none!important}
        .ad-shot{margin:18px 0 0;padding:18px;border:1px solid #dfe7f1;border-radius:15px;background:#f8faff}
        .ad-shot-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}.ad-shot-head p{margin:0 0 5px;color:#2867f0;font-size:9px;font-weight:950;letter-spacing:.09em}.ad-shot-head h3{margin:0;color:#10203d;font-size:18px}.ad-shot-head>span{color:#718096;font-size:10px;font-weight:850}
        .ad-shot-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:14px}.ad-shot-kpis article{background:#fff;border:1px solid #dce6f2;border-radius:12px;padding:12px 14px}.ad-shot-kpis article:nth-child(1){border-top:3px solid #2867f0}.ad-shot-kpis article:nth-child(2){border-top:3px solid #76a9ff}.ad-shot-kpis article:nth-child(3){border-top:3px solid #18a67b}.ad-shot-kpis article:nth-child(4){border-top:3px solid #dc5963}.ad-shot-kpis span{display:block;color:#718096;font-size:9px;font-weight:800}.ad-shot-kpis strong{display:block;margin-top:5px;color:#10203d;font-size:16px}
        .ad-shot-body{display:grid;grid-template-columns:minmax(0,1fr) 315px;gap:12px;min-height:330px}.ad-shot-money,.ad-shot-money-empty{border:0;border-radius:12px;display:grid;place-items:center;min-height:330px;color:#718096;font-size:10px;font-weight:800}.ad-shot-money svg{width:100%;height:auto}.ad-shot-side{display:grid;gap:12px}.ad-shot-rate{background:#fff;border:1px solid #dce6f2;border-radius:12px;padding:12px}.ad-shot-rate>div{display:flex;justify-content:space-between;gap:10px}.ad-shot-rate strong{color:#10203d;font-size:12px}.ad-shot-rate span{color:#718096;font-size:9px;font-weight:800}.ad-shot-rate p{display:grid;place-items:center;min-height:115px;color:#8a95a6;font-size:10px;font-weight:800}.ad-shot-rate svg{display:block;width:100%;height:auto}.ad-shot-grid{stroke:#e7edf5;stroke-width:1}.ad-shot-revenue{fill:#2867f0}.ad-shot-spend{fill:#a9bddc}.ad-shot-line{fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}.ad-shot-line.conversion{stroke:#18a67b}.ad-shot-line.rohs{stroke:#dc5963}.ad-shot-dot{fill:#fff;stroke-width:2.5}.ad-shot-dot.conversion{stroke:#18a67b}.ad-shot-dot.rohs{stroke:#dc5963}.ad-shot-point{fill:#344158;font-size:8px;font-weight:900}.ad-shot-month{fill:#526176;font-size:8px;font-weight:850}
        @media(max-width:900px){.ad-shot-body{grid-template-columns:1fr}.ad-shot-kpis{grid-template-columns:repeat(2,1fr)}}
      `;
      doc.head.appendChild(style);
    };

    const render = () => {
      try {
        const frame = document.querySelector<HTMLIFrameElement>(".dashboard-frame");
        const doc = frame?.contentDocument;
        if (!doc?.body || !doc.head) return;
        ensureStyle(doc);
        const panel = doc.querySelector<HTMLElement>(".brand-trend-panel");
        const detail = panel?.querySelector<HTMLElement>(".brand-detail");
        const select = doc.querySelector<HTMLSelectElement>(".report-brand-select");
        if (!panel || !detail || !select) return;
        const brand = select.value.trim();
        const visible = panel.classList.contains("report-item-summary") && brand && !brand.includes("전체");
        let box = detail.querySelector<HTMLElement>(".ad-shot");
        if (!visible) { box?.remove(); return; }
        const rows = rowsForBrand(brand, doc);
        const signature = JSON.stringify([brand, selectedIndexes(doc), rows]);
        if (!box) { box = doc.createElement("section"); box.className = "ad-shot"; detail.appendChild(box); }
        if (box.dataset.signature === signature) return;
        box.dataset.signature = signature;
        const latest = rows.at(-1);
        const month = latest?.month || "선택 월";
        const value = (n: number | undefined, fn: (n: number) => string) => Number(n) ? fn(Number(n)) : "입력 대기";
        box.innerHTML = `<div class="ad-shot-head"><div><p>BRAND AD PERFORMANCE</p><h3>${brand} 광고 운영 성과</h3></div><span>광고비·전환율·전환매출·ROHS 월별 추이</span></div><div class="ad-shot-kpis"><article><span>${month} 광고비</span><strong>${value(latest?.spend, formatWon)}</strong></article><article><span>${month} 전환매출</span><strong>${value(latest?.revenue, formatWon)}</strong></article><article><span>${month} 전환율</span><strong>${value(latest?.conversion, n => `${n.toFixed(1)}%`)}</strong></article><article><span>${month} ROHS</span><strong>${value(latest?.rohs, n => `${n.toFixed(0)}%`)}</strong></article></div><div class="ad-shot-body">${moneyArea(rows)}<div class="ad-shot-side">${rateCard(rows, "conversion", "전환율")}${rateCard(rows, "rohs", "ROHS")}</div></div>`;
      } catch {
        // 광고 성과 표시 오류가 브랜드 선택 화면 전체에 영향을 주지 않도록 격리합니다.
      }
    };

    fetch("/api/dashboard-data", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("dashboard data")))
      .then((payload: DashboardPayload) => { data = payload.data?.adPerformanceByBrand || {}; })
      .catch(() => { data = {}; });

    render();
    timer = setInterval(render, 700);
    return () => { if (timer) clearInterval(timer); };
  }, []);

  return null;
}
