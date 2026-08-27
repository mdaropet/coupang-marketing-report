const dashboardNativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input?.url || "";
  if (url.includes("/api/dashboard-data")) {
    return Promise.resolve(new Response(JSON.stringify({ data: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  }
  return dashboardNativeFetch(input, init);
};

(() => {
  const ensureStaticPreviewBadge = () => {
    const actions = document.querySelector(".topbar-actions");
    if (!actions || actions.querySelector(".static-preview-badge")) return;
    const badge = document.createElement("div");
    badge.className = "static-preview-badge";
    badge.innerHTML = "<strong>디자인 미리보기</strong><span>구글 시트 미연동 · 예시값</span>";
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
  const ensureOperationPlan = (panel, type) => {
    if (!panel || panel.querySelector(":scope > .operation-plan-grid")) return;
    panel.querySelectorAll(":scope > .operation-detail-card").forEach(node=>node.remove());
    const grid=document.createElement("section");
    grid.className=`operation-plan-grid operation-plan-${type}`;
    const column=(label,lines,tone)=>`<article class="${tone}"><div><strong>${label}</strong><span>최대 3줄 입력</span></div>${lines.map(line=>`<p>${line}</p>`).join("")}</article>`;
    grid.innerHTML=column("운영 요약",operationCopy[type],"summary")+column("향후 계획",planCopy[type],"plan");
    const before=panel.querySelector(":scope > .gmv-chart-guide, :scope > .brand-chart-guide, :scope > .marketing-operations-top, :scope > .brand-operations-top, :scope > .chart-scroll");
    before ? before.insertAdjacentElement("beforebegin",grid) : panel.prepend(grid);
  };
  const moveOperations = () => {
    ensureOperationPlan(document.querySelector(".gmv-target-panel"),"monthly");
    ensureOperationPlan(document.querySelector(".brand-trend-panel"),"brand");
    ensureOperationPlan(document.querySelector(".hero-panel"),"marketing");
  };

  const adRows = [
    {month:"4월", spend:2049400, revenue:11271700, conversion:8.6, rohs:550},
    {month:"5월", spend:2040910, revenue:12551600, conversion:8.9, rohs:615},
    {month:"6월", spend:2450740, revenue:11317800, conversion:6.7, rohs:462},
    {month:"7월", spend:2346000, revenue:14779800, conversion:8.4, rohs:630}
  ];
  const won = value => new Intl.NumberFormat("ko-KR").format(value) + "원";
  const adChart = () => {
    const maxMoney = Math.max(...adRows.flatMap(d => [d.spend, d.revenue]));
    const xs = [105,245,385,525], base=210, top=28, h=base-top;
    const bars = adRows.map((d,i) => {
      const rh=d.revenue/maxMoney*h, sh=d.spend/maxMoney*h, x=xs[i];
      return `<rect x="${x-36}" y="${base-rh}" width="30" height="${rh}" rx="4" fill="#2867f0"/><rect x="${x+6}" y="${base-sh}" width="30" height="${sh}" rx="4" fill="#a9bddc"/><text x="${x-21}" y="${base-rh-6}" text-anchor="middle" font-size="9" font-weight="900" fill="#205ac9">${Math.round(d.revenue/10000)}만</text><text x="${x+21}" y="${base-sh-6}" text-anchor="middle" font-size="9" font-weight="900" fill="#66748a">${Math.round(d.spend/10000)}만</text><text x="${x}" y="230" text-anchor="middle" font-size="10" font-weight="850" fill="#526176">${d.month}</text>`;
    }).join("");
    const miniLine = (key,color,label,digits=0) => {
      const values=adRows.map(d=>d[key]), low=Math.min(...values), high=Math.max(...values), pad=Math.max((high-low)*.42, key==="conversion"?.65:48), min=Math.max(0,low-pad), max=high+pad;
      const miniXs=[48,136,224,312], top=32, bottom=112, height=bottom-top;
      const points=adRows.map((d,i)=>({x:miniXs[i],y:bottom-((d[key]-min)/(max-min))*height,value:d[key]}));
      const latest=values.at(-1), change=latest-values[0];
      return `<div class="custom-rate-card" style="--rate-color:${color}"><div class="custom-rate-head"><div><span>${label}</span><strong>${latest.toFixed(digits)}%</strong></div><b>${change>=0?"▲":"▼"} ${Math.abs(change).toFixed(digits)}${key==="conversion"?"%p":"%"}</b></div><svg viewBox="0 0 360 145" role="img" aria-label="${label} 월별 추이"><line x1="34" y1="112" x2="326" y2="112" stroke="#e7edf5"/><line x1="34" y1="32" x2="326" y2="32" stroke="#eef2f7" stroke-dasharray="4 4"/><polyline points="${points.map(p=>`${p.x},${p.y}`).join(" ")}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${points.map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="5" fill="#fff" stroke="${color}" stroke-width="3"/><text x="${p.x}" y="${Math.max(18,p.y-10)}" text-anchor="middle" font-size="11" font-weight="900" fill="${color}">${p.value.toFixed(digits)}%</text><text x="${p.x}" y="134" text-anchor="middle" font-size="10" font-weight="850" fill="#526176">${adRows[i].month}</text>`).join("")}</svg></div>`;
    };
    return `<div class="custom-ad-grid"><div class="custom-ad-card"><div class="custom-chart-title"><h4>광고비 대비 전환매출 추이</h4><span><i></i>전환매출 <i></i>광고비</span></div><svg viewBox="0 0 620 245"><line x1="50" y1="210" x2="580" y2="210" stroke="#e7edf5"/>${bars}</svg></div><div class="custom-rate-stack">${miniLine("conversion","#10936d","전환율",1)}${miniLine("rohs","#c74455","ROHS",0)}</div></div>`;
  };

  const ensureAdSection = () => {
    const detail = document.querySelector(".brand-trend-panel .brand-detail");
    if (!detail) return;
    let section = detail.querySelector(".custom-ad-ops");
    if (!section) {
      section = document.createElement("section");
      section.className = "custom-ad-ops";
      const latest=adRows.at(-1);
      section.innerHTML = `<div class="custom-ad-head"><div><p>JALSSA AD PERFORMANCE</p><h3>잘싸모래 광고 운영 성과</h3></div><span>광고비·전환율·전환매출·ROHS 월별 추이</span></div><div class="custom-ad-kpis"><article><span>7월 광고비</span><strong>${won(latest.spend)}</strong></article><article><span>7월 전환매출</span><strong>${won(latest.revenue)}</strong></article><article><span>7월 전환율</span><strong>${latest.conversion.toFixed(1)}%</strong></article><article><span>7월 ROHS</span><strong>${latest.rohs}%</strong></article></div>${adChart()}<div class="custom-ad-table-wrap"><table class="custom-ad-table"><thead><tr><th>월</th><th>광고비</th><th>전환매출</th><th>전환율</th><th>ROHS</th></tr></thead><tbody>${adRows.map(d=>`<tr><td>${d.month}</td><td>${won(d.spend)}</td><td>${won(d.revenue)}</td><td>${d.conversion.toFixed(1)}%</td><td>${d.rohs}%</td></tr>`).join("")}</tbody></table></div>`;
      detail.append(section);
    }
    const selected=document.querySelector(".report-brand-select")?.value || "";
    section.classList.toggle("is-visible", selected === "잘싸모래");
  };

  const number = value => Number(String(value || "0").replace(/[^\d.-]/g, "")) || 0;
  const format = value => new Intl.NumberFormat("ko-KR").format(value);
  const parseSegment = node => {
    const title = node.getAttribute("title") || node.getAttribute("aria-label") || "";
    const match = title.match(/^(?:\d+월\s+)?(.+?)\s+(?:GMV\s+|재고매출\s+|회계매출\s+)?([\d,]+)천원/);
    return match ? { name: match[1].trim(), value: number(match[2]) } : null;
  };
  const selectedMonthIndex = () => {
    const selects=[...document.querySelectorAll(".range-filter select")];
    return selects.length>1 && selects[0].value===selects[1].value ? Number(selects[0].value) : -1;
  };
  const detailMarkup = (rows, months) => {
    const index=selectedMonthIndex();
    if(index<0 || index>=months.length) return "";
    const detailRows=rows.filter(row=>!row.name.includes("목표"));
    const totalRow=detailRows.find(row=>row.name.includes("총"));
    const monthTotal=totalRow?.values[index]||detailRows.reduce((sum,row)=>sum+(row.values[index]||0),0);
    return `<div class="selected-month-detail"><div class="selected-detail-title"><strong>${months[index]} 상세 내역</strong><span>선택 월 기준 · 단위: 천원</span></div><table><thead><tr><th>구분</th><th>매출</th><th>구성비</th><th>전월 매출</th><th>전월 대비</th></tr></thead><tbody>${detailRows.map(row=>{const current=row.values[index]||0,prev=index?row.values[index-1]||0:0,change=prev?(current-prev)/prev*100:null;return `<tr><th>${row.name}</th><td>${format(current)}</td><td>${monthTotal?(current/monthTotal*100).toFixed(1):"0.0"}%</td><td>${index?format(prev):"-"}</td><td class="${change===null?"":change>=0?"positive":"negative"}">${change===null?"-":`${change>=0?"▲":"▼"} ${Math.abs(change).toFixed(1)}%`}</td></tr>`}).join("")}</tbody></table></div>`;
  };
  const tableMarkup = (title, rows, months, footer=true) => {
    const totals = rows.map(row => row.values.reduce((sum, value) => sum + value, 0));
    const grandTotal = totals.reduce((sum, value) => sum + value, 0);
    return `<div class="numeric-table-heading"><div><span>MONTHLY DATA TABLE</span><strong>${title}</strong></div><em>단위: 천원 · 8~12월 예상</em></div>${detailMarkup(rows,months)}<div class="numeric-data-scroll"><table class="numeric-data-table"><thead><tr><th>구분</th>${months.map((month,index)=>`<th class="${index>6?"forecast-cell":""}">${month}</th>`).join("")}<th class="total-cell">합계</th></tr></thead><tbody>${rows.map((row,rowIndex)=>`<tr><th>${row.name}</th>${row.values.map((value,index)=>`<td class="${index>6?"forecast-cell":""}">${format(value)}</td>`).join("")}<td class="total-cell">${format(totals[rowIndex])}</td></tr>`).join("")}</tbody>${footer?`<tfoot><tr><th>월 합계</th>${months.map((_,index)=>`<td class="${index>6?"forecast-cell":""}">${format(rows.reduce((sum,row)=>sum+row.values[index],0))}</td>`).join("")}<td class="total-cell">${format(grandTotal)}</td></tr></tfoot>`:""}</table></div>`;
  };
  const ensureTableForChart = (chart, title, monthSelector, segmentSelector) => {
    if (!chart) return;
    const months = [...chart.querySelectorAll(monthSelector)];
    if (!months.length) return;
    const labels = months.map((month,index) => month.querySelector(":scope > span, :scope > strong:last-child")?.textContent.trim() || `${index+1}월`);
    const matrix = new Map();
    months.forEach((month,index) => {
      [...month.querySelectorAll(segmentSelector)].forEach(segment => {
        const parsed = parseSegment(segment);
        if (!parsed) return;
        if (!matrix.has(parsed.name)) matrix.set(parsed.name, Array(months.length).fill(0));
        matrix.get(parsed.name)[index] += parsed.value;
      });
    });
    const rows = [...matrix].map(([name,values]) => ({name,values})).filter(row => row.values.some(Boolean));
    if (!rows.length) return;
    const signature = JSON.stringify([rows,selectedMonthIndex()]);
    let block = chart.nextElementSibling?.classList.contains("numeric-data-block") ? chart.nextElementSibling : null;
    if (!block) {
      block = document.createElement("section");
      block.className = "numeric-data-block";
      chart.insertAdjacentElement("afterend", block);
    }
    if (block.dataset.signature === signature && block.dataset.title === title) return;
    block.dataset.signature = signature;
    block.dataset.title = title;
    block.innerHTML = tableMarkup(title, rows, labels);
  };
  const ensureNumericTables = () => {
    const monthlyPanel=document.querySelector(".gmv-target-panel"), monthlyChart=monthlyPanel?.querySelector(".gmv-target-chart"), monthlyAnchor=monthlyPanel?.querySelector(".chart-scroll");
    if(monthlyChart && monthlyAnchor){
      const values=selector=>[...monthlyChart.querySelectorAll(selector)].map(node=>number(node.textContent));
      const rows=[{name:"총 GMV",values:values(".gmv-actual-value")},{name:"로켓 GMV",values:values(".gmv-target-stack-label")},{name:"윙 GMV",values:values(".gmv-target-wing-label")},{name:"GMV 목표",values:values(".gmv-target-value")}].filter(row=>row.values.length===12);
      let block=monthlyAnchor.nextElementSibling?.classList.contains("numeric-data-block")?monthlyAnchor.nextElementSibling:null;
      if(!block){block=document.createElement("section");block.className="numeric-data-block monthly-gmv-table";monthlyAnchor.insertAdjacentElement("afterend",block)}
      const signature=JSON.stringify([rows,selectedMonthIndex()]);if(block.dataset.signature!==signature){block.dataset.signature=signature;block.innerHTML=tableMarkup("월별 GMV 실적 수치",rows,Array.from({length:12},(_,i)=>`${i+1}월`),false)}
    }
    const panel = document.querySelector(".brand-trend-panel");
    if (!panel) return;
    ensureTableForChart(panel.querySelector(":scope > .brand-chart"), "브랜드별 월간 GMV 수치", ":scope > .brand-month", ":scope > button");
    ensureTableForChart(panel.querySelector(".brand-accounting-block > .brand-chart"), "브랜드별 월간 재고매출 수치", ":scope > .brand-month", ":scope > button");
    const charts = [...panel.querySelectorAll(".brand-detail .product-bars")];
    ensureTableForChart(charts[0], "품목별 월간 GMV 수치", ":scope > .product-month", ".product-stack > i");
    ensureTableForChart(charts[1], "품목별 월간 재고매출 수치", ":scope > .product-month", ".product-stack > i");
  };

  const apply = () => {
    ensureStaticPreviewBadge(); moveOperations(); ensureAdSection();
  };
  window.addEventListener("load", () => setTimeout(apply, 1800), {once:true});
  document.addEventListener("change", event => { if (event.target.matches(".report-brand-select")) setTimeout(apply, 400); });
  document.addEventListener("click", () => setTimeout(apply, 400));
  new MutationObserver(() => requestAnimationFrame(apply)).observe(document.documentElement,{childList:true,subtree:true});
})();
