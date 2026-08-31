(() => {
  const BASE_SCRIPT = "https://coupang-marketing-report-drgscj6ba-md-8572s-projects.vercel.app/dashboard/enhancements.js";
  let overrides = null;

  const addStyles = () => {
    if (document.getElementById("requested-fixes-20260831")) return;
    const style = document.createElement("style");
    style.id = "requested-fixes-20260831";
    style.textContent = `
      .brand-trend-panel.report-brand-summary > .panel-heading h2 { font-size:0 !important; }
      .brand-trend-panel.report-brand-summary > .panel-heading h2::after { content:"로켓 브랜드별 GMV"; font-size:20px; }
      .brand-accounting-block > .brand-accounting-summary,
      .brand-detail .brand-operations-top,
      .brand-detail .operation-plan-grid,
      .brand-detail .operation-detail-card { display:none !important; }
      .event-live-bars { display:grid; grid-template-columns:repeat(7,minmax(90px,1fr)); gap:10px; min-width:760px; align-items:end; min-height:250px; padding:18px 8px 4px; overflow-x:auto; }
      .event-live-col { height:225px; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:6px; }
      .event-live-value { font-size:10px; font-weight:900; color:#1d2a40; white-space:nowrap; }
      .event-live-track { width:48px; height:170px; display:flex; align-items:flex-end; border-bottom:1px solid #dfe7f1; }
      .event-live-track i { display:block; width:100%; min-height:2px; border-radius:5px 5px 0 0; background:#2867f0; }
      .event-live-label { font-size:9px; font-weight:800; color:#526176; text-align:center; line-height:1.35; }
      .event-live-note { margin:8px 0 0; color:#718096; font-size:9px; font-weight:700; }
    `;
    document.head.append(style);
  };

  const lines = value => String(value || "").split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  const format = value => new Intl.NumberFormat("ko-KR").format(Math.round(Number(value) || 0));

  const fixMonthlyPlan = () => {
    if (!overrides) return;
    const august = (overrides.monthlyOps || []).find(row => String(row.month).trim() === "8월");
    if (!august) return;
    const grid = document.querySelector(".gmv-target-panel > .operation-plan-grid");
    if (!grid) return;
    const summary = grid.querySelector("article.summary");
    const plan = grid.querySelector("article.plan");
    if (summary && august.summary) {
      summary.innerHTML = `<div><strong>8월 운영 요약</strong><span>시트 D16 연동</span></div>${lines(august.summary).map(v => `<p>${v}</p>`).join("")}`;
    }
    if (plan && august.plan) {
      plan.innerHTML = `<div><strong>8월 향후 계획</strong><span>시트 D16 연동</span></div>${lines(august.plan).map(v => `<p>${v}</p>`).join("")}`;
    }
  };

  const fixBrandPage = () => {
    const panel = document.querySelector(".brand-trend-panel");
    if (!panel) return;
    panel.querySelectorAll(".brand-accounting-summary, .brand-detail .brand-operations-top, .brand-detail .operation-plan-grid, .brand-detail .operation-detail-card").forEach(node => node.remove());
    const topGrids = [...panel.querySelectorAll(":scope > .operation-plan-grid")];
    topGrids.slice(1).forEach(node => node.remove());
  };

  const renderAugustDeduction = () => {
    const panel = document.querySelector(".event-spend-panel");
    const data = overrides?.augustDeduction;
    if (!panel || !data) return;
    const total = Number(data.total) || 0;
    const rows = Object.entries(data.breakdown || {}).map(([name, value]) => ({ name, value:Number(value)||0 }));
    const max = Math.max(...rows.map(r => Math.abs(r.value)), 1);
    const totalNode = panel.querySelector(".event-total");
    if (totalNode) totalNode.textContent = `8월 합계 ${format(total / 1000)}천원`;
    const empty = panel.querySelector(".event-empty");
    if (!empty) return;
    empty.className = "event-live-wrap";
    empty.innerHTML = `<div class="event-live-bars">${rows.map(row => {
      const height = Math.max(2, Math.abs(row.value) / max * 165);
      const label = row.name.replace(/^\d+\.\s*/, "");
      return `<div class="event-live-col"><strong class="event-live-value">${format(row.value / 1000)}</strong><div class="event-live-track"><i style="height:${height}px"></i></div><span class="event-live-label">${label}</span></div>`;
    }).join("")}</div><p class="event-live-note">8월 데이터 · 쿠팡_매출차감행사비 내역 G3:G38 실시간 합산</p>`;
  };

  const applyFixes = () => {
    addStyles();
    fixMonthlyPlan();
    fixBrandPage();
    renderAugustDeduction();
  };

  const loadOverrides = async () => {
    try {
      const res = await fetch("/api/dashboard-overrides", { cache:"no-store" });
      if (res.ok) overrides = await res.json();
    } catch {}
    applyFixes();
  };

  const base = document.createElement("script");
  base.src = BASE_SCRIPT;
  base.async = false;
  base.onload = () => {
    loadOverrides();
    [500, 1200, 2200, 4000].forEach(ms => setTimeout(applyFixes, ms));
  };
  base.onerror = () => loadOverrides();
  document.head.append(base);

  document.addEventListener("click", () => setTimeout(applyFixes, 350));
  document.addEventListener("change", () => setTimeout(applyFixes, 350));
})();
