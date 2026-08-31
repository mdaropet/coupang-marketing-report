"use client";

import { useEffect } from "react";

export default function PreviewDashboardFix() {
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const attach = () => {
      const frame = document.querySelector<HTMLIFrameElement>(".dashboard-frame");
      const doc = frame?.contentDocument;
      if (!frame || !doc?.body) return false;

      let queued = false;
      const apply = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;

          // Never override the dashboard's native tab display logic.
          doc.getElementById("value-table-position-fix")?.remove();
          doc.getElementById("preview-tab-visibility-fix")?.remove();

          // Sales-deduction page intentionally has no numeric table.
          doc.getElementById("exact-event-spend")?.remove();

          // Use the requested simple label: "수치".
          doc.querySelectorAll<HTMLElement>(".exact-values-head strong").forEach((node) => {
            const current = node.textContent || "";
            const next = current.replaceAll("정확 수치", "수치");
            if (next !== current) node.textContent = next;
          });

          // Move each table in the DOM to immediately after its actual graph/visual.
          const monthly = doc.querySelector<HTMLElement>(".gmv-target-panel");
          const brand = doc.querySelector<HTMLElement>(".brand-trend-panel");
          const ratio = doc.querySelector<HTMLElement>(".hero-panel");
          const budget = doc.querySelector<HTMLElement>(".budget-panel");
          const spend = doc.querySelector<HTMLElement>(".monthly-chart-grid .spend-panel:not(.event-spend-panel)");
          const accounting = [...doc.querySelectorAll<HTMLElement>("main > section.panel")].find(
            (section) => section.querySelector("h2")?.textContent?.trim() === "쿠팡 회계매출 세부내역",
          );

          const anchors: Array<[string, Element | null]> = [
            ["exact-monthly-gmv", monthly?.querySelector(":scope > .chart-scroll") || null],
            ["exact-brand-gmv", brand?.querySelector(":scope > .brand-chart") || null],
            ["exact-brand-inventory", brand?.querySelector(".brand-accounting-block > .brand-chart") || null],
            ["exact-marketing-ratio", ratio?.querySelector(":scope > .chart-scroll") || null],
            ["exact-budget-values", budget?.querySelector(":scope > .budget-list") || null],
            ["exact-monthly-spend", spend?.querySelector(".marketing-spend-bars") || null],
            ["exact-accounting", accounting?.querySelector(".accounting-detail") || null],
          ];

          const detail = brand?.querySelector(".brand-detail");
          const productCharts = detail ? [...detail.querySelectorAll(".product-detail-chart")] : [];
          anchors.push(
            ["exact-item-gmv", productCharts[0] || detail?.querySelector(".product-chart") || null],
            ["exact-item-inventory", productCharts[1] || productCharts[0] || detail?.querySelector(".product-chart") || null],
          );

          for (const [id, anchor] of anchors) {
            const table = doc.getElementById(id);
            if (!table || !anchor) continue;
            if (table.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", table);
          }
        });
      };

      const onClick = () => setTimeout(apply, 100);
      const onChange = () => setTimeout(apply, 140);
      doc.addEventListener("click", onClick, true);
      doc.addEventListener("change", onChange, true);
      const observer = new MutationObserver(apply);
      observer.observe(doc.body, { childList: true, subtree: true });
      apply();

      cleanup = () => {
        doc.removeEventListener("click", onClick, true);
        doc.removeEventListener("change", onChange, true);
        observer.disconnect();
      };
      return true;
    };

    if (!attach()) {
      timer = setInterval(() => {
        if (attach() && timer) {
          clearInterval(timer);
          timer = null;
        }
      }, 300);
    }

    return () => {
      if (timer) clearInterval(timer);
      cleanup?.();
    };
  }, []);

  return null;
}
