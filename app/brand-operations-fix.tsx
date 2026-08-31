"use client";

import { useEffect } from "react";

type BrandData = Record<string, { summaries?: string[]; plans?: string[] }>;

export default function BrandOperationsFix() {
  useEffect(() => {
    let data: BrandData = {};
    let frame: HTMLIFrameElement | null = null;
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const lines = (value: unknown) => String(value || "")
      .replace(/^"|"$/g, "")
      .split(/\r?\n/)
      .map(line => line.replace(/\t+$/g, "").trim())
      .filter(Boolean);

    const selectedIndexes = (doc: Document) => {
      const selects = [...doc.querySelectorAll<HTMLSelectElement>(".range-filter select")];
      const start = Number(selects[0]?.value ?? 0);
      const end = Number(selects[1]?.value ?? 11);
      return Array.from({ length: Math.max(0, end - start + 1) }, (_, offset) => start + offset);
    };

    const selectedBrand = (doc: Document) => {
      const selectValue = doc.querySelector<HTMLSelectElement>(".report-brand-select")?.value?.trim() || "";
      if (selectValue && !selectValue.includes("전체") && data[selectValue]) return selectValue;

      const candidates = [...doc.querySelectorAll<HTMLElement>(".brand-chart button[aria-pressed='true'], .brand-chart button.active, .brand-filter-toolbar button[aria-pressed='true'], .brand-filter-toolbar button.active")];
      for (const candidate of candidates) {
        const text = candidate.textContent?.trim() || "";
        const key = Object.keys(data).find(name => name !== "전체" && text.includes(name));
        if (key) return key;
      }
      return "전체";
    };

    const render = () => {
      if (!frame?.contentDocument) return;
      const doc = frame.contentDocument;
      const grid = doc.querySelector<HTMLElement>(".brand-trend-panel > .operation-plan-grid");
      if (!grid) return;

      const brand = selectedBrand(doc);
      const block = data[brand] || data["전체"];
      if (!block) return;
      const summaries = Array.isArray(block.summaries) ? block.summaries : [];
      const plans = Array.isArray(block.plans) ? block.plans : [];
      const index = selectedIndexes(doc)
        .filter(monthIndex => String(summaries[monthIndex] || plans[monthIndex] || "").trim())
        .at(-1);

      const summaryLines = index === undefined ? ["선택 기간에 입력된 운영요약이 없습니다."] : (lines(summaries[index]).length ? lines(summaries[index]) : ["운영요약 입력 대기"]);
      const planLines = index === undefined ? ["선택 기간에 입력된 향후계획이 없습니다."] : (lines(plans[index]).length ? lines(plans[index]) : ["향후계획 입력 대기"]);
      const signature = JSON.stringify([brand, index, summaryLines, planLines]);
      if (grid.dataset.brandSheetSignature === signature) return;
      grid.dataset.brandSheetSignature = signature;

      const column = (label: string, values: string[], tone: string) =>
        `<article class="${tone}"><div><strong>${label}</strong><span>${brand} · 시트 입력값</span></div>${values.map(value => `<p>${value}</p>`).join("")}</article>`;
      grid.innerHTML = column("운영 요약", summaryLines, "summary") + column("향후 계획", planLines, "plan");
    };

    const attach = () => {
      frame = document.querySelector<HTMLIFrameElement>(".dashboard-frame");
      const doc = frame?.contentDocument;
      if (!frame || !doc?.body) return false;
      const queueRender = () => setTimeout(render, 100);
      doc.addEventListener("change", queueRender, true);
      doc.addEventListener("click", queueRender, true);
      observer?.disconnect();
      observer = new MutationObserver(() => render());
      observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed", "class"] });
      render();
      return true;
    };

    fetch("/api/brand-operations", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("brand operations")))
      .then(payload => {
        data = payload?.brands || {};
        if (!attach()) {
          timer = setInterval(() => {
            if (attach() && timer) {
              clearInterval(timer);
              timer = null;
            }
          }, 300);
        }
      })
      .catch(() => {});

    return () => {
      if (timer) clearInterval(timer);
      observer?.disconnect();
    };
  }, []);

  return null;
}
