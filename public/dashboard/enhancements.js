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
    const column=(label,lines,tone)=>`<article class="${tone}"><div><strong>${label}</strong><span>시트 입력값</span></div>${lines.map(line=>`<p>${escapeHtml(line)}</p>`).join("")}</article>`;
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
    const rows = Array.from({length: 12}, (_, index) => ({
      index,
      month: `${index + 1}월`,
      spend: Number(ad.spend?.[index]) || 0,
      revenue: Number(ad.revenue?.[index]) || 0,
      conversion: Number(ad.conversionRate?.[index]) || 0,
      rohs: Number(ad.rohs?.[index]) || 0,
    }));
    return rows.some(row => row.spend || row.revenue || row.conversion || row.rohs) ? rows : [];
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
      const populatedRows=rows.filter(row=>row.spend||row.revenue||row.conversion||row.rohs);
      const selectedRow=selectedIndexes().map(index=>rows[index]).filter(Boolean).findLast(row=>row.spend||row.revenue||row.conversion||row.rohs);
      const latest=selectedRow||populatedRows.at(-1);
      const first=populatedRows[0];
      const ad=dashboardSnapshot?.adPerformanceByBrand?.[selected]||{};
      const noteIndexes=selectedIndexes().filter(index=>String(ad.assessment?.[index]||ad.plans?.[index]||"").trim());
      const noteIndex=noteIndexes.at(-1)??Array.from({length:12},(_,index)=>index).filter(index=>String(ad.assessment?.[index]||ad.plans?.[index]||"").trim()).at(-1);
      const assessment=noteIndex===undefined?"성과판단 입력 대기":String(ad.assessment?.[noteIndex]||"성과판단 입력 대기");
      const plan=noteIndex===undefined?"향후계획 입력 대기":String(ad.plans?.[noteIndex]||"향후계획 입력 대기");
      const display=(value,formatter)=>value?formatter(value):"입력 대기";
      const delta=(current,base,suffix="%")=>base?`${current>=base?"▲":"▼"} ${Math.abs((current-base)/base*100).toFixed(1)}${suffix}`:"비교 데이터 없음";
      section.dataset.signature=signature;
      section.innerHTML = `<div class="custom-ad-head"><div><p>BRAND AD PERFORMANCE</p><h3>${escapeHtml(selected)} 광고 운영 성과</h3></div><span>시트 입력값 · 1월~12월 전체 추이</span></div><div class="custom-ad-kpis"><article><span>${latest?.month || "선택 월"} 광고 전환매출</span><strong>${display(latest?.revenue,value=>format(value)+"원")}</strong><small>${latest&&first?delta(latest.revenue,first.revenue):"비교 데이터 없음"}</small></article><article><span>${latest?.month || "선택 월"} 집행 광고비</span><strong>${display(latest?.spend,value=>format(value)+"원")}</strong><small>동일 월 집행액</small></article><article><span>${latest?.month || "선택 월"} 전환율</span><strong>${display(latest?.conversion,value=>value.toFixed(1)+"%")}</strong><small>${latest&&first?(latest.conversion-first.conversion>=0?"+":"")+(latest.conversion-first.conversion).toFixed(1)+"%p":"비교 데이터 없음"}</small></article><article><span>${latest?.month || "선택 월"} ROHS</span><strong>${display(latest?.rohs,value=>value.toFixed(0)+"%")}</strong><small>${latest&&first?(latest.rohs-first.rohs>=0?"+":"")+(latest.rohs-first.rohs).toFixed(0)+"%p":"비교 데이터 없음"}</small></article></div><div class="custom-ad-notes"><article><div><strong>성과판단</strong><span>${noteIndex===undefined?"입력 대기":`${noteIndex+1}월`}</span></div><p>${escapeHtml(assessment)}</p></article><article><div><strong>향후계획</strong><span>${noteIndex===undefined?"입력 대기":`${noteIndex+1}월`}</span></div><p>${escapeHtml(plan)}</p></article></div>${renderAdDashboard(rows)}`;
    }
    section.classList.toggle("is-visible", visible);
  };

  const ensureBudgetPlans = () => {
    const panel=document.querySelector(".budget-panel");
    if(!panel||!dashboardSnapshot)return;
    let section=panel.querySelector(":scope > .budget-plan-live");
    if(!section){section=document.createElement("section");section.className="budget-plan-live";panel.append(section)}
    const rows=dashboardSnapshot.budgetPlans||[];
    const signature=JSON.stringify(rows);
    if(section.dataset.signature===signature)return;
    section.dataset.signature=signature;
    section.innerHTML=`<div class="budget-plan-live-head"><div><p>REMAINING BUDGET PLAN</p><h3>잔여예산 사용 계획</h3></div><span>시트 15~21행 연동</span></div><div class="budget-plan-live-table-wrap"><table class="budget-plan-live-table"><thead><tr><th>월</th><th>사용 계획</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${escapeHtml(row.month)}</td><td>${escapeHtml(row.plan||"입력 대기")}</td></tr>`).join("")}</tbody></table></div>`;
  };

  const knownBrands=["아메리칸솔루션","캐네디언샌드","잘싸모래","클레버메이트","브리젠 파테","포우리패드","더스트몬"];
  const brandOf=name=>knownBrands.find(brand=>String(name||"").startsWith(brand))||String(name||"").split(/\s+/)[0];
  const changeText=(current,previous)=>{
    const delta=current-previous;
    if(!previous)return current?'<span class="change-new">신규/비교 불가</span>':'<span class="change-flat">-</span>';
    const rate=delta/Math.abs(previous)*100;
    if(Math.abs(delta)<1)return '<span class="change-flat">- 0.0%</span>';
    return `<span class="${delta>0?"change-up":"change-down"}">${delta>0?"▲":"▼"} ${format(Math.abs(delta))}원 (${Math.abs(rate).toFixed(1)}%)</span>`;
  };
  const renderMonthDetail=(target,monthIndex,title,rows)=>{
    if(!target||!dashboardSnapshot)return;
    if(target.nextElementSibling?.classList.contains("month-detail-live"))target.nextElementSibling.remove();
    const section=document.createElement("section");
    section.className="month-detail-live";
    section.innerHTML=`<div class="month-detail-live-head"><div><p>SELECTED MONTH DETAIL</p><h3>${monthIndex+1}월 ${escapeHtml(title)}</h3></div><span>전월 대비</span></div><div class="month-detail-live-table-wrap"><table class="month-detail-live-table"><thead><tr><th>구분</th><th>${monthIndex+1}월</th><th>${monthIndex===0?"전월":"전월("+monthIndex+"월)"}</th><th>증감</th></tr></thead><tbody>${rows.map(row=>{const current=Number(row.values?.[monthIndex])||0,previous=monthIndex>0?(Number(row.values?.[monthIndex-1])||0):0;return `<tr><td>${escapeHtml(row.name)}</td><td>${format(current)}원</td><td>${monthIndex===0?"-":format(previous)+"원"}</td><td>${monthIndex===0?'<span class="change-flat">비교 월 없음</span>':changeText(current,previous)}</td></tr>`}).join("")}</tbody></table></div>`;
    target.insertAdjacentElement("afterend",section);
  };
  const monthFromText=value=>{const match=String(value||"").match(/(\d{1,2})월/);return match?Number(match[1])-1:-1};
  const clearMonthDetails=()=>document.querySelectorAll(".month-detail-live").forEach(node=>node.remove());
  const handleChartMonthClick=event=>{
    if(!dashboardSnapshot)return;
    const monthlyGroup=event.target.closest(".gmv-target-chart g");
    const monthlyChart=event.target.closest(".gmv-target-chart");
    if(monthlyChart&&monthlyGroup){
      const monthIndex=monthFromText(monthlyGroup.querySelector(".month-axis-label")?.textContent);
      if(monthIndex<0)return;
      monthlyChart.querySelectorAll("g.is-month-detail-selected").forEach(node=>node.classList.remove("is-month-detail-selected"));
      monthlyGroup.classList.add("is-month-detail-selected");
      renderMonthDetail(monthlyChart.closest(".chart-scroll")||monthlyChart,monthIndex,"GMV 상세 내역",[
        {name:"로켓 GMV",values:dashboardSnapshot.rocketGmv},{name:"윙 GMV",values:dashboardSnapshot.wingGmv},{name:"총 GMV",values:dashboardSnapshot.totalGmv},{name:"GMV 목표",values:dashboardSnapshot.gmvTarget},
      ]);
      return;
    }
    const brandMonth=event.target.closest(".brand-month");
    if(brandMonth){
      const monthIndex=monthFromText(brandMonth.querySelector(":scope > span")?.textContent);
      if(monthIndex<0)return;
      const chart=brandMonth.closest(".brand-chart");
      chart?.querySelectorAll(".brand-month.is-month-detail-selected").forEach(node=>node.classList.remove("is-month-detail-selected"));
      brandMonth.classList.add("is-month-detail-selected");
      const inventory=Boolean(chart?.closest(".brand-accounting-block"));
      renderMonthDetail(chart,monthIndex,inventory?"브랜드별 재고매출 상세 내역":"브랜드별 GMV 상세 내역",inventory?dashboardSnapshot.brandAccounting:dashboardSnapshot.brands);
      return;
    }
    const productMonth=event.target.closest(".product-month");
    if(productMonth){
      const monthIndex=monthFromText(productMonth.querySelector(":scope > strong")?.textContent);
      if(monthIndex<0)return;
      const chart=productMonth.closest(".product-detail-chart");
      chart?.querySelectorAll(".product-month.is-month-detail-selected").forEach(node=>node.classList.remove("is-month-detail-selected"));
      productMonth.classList.add("is-month-detail-selected");
      const selected=document.querySelector(".report-brand-select")?.value?.trim()||"";
      const inventory=chart?.previousElementSibling?.classList.contains("product-accounting-heading");
      const source=inventory?dashboardSnapshot.productAccounting:dashboardSnapshot.products;
      const rows=(source||[]).filter(row=>brandOf(row.name)===selected);
      renderMonthDetail(chart,monthIndex,inventory?`${selected} 품목별 재고매출 상세 내역`:`${selected} 품목별 GMV 상세 내역`,rows);
    }
  };

  const ensureEventSpendStyles = () => {
    if (document.getElementById("event-spend-live-style")) return;
    const style = document.createElement("style");
    style.id = "event-spend-live-style";
    style.textContent = `
      .event-spend-panel>.panel-heading{order:1}
      .event-spend-panel>.event-live-wrap{order:2!important;margin:8px 0 18px}
      .event-spend-panel>.unit{order:3!important}
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

  const normalizeAugustAsActual = () => {
    if (!document.getElementById("august-actual-style")) {
      const style = document.createElement("style");
      style.id = "august-actual-style";
      style.textContent = `
        .brand-chart-guide>span,.hero-panel>.gmv-chart-guide>span{font-size:0!important}
        .brand-chart-guide>span::after{content:"9~12월 예상: 노란색 · 숫자: 선택 브랜드 월별 수치";font-size:10px}
        .hero-panel>.gmv-chart-guide>span::after{content:"막대: GMV · 선: 비율(%) · 9~12월 예상";font-size:10px}
      `;
      document.head.append(style);
    }
    const brandColors = {
      "아메리칸솔루션": "#2867f0",
      "캐네디언샌드": "#3ab6d7",
      "더스트몬": "#174ea6",
      "잘싸모래": "#dc5963",
      "클레버메이트": "#7657d6",
      "브리젠 파테": "#e49a28",
      "포우리패드": "#14916f",
    };

    document.querySelectorAll(".brand-month").forEach(month => {
      if (month.querySelector(":scope > span")?.textContent?.trim() !== "8월") return;
      month.classList.remove("forecast-brand-month");
      month.querySelectorAll(":scope > button").forEach(button => {
        const title = button.getAttribute("title") || button.getAttribute("aria-label") || "";
        const brand = Object.keys(brandColors).find(name => title.includes(name));
        if (brand) button.style.background = brandColors[brand];
      });
    });

    document.querySelectorAll(".spend-column").forEach(column => {
      if (column.querySelector(":scope > span:last-child")?.textContent?.trim() !== "8월") return;
      column.classList.remove("forecast-column");
      column.classList.add("actual-column");
      const period = column.querySelector(":scope > .period-mini");
      if (period) period.textContent = "실적";
    });

    document.querySelectorAll(".sales-month").forEach(month => {
      if (month.querySelector(".sales-month-title strong")?.textContent?.trim() !== "8월") return;
      month.classList.remove("forecast-block");
      month.classList.add("actual-block");
      const period = month.querySelector(".sales-month-title span");
      if (period) period.textContent = "실적";
    });

    document.querySelectorAll(".accounting-month").forEach(month => {
      if (month.querySelector(":scope > strong")?.textContent?.trim() !== "8월") return;
      month.querySelectorAll(".forecast").forEach(node => {
        node.classList.remove("forecast");
        node.classList.add("actual");
      });
      const rocket = month.querySelector(".accounting-stack > i");
      const wing = month.querySelector(".accounting-stack > em");
      if (rocket) rocket.style.background = "#2867f0";
      if (wing) wing.style.background = "#9fc0ff";
    });

    document.querySelectorAll("svg .month-axis-label").forEach(label => {
      if (label.textContent?.trim() !== "8월") return;
      const group = label.closest("g");
      if (!group) return;
      group.querySelectorAll(".gmv-target-forecast-bg").forEach(node => {
        node.classList.remove("gmv-target-forecast-bg");
        node.classList.add("gmv-target-actual-bg");
      });
      group.querySelectorAll(".bar-forecast").forEach(node => {
        const wing = node.classList.contains("wing-forecast");
        node.classList.remove("bar-forecast", "wing-forecast");
        node.classList.add(wing ? "bar-wing" : "bar-rocket");
      });
    });

    document.querySelectorAll(".unit, .brand-chart-guide span, .gmv-chart-guide span").forEach(node => {
      if (node.textContent?.includes("8~12월 예상")) {
        node.textContent = node.textContent.replaceAll("8~12월 예상", "9~12월 예상");
      }
    });
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
    ensureStaticPreviewBadge(); moveOperations(); ensureAdSection(); ensureBudgetPlans(); ensureEventSpendPanel(); normalizeAugustAsActual(); ensureRefreshMode();
  };
  window.addEventListener("load", () => setTimeout(apply, 1800), {once:true});
  document.addEventListener("change", event => {
    if (event.target.matches(".report-brand-select")) { clearMonthDetails(); setTimeout(apply, 400); }
    if (event.target.matches(".range-filter select")) { clearMonthDetails(); setTimeout(apply, 450); }
  });
  document.addEventListener("click", event => { handleChartMonthClick(event); setTimeout(apply, 400); });
})();
