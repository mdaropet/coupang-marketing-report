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
      setTimeout(apply, 0);
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
  const operationCopy = {
    monthly: [
      "1~7월 실적은 로켓 GMV 중심으로 안정적인 매출 흐름을 유지했습니다.",
      "7월 프로모션과 브랜드 집중 운영으로 총 GMV가 전월 대비 개선되었습니다.",
      "하반기는 CPC 효율 관리와 10월 집중 투자를 통해 목표 매출 달성을 추진합니다."
    ],
    brand: [
      "상위 브랜드 중심의 매출 기여도를 유지하면서 신규 브랜드 성장을 병행했습니다.",
      "브랜드별 GMV와 재고매출 차이를 점검해 행사 및 재고 운영 우선순위를 조정합니다.",
      "하반기는 성장 가능성이 높은 품목에 광고와 프로모션을 선택적으로 집중합니다."
    ],
    marketing: [
      "상반기 집행 성과를 기준으로 효율이 확인된 CPC 캠페인을 우선 유지합니다.",
      "잔여 예산은 월별 균등 집행보다 매출 확대 가능성이 높은 시점에 집중 배분합니다.",
      "광고비 비중과 전환 성과를 함께 관리해 GMV 성장과 비용 효율을 동시에 확보합니다."
    ]
  };
  const planCopy = {
    monthly: ["8~9월은 효율이 검증된 상품 중심으로 안정적인 GMV를 확보합니다.","10월 CPC·디스플레이 광고를 집중해 월 GMV 10억원을 추진합니다.","11~12월은 광고 효율과 재고 수준을 점검하며 수익성을 관리합니다."],
    brand: ["상위 브랜드는 주력 SKU 품절 방지와 행사 효율을 우선 관리합니다.","잘싸모래는 대표 배너·체험단·매출차감행사를 연계해 신규 수요를 확대합니다.","저효율 브랜드는 광고비보다 상품 구성과 재고 회전 개선에 집중합니다."],
    marketing: ["잔여 예산은 월별 균등 배분보다 매출 확대 가능성이 높은 시점에 집중합니다.","전환율과 ROHS가 확인된 CPC 캠페인을 우선 유지합니다.","집행 후 전환매출과 광고비율을 함께 점검해 다음 달 예산을 조정합니다."]
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
    if (type !== "monthly" || !dashboardSnapshot) {
      return { summary: operationCopy[type], plan: planCopy[type], month: "" };
    }
    const summaries = dashboardSnapshot.operationSummaries || [];
    const plans = dashboardSnapshot.salesPlans || [];
    const index = selectedIndexes()
      .filter(monthIndex => String(summaries[monthIndex] || plans[monthIndex] || "").trim())
      .at(-1);
    if (index === undefined) {
      return { summary: ["선택 기간에 입력된 운영요약이 없습니다."], plan: ["선택 기간에 입력된 향후계획이 없습니다."], month: "" };
    }
    return {
      summary: sheetLines(summaries[index]).length ? sheetLines(summaries[index]) : ["운영요약 입력 대기"],
      plan: sheetLines(plans[index]).length ? sheetLines(plans[index]) : ["향후계획 입력 대기"],
      month: `${index + 1}월`,
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
    const column=(label,lines,tone)=>`<article class="${tone}"><div><strong>${content.month ? `${content.month} ${label}` : label}</strong><span>시트 입력값</span></div>${lines.map(line=>`<p>${line}</p>`).join("")}</article>`;
    grid.innerHTML=column("운영 요약",content.summary,"summary")+column("향후 계획",content.plan,"plan");
  };
  const moveOperations = () => {
    ensureOperationPlan(document.querySelector(".gmv-target-panel"),"monthly");
    ensureOperationPlan(document.querySelector(".brand-trend-panel"),"brand");
    ensureOperationPlan(document.querySelector(".hero-panel"),"marketing");
  };

  let adRows = [];
  const rowsForBrand = brand => {
    const ad = dashboardSnapshot?.adPerformanceByBrand?.[brand];
    if (!ad) return [];
    return Array.from({length:9},(_,offset)=>{
      const index=offset+3;
      return {
        month:`${index+1}월`,
        spend:Number(ad.spend?.[index])||0,
        revenue:Number(ad.revenue?.[index])||0,
        conversion:Number(ad.conversionRate?.[index])||0,
        rohs:Number(ad.rohs?.[index])||0,
      };
    }).filter(row=>row.spend||row.revenue||row.conversion||row.rohs);
  };
  const won = value => new Intl.NumberFormat("ko-KR").format(value) + "원";
  const adChart = () => {
    if (!adRows.length) return '<div class="custom-ad-empty"><strong>광고 성과 입력 대기</strong><p>쿠팡_품목별 GMV 및 재고매출 탭의 해당 브랜드 광고 운영 성과 영역에 값을 입력하면 표시됩니다.</p></div>';
    const maxMoney = Math.max(...adRows.flatMap(d => [d.spend, d.revenue]));
    const xs = [105,245,385,525], base=210, top=28, h=base-top;
    const bars = adRows.slice(0,4).map((d,i) => {
      const rh=d.revenue/maxMoney*h, sh=d.spend/maxMoney*h, x=xs[i];
      return `<rect x="${x-36}" y="${base-rh}" width="30" height="${rh}" rx="4" fill="#2867f0"/><rect x="${x+6}" y="${base-sh}" width="30" height="${sh}" rx="4" fill="#a9bddc"/><text x="${x-21}" y="${base-rh-6}" text-anchor="middle" font-size="9" font-weight="900" fill="#205ac9">${Math.round(d.revenue/10000)}만</text><text x="${x+21}" y="${base-sh-6}" text-anchor="middle" font-size="9" font-weight="900" fill="#66748a">${Math.round(d.spend/10000)}만</text><text x="${x}" y="230" text-anchor="middle" font-size="10" font-weight="850" fill="#526176">${d.month}</text>`;
    }).join("");
    return `<div class="custom-ad-grid"><div class="custom-ad-card"><div class="custom-chart-title"><h4>광고비 대비 전환매출 추이</h4><span><i></i>전환매출 <i></i>광고비</span></div><svg viewBox="0 0 620 245"><line x1="50" y1="210" x2="580" y2="210" stroke="#e7edf5"/>${bars}</svg></div></div>`;
  };
  const ensureAdSection = () => {
    const detail = document.querySelector(".brand-trend-panel .brand-detail");
    if (!detail) return;
    const selected=document.querySelector(".report-brand-select")?.value || "";
    const visible=Boolean(selected && selected!=="전체 품목");
    adRows=visible?rowsForBrand(selected):[];
    let section = detail.querySelector(".custom-ad-ops");
    if (!section && visible) {
      section = document.createElement("section");
      section.className = "custom-ad-ops";
      detail.append(section);
    }
    if (!section) return;
    const signature=JSON.stringify([selected,adRows]);
    if(section.dataset.signature!==signature){
      const latest=adRows.at(-1);
      const month=latest?.month||"선택 월";
      const display=(value,formatter)=>value?formatter(value):"입력 대기";
      section.dataset.signature=signature;
      section.innerHTML = `<div class="custom-ad-head"><div><p>BRAND AD PERFORMANCE</p><h3>${selected} 광고 운영 성과</h3></div><span>광고비·전환율·전환매출·ROHS 월별 추이</span></div><div class="custom-ad-kpis"><article><span>${month} 광고비</span><strong>${display(latest?.spend,won)}</strong></article><article><span>${month} 전환매출</span><strong>${display(latest?.revenue,won)}</strong></article><article><span>${month} 전환율</span><strong>${display(latest?.conversion,value=>value.toFixed(1)+"%")}</strong></article><article><span>${month} ROHS</span><strong>${display(latest?.rohs,value=>value.toFixed(0)+"%")}</strong></article></div>${adChart()}`;
    }
    section.classList.toggle("is-visible", visible);
  };
  const removeProductGmvAdMetrics = () => {
    const detail = document.querySelector(".brand-trend-panel .brand-detail");
    if (!detail) return;
    const gmvChart = detail.querySelectorAll(".product-detail-chart")[0] || detail;
    gmvChart.querySelectorAll(".product-efficiency-overlay, .conversion-revenue-bar, .conversion-revenue-label").forEach(node => node.remove());
    const legend = detail.querySelectorAll(".product-legend")[0];
    legend?.querySelectorAll("span").forEach(item => {
      if (["전환매출", "전환율", "ROHS"].includes(item.textContent.trim())) item.remove();
    });
  };
  const apply = () => {
    ensureStaticPreviewBadge(); moveOperations(); removeProductGmvAdMetrics(); ensureAdSection();
  };
  window.addEventListener("load", () => setTimeout(apply, 1800), {once:true});
  document.addEventListener("change", event => { if (event.target.matches(".report-brand-select")) setTimeout(apply, 400); });
  document.addEventListener("click", () => setTimeout(apply, 400));
})();
