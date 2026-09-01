"use client";

import { useEffect } from "react";

type MarketingOperations = {
  summaries?: string[];
  plans?: string[];
};

export default function MarketingOperationsFix() {
  useEffect(() => {
    let data: MarketingOperations | null = null;
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

    const render = () => {
      if (!data || !frame?.contentDocument) return;
      const doc = frame.contentDocument;
      const grid = doc.querySelector<HTMLElement>(".hero-panel > .operation-plan-grid");
      if (!grid) return;

      const summaries = Array.isArray(data.summaries) ? data.summaries : [];
      const plans = Array.isArray(data.plans) ? data.plans : [];
      const index = selectedIndexes(doc)
        .filter(monthIndex => String(summaries[monthIndex] || plans[monthIndex] || "").trim())
        .at(-1);

      const summaryLines = index === undefined ? ["선택 기간에 입력된 운영요약이 없습니다."] : (lines(summaries[index]).length ? lines(summaries[index]) : ["운영요약 입력 대기"]);
      const planLines = index === undefined ? ["선택 기간에 입력된 향후계획이 없습니다."] : (lines(plans[index]).length ? lines(plans[index]) : ["향후계획 입력 대기"]);
      const signature = JSON.stringify([index, summaryLines, planLines]);
      if (grid.dataset.marketingSheetSignature === signature) return;
      grid.dataset.marketingSheetSignature = signature;

      const column = (label: string, values: string[], tone: string) =>
        `<article class="${tone}"><div><strong>${label}</strong><span>시트 입력값</span></div>${values.map(value => `<p>${value}</p>`).join("")}</article>`;
      grid.innerHTML = column("운영요약", summaryLines, "summary") + column("향후계획", planLines, "plan");
    };

    const attach = () => {
      frame = document.querySelector<HTMLIFrameElement>(".dashboard-frame");
      const doc = frame?.contentDocument;
      if (!frame || !doc?.body) return false;

      const queueRender = () => setTimeout(render, 80);
      doc.addEventListener("change", queueRender, true);
      doc.addEventListener("click", queueRender, true);
      observer?.disconnect();
      observer = new MutationObserver(() => render());
      observer.observe(doc.body, { childList: true, subtree: true });
      render();
      return true;
    };

    fetch("/api/marketing-operations", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("marketing operations")))
      .then(payload => {
        data = payload;
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
