(() => {
  let dashboardSnapshot = null;
  Promise.all([
    fetch("/api/dashboard-data", { cache: "no-store" }).then(response => response.ok ? response.json() : Promise.reject(new Error("dashboard data"))),
    fetch("/api/monthly-operations", { cache: "no-store" }).then(response => response.ok ? response.json() : null).catch(() => null),
  ])
    .then(([payload, monthlyOperations]) => {
      dashboardSnapshot = payload.data || null;
      if (dashboardSnapshot && monthlyOperations) {
        if (Array.isArray(monthlyOperations.summaries)) dashboardSnapshot.operationSummaries = monthlyOperations.summaries;
        if (Array.isArray(monthlyOperations.plans)) dashboardSnapshot.salesPlans = monthlyOperations.plans;
      }
      // Let the exported React dashboard finish hydrating before adding the
      // sheet-driven enhancement nodes. Mutating sooner can trigger React #418.
      setTimeout(apply, 2200);
    })
    .catch(() => {});
  const ensureStaticPreviewBadge = () => {
    const actions = document.querySelector(".topbar-actions");
    if (!actions || actions.querySelector(".static-preview-badge")) return;
    const badge = document.createElement("div");
    badge.className = "static-preview-badge";
    badge.innerHTML = "<strong>쿠팡 시트 반영본</strong><span>첨부 데이터 기준 · 미리보기</span>";
    actions.prepend(badge);
  };
  const selectedIndexes = () => {
    const selects = [...document.querySelectorAll(".range-filter select")];
    const start = Number(selects[0]?.value ?? 0);
    const end = Number(selects[1]?.value ?? 11);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, offset) => start + offset);
  };
  const sheetLines = value => String(value || "")
    .replace(/^"|"$/g, "")
    .split(/\r?\n/)
    .map(line => line.replace(/\t+$/g, "").trim())
    .filter(Boolean);
  const operationContent = type => {
    if (!dashboardSnapshot) return { summary: ["시트 데이터 불러오는 중"], plan: ["시트 데이터 불러오는 중"] };
    const fields = {
      monthly: ["operationSummaries", "salesPlans"],
      brand: ["brandOperationSummaries", "brandSalesPlans"],
      marketing: ["marketingOperationSummaries", "marketingSalesPlans"],
    }[type];
    const summaries = dashboardSnapshot[fields[0]] || [];
    const plans = dashboardSnapshot[fields[1]] || [];
    const index = selectedIndexes()
      .filter(monthIndex => String(summaries[monthIndex] || plans[monthIndex] || "").trim())
      .at(-1);
    if (index === undefined) {
      return { summary: ["선택 기간에 입력된 운영요약이 없습니다."], plan: ["선택 기간에 입력된 향후계획이 없습니다."] };
    }
    return {
      summary: sheetLines(summaries[index]).length ? sheetLines(summaries[index]) : ["운영요약 입력 대기"],
      plan: sheetLines(plans[index]).length ? sheetLines(plans[index]) : ["향후계획 입력 대기"],
    };
  };
  const ensureOperationPlan = (panel, type) => {
    if (!panel) return;
    panel.querySelectorAll(":scope > .operation-detail-card").forEach(node=>node.remove());
    let grid=panel.querySelector(":scope > .operation-plan-grid");
    if (!grid) {
      grid=document.createElement("section");
      grid.className=`operation-plan-grid operation-plan-${type}`;
      const before=panel.querySelector(":scope > .gmv-chart-guide, :scope > .brand-chart-guide, :scope > .marketing-operations-top, :scope > .brand-operations-top, :scope > .chart-scroll");
      before ? before.insertAdjacentElement("beforebegin",grid) : panel.prepend(grid);
    }
    const content=operationContent(type);
    const signature=JSON.stringify(content);
    if (grid.dataset.signature === signature) return;
    grid.dataset.signature=signature;
    const column=(label,lines,tone)=>`<article class="${tone}"><div><strong>${label}</strong><span>시트 입력값</span></div>${lines.map(line=>`<p>${line}</p>`).join("")}</article>`;
    grid.innerHTML=column("운영요약",content.summary,"summary")+column("향후계획",content.plan,"plan");
  };
  const moveOperations = () => {
    ensureOperationPlan(document.querySelector(".gmv-target-panel"),"monthly");
    ensureOperationPlan(document.querySelector(".brand-trend-panel"),"brand");
    ensureOperationPlan(document.querySelector(".hero-panel"),"marketing");
  };

  const format = value => new Intl.NumberFormat("ko-KR").format(Math.round(Number(value) || 0));
  const escapeHtml = value => String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const rowsForBrand = brand => {
    const ad = dashboardSnapshot?.adPerformanceByBrand?.[brand];
    if (!ad) return [];
    return selectedIndexes().map(index => ({
      index,
      month: `${index + 1}월`,
      spend: Number(ad.spend?.[index]) || 0,
      revenue: Number(ad.revenue?.[index]) || 0,
      conversion: Number(ad.conversionRate?.[index]) || 0,
      rohs: Number(ad.rohs?.[index]) || 0,
    })).filter(row => row.spend || row.revenue || row.conversion || row.rohs);
  };
  const renderRateChart = (rows, label, key, color) => {
    const max = Math.max(...rows.map(row => row[key]), 1) * 1.15;
    const coords = rows.map((row, index) => ({
      x: rows.length === 1 ? 180 : 42 + (276 * index) / (rows.length - 1),
      y: 112 - (row[key] / max) * 84,
      value: row[key],
      month: row.month,
    }));
    const decimals = key === "conversion" ? 1 : 0;
    return `<div class="custom-rate-card" style="--rate-color:${color}"><div class="custom-rate-head"><div><span>${label} 추이</span><strong>${rows.at(-1)[key].toFixed(decimals)}%</strong></div><b>단위: %</b></div><svg viewBox="0 0 360 138" role="img" aria-label="${label} 월별 추이"><line x1="34" y1="112" x2="326" y2="112" stroke="#e8eef6"/><line x1="34" y1="28" x2="326" y2="28" stroke="#e8eef6"/><polyline fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${coords.map(point => `${point.x},${point.y}`).join(" ")}"/>${coords.map(point => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#fff" stroke="${color}" stroke-width="3"/><text x="${point.x}" y="${Math.max(18, point.y - 8)}" text-anchor="middle" font-size="10" font-weight="900" fill="${color}">${point.value.toFixed(decimals)}%</text><text x="${point.x}" y="132" text-anchor="middle" font-size="10" font-weight="850" fill="#526176">${point.month}</text>`).join("")}</svg></div>`;
  };
  const renderAdDashboard = rows => {
    if (!rows.length) return '<div class="custom-ad-empty"><strong>광고 성과 입력 대기</strong><p>쿠팡_품목별 GMV 및 재고매출 탭의 해당 브랜드 광고 운영 성과 영역에 값을 입력하면 자동으로 표시됩니다.</p></div>';
    const maxMoney = Math.max(...rows.flatMap(row => [row.spend, row.revenue]), 1) * 1.12;
    const xAt = index => rows.length === 1 ? 360 : 90 + (540 * index) / (rows.length - 1);
    const base = 232;
    const bars = rows.map((row, index) => {
      const x = xAt(index);
      const revenueHeight = Math.max(3, row.revenue / maxMoney * 190);
      const spendHeight = Math.max(3, row.spend / maxMoney * 190);
      return `<rect x="${x - 32}" y="${base - revenueHeight}" width="29" height="${revenueHeight}" rx="5" fill="#2867f0"/><rect x="${x + 3}" y="${base - spendHeight}" width="29" height="${spendHeight}" rx="5" fill="#a9bddc"/><text x="${x - 17.5}" y="${Math.max(27, base - revenueHeight - 7)}" text-anchor="middle" font-size="9" font-weight="900" fill="#205ac9">${format(row.revenue / 10000)}만</text><text x="${x + 17.5}" y="${Math.max(27, base - spendHeight - 7)}" text-anchor="middle" font-size="9" font-weight="900" fill="#66748a">${format(row.spend / 10000)}만</text><text x="${x}" y="257" text-anchor="middle" font-size="10" font-weight="850" fill="#526176">${row.month}</text>`;
    }).join("");
    const table = `<div class="custom-ad-table-wrap"><table class="custom-ad-table"><thead><tr><th>월</th><th>집행 광고비</th><th>광고 전환매출</th><th>전환율</th><th>ROHS</th></tr></thead><tbody>${rows.map(row => `<tr><td>${row.month}</td><td>${format(row.spend)}원</td><td>${format(row.revenue)}원</td><td>${row.conversion.toFixed(1)}%</td><td>${row.rohs.toFixed(0)}%</td></tr>`).join("")}</tbody></table></div>`;
    return `<div class="custom-ad-grid"><div class="custom-ad-card"><div class="custom-chart-title"><h4>광고비 대비 전환매출</h4><span><i></i>전환매출 <i></i>광고비</span></div><svg viewBox="0 0 720 275" role="img" aria-label="월별 광고비와 전환매출 비교"><line x1="44" y1="42" x2="682" y2="42" stroke="#e8eef6"/><line x1="44" y1="89.5" x2="682" y2="89.5" stroke="#e8eef6"/><line x1="44" y1="137" x2="682" y2="137" stroke="#e8eef6"/><line x1="44" y1="184.5" x2="682" y2="184.5" stroke="#e8eef6"/><line x1="44" y1="232" x2="682" y2="232" stroke="#e8eef6"/>${bars}</svg></div><div class="custom-rate-stack">${renderRateChart(rows, "전환율", "conversion", "#18a67b")}${renderRateChart(rows, "ROHS", "rohs", "#dc5963")}</div></div>${table}`;
  };
  const ensureAdSection = () => {
    const panel = document.querySelector(".brand-trend-panel");
    if (!panel) return;
    const selected = document.querySelector(".report-brand-select")?.value?.trim() || "";
    const visible = panel.classList.contains("report-item-summary") && Boolean(selected && !selected.includes("전체"));
    const rows = visible ? rowsForBrand(selected) : [];
    let section = panel.querySelector(":scope > .custom-ad-ops");
    if (!section && visible) {
      section = document.createElement("section");
      section.className = "custom-ad-ops";
      panel.append(section);
    }
    if (!section) return;
    const signature=JSON.stringify([selected,rows]);
    if(section.dataset.signature!==signature){
      const latest=rows.at(-1);
      const first=rows[0];
      const display=(value,formatter)=>value?formatter(value):"입력 대기";
      const delta=(current,base,suffix="%")=>base?`${current>=base?"▲":"▼"} ${Math.abs((current-base)/base*100).toFixed(1)}${suffix}`:"비교 데이터 없음";
      section.dataset.signature=signature;
      section.innerHTML = `<div class="custom-ad-head"><div><p>BRAND AD PERFORMANCE</p><h3>${escapeHtml(selected)} 광고 운영 성과</h3></div><span>시트 입력값 · 실제 입력 월만 표시</span></div><div class="custom-ad-kpis"><article><span>${latest?.month || "선택 월"} 광고 전환매출</span><strong>${display(latest?.revenue,value=>format(value)+"원")}</strong><small>${latest&&first?delta(latest.revenue,first.revenue):"비교 데이터 없음"}</small></article><article><span>${latest?.month || "선택 월"} 집행 광고비</span><strong>${display(latest?.spend,value=>format(value)+"원")}</strong><small>동일 월 집행액</small></article><article><span>${latest?.month || "선택 월"} 전환율</span><strong>${display(latest?.conversion,value=>value.toFixed(1)+"%")}</strong><small>${latest&&first?(latest.conversion-first.conversion>=0?"+":"")+(latest.conversion-first.conversion).toFixed(1)+"%p":"비교 데이터 없음"}</small></article><article><span>${latest?.month || "선택 월"} ROHS</span><strong>${display(latest?.rohs,value=>value.toFixed(0)+"%")}</strong><small>${latest&&first?(latest.rohs-first.rohs>=0?"+":"")+(latest.rohs-first.rohs).toFixed(0)+"%p":"비교 데이터 없음"}</small></article></div>${renderAdDashboard(rows)}`;
    }
    section.classList.toggle("is-visible", visible);
  };

  const ensureEventSpendStyles = () => {
    if (document.getElementById("event-spend-live-style")) return;
    const style = document.createElement("style");
    style.id = "event-spend-live-style";
    style.textContent = `
      .event-spend-panel .event-live-wrap{margin:8px 0 18px}
      .event-spend-panel .event-live-list{display:grid;gap:10px;margin-top:14px}
      .event-spend-panel .event-live-row{display:grid;grid-template-columns:150px minmax(0,1fr) 90px;align-items:center;gap:12px}
      .event-spend-panel .event-live-name{color:#526176;font-size:11px;font-weight:850}
      .event-spend-panel .event-live-track{height:22px;border-radius:7px;background:#edf1f6;overflow:hidden}
      .event-spend-panel .event-live-bar{display:block;height:100%;min-width:2px;border-radius:7px;background:#2867f0}
      .event-spend-panel .event-live-value{text-align:right;color:#10203d;font-size:11px;font-weight:900;font-variant-numeric:tabular-nums}
      .event-spend-panel .event-live-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;padding:11px 13px;border:1px solid #dfe7f1;border-radius:10px;background:#f8faff}
      .event-spend-panel .event-live-summary span{color:#718096;font-size:10px;font-weight:800}
      .event-spend-panel .event-live-summary strong{color:#205ac9;font-size:14px}
      @media(max-width:760px){.event-spend-panel .event-live-row{grid-template-columns:110px minmax(0,1fr) 76px}.event-spend-panel .event-live-name,.event-spend-panel .event-live-value{font-size:9px}}
    `;
    document.head.append(style);
  };
  const ensureEventSpendPanel = () => {
    if (!dashboardSnapshot) return;
    const panel = document.querySelector(".event-spend-panel");
    if (!panel) return;
    const indexes = selectedIndexes();
    if (indexes.length !== 1) return;
    const monthIndex = indexes[0];
    const rows = (dashboardSnapshot.eventBreakdown || [])
      .map(item => ({ name: String(item.name || "").replace(/^\d+\.\s*/, ""), value: Number(item.values?.[monthIndex]) || 0 }))
      .filter(item => item.value !== 0);
    const signature = JSON.stringify([monthIndex, rows]);
    if (panel.dataset.liveEventSignature === signature) return;
    panel.dataset.liveEventSignature = signature;
    ensureEventSpendStyles();
    const old = panel.querySelector(".event-live-wrap");
    old?.remove();
    panel.querySelector(".event-empty")?.setAttribute("style", "display:none!important");
    const total = rows.reduce((sum, item) => sum + item.value, 0);
    const totalNode = panel.querySelector(".event-total");
    if (totalNode) totalNode.textContent = `${monthIndex + 1}월 합계 ${Math.round(total / 1000).toLocaleString("ko-KR")}천원`;
    const wrap = document.createElement("div");
    wrap.className = "event-live-wrap";
    if (!rows.length) {
      wrap.innerHTML = `<div class="event-live-summary"><span>${monthIndex + 1}월 매출차감행사비</span><strong>입력 내역 없음</strong></div>`;
    } else {
      const max = Math.max(...rows.map(item => Math.abs(item.value)), 1);
      wrap.innerHTML = `<div class="event-live-list">${rows.map(item => {
        const width = Math.max(2, Math.abs(item.value) / max * 100);
        return `<div class="event-live-row"><span class="event-live-name">${item.name}</span><div class="event-live-track"><i class="event-live-bar" style="width:${width}%"></i></div><strong class="event-live-value">${Math.round(item.value / 1000).toLocaleString("ko-KR")}</strong></div>`;
      }).join("")}</div><div class="event-live-summary"><span>${monthIndex + 1}월 행사별 매출차감 합계</span><strong>${Math.round(total / 1000).toLocaleString("ko-KR")}천원</strong></div>`;
    }
    const heading = panel.querySelector(":scope > .panel-heading") || panel.querySelector(":scope > .section-heading") || panel.querySelector("h2")?.parentElement;
    heading ? heading.insertAdjacentElement("afterend", wrap) : panel.prepend(wrap);
  };

  const ensureRefreshMode = () => {
    const button = document.querySelector(".refresh-button");
    if (!button) return;
    button.disabled = false;
    button.classList.remove("refreshing");
    const title = button.querySelector("strong");
    const note = button.querySelector("small");
    if (title) title.textContent = "페이지 새로고침";
    if (note) note.textContent = "새로고침 시 시트 최신값 반영";
    if (button.dataset.reloadOnly === "true") return;
    button.dataset.reloadOnly = "true";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.top.location.reload();
    }, true);
  };

  const apply = () => {
    ensureStaticPreviewBadge(); moveOperations(); ensureAdSection(); ensureEventSpendPanel(); ensureRefreshMode();
  };
  window.addEventListener("load", () => setTimeout(apply, 1800), {once:true});
  document.addEventListener("change", event => {
    if (event.target.matches(".report-brand-select")) setTimeout(apply, 400);
    if (event.target.matches(".range-filter select")) setTimeout(apply, 450);
  });
  document.addEventListener("click", () => setTimeout(apply, 400));
})();
