"use client";

import { ReactNode, useEffect } from "react";

export default function Template({ children }: { children: ReactNode }) {
  useEffect(() => {
    let innerObserver: MutationObserver | null = null;
    let outerObserver: MutationObserver | null = null;
    let frame: HTMLIFrameElement | null = null;

    const apply = () => {
      const doc = frame?.contentDocument;
      if (!doc?.body) return;

      if (!doc.getElementById("value-table-position-fix")) {
        const style = doc.createElement("style");
        style.id = "value-table-position-fix";
        style.textContent = `
          .gmv-target-panel,
          .hero-panel,
          .budget-panel,
          .monthly-chart-grid .spend-panel:not(.event-spend-panel){display:flex!important;flex-direction:column!important}
          .gmv-target-panel > #exact-monthly-gmv,
          .hero-panel > #exact-marketing-ratio,
          .budget-panel > #exact-budget-values,
          .monthly-chart-grid .spend-panel:not(.event-spend-panel) > #exact-monthly-spend{order:999!important}

          .brand-trend-panel{display:flex!important;flex-direction:column!important}
          .brand-trend-panel > .panel-heading{order:1}
          .brand-trend-panel > .brand-filter-toolbar{order:2}
          .brand-trend-panel > .operation-plan-grid{order:3}
          .brand-trend-panel > .brand-chart-guide{order:4}
          .brand-trend-panel > .brand-chart{order:5}
          .brand-trend-panel > .brand-chart-legend{order:6}
          .brand-trend-panel > #exact-brand-gmv{order:7!important}
          .brand-trend-panel > .brand-accounting-block{order:8}
          .brand-trend-panel > .brand-detail{order:9}
          .brand-trend-panel > .ad-performance-summary{order:10}
          .brand-trend-panel > .all-products-overview{order:11}

          .brand-accounting-block{display:flex!important;flex-direction:column!important}
          .brand-accounting-block > .brand-accounting-heading{order:1}
          .brand-accounting-block > .brand-chart-guide{order:2}
          .brand-accounting-block > .brand-chart{order:3}
          .brand-accounting-block > .brand-chart-legend{order:4}
          .brand-accounting-block > #exact-brand-inventory{order:5!important}

          main > section.panel:has(.accounting-detail){display:flex!important;flex-direction:column!important}
          main > section.panel:has(.accounting-detail) > #exact-accounting{order:999!important}

          #exact-event-spend{display:none!important}
        `;
        doc.head.appendChild(style);
      }

      doc.getElementById("exact-event-spend")?.remove();
      doc.querySelectorAll<HTMLElement>(".exact-values-head strong").forEach((node) => {
        const current = node.textContent || "";
        const next = current.replaceAll("정확 수치", "수치");
        if (next !== current) node.textContent = next;
      });
    };

    const connectFrame = () => {
      frame = document.querySelector<HTMLIFrameElement>(".dashboard-frame");
      if (!frame) return;
      const install = () => {
        apply();
        innerObserver?.disconnect();
        const doc = frame?.contentDocument;
        if (!doc?.body) return;
        let queued = false;
        innerObserver = new MutationObserver(() => {
          if (queued) return;
          queued = true;
          requestAnimationFrame(() => {
            queued = false;
            apply();
          });
        });
        innerObserver.observe(doc.body, { childList: true, subtree: true, characterData: true });
      };
      frame.addEventListener("load", install);
      if (frame.contentDocument?.readyState === "complete") install();
    };

    connectFrame();
    outerObserver = new MutationObserver(() => {
      if (!frame || !document.contains(frame)) connectFrame();
    });
    outerObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      innerObserver?.disconnect();
      outerObserver?.disconnect();
    };
  }, []);

  return children;
}
