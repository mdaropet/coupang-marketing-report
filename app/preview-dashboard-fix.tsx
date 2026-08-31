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

      let applying = false;
      const apply = () => {
        if (applying) return;
        applying = true;
        requestAnimationFrame(() => {
          const active = doc.querySelector<HTMLElement>(".report-tab[aria-selected='true']")?.dataset.tab || "monthly-gmv";
          const monthly = doc.querySelector<HTMLElement>(".gmv-target-panel");
          const brand = doc.querySelector<HTMLElement>(".brand-trend-panel");
          const ratio = doc.querySelector<HTMLElement>(".hero-panel");
          const budget = doc.querySelector<HTMLElement>(".budget-panel");
          const monthlyGrid = doc.querySelector<HTMLElement>(".monthly-chart-grid");
          const spend = doc.querySelector<HTMLElement>(".monthly-chart-grid .spend-panel:not(.event-spend-panel)");
          const event = doc.querySelector<HTMLElement>(".event-spend-panel");
          const eventOutside = doc.querySelector<HTMLElement>(".event-live-wrap.event-live-outside");
          const accounting = [...doc.querySelectorAll<HTMLElement>("main > section.panel")].find(section => section.querySelector("h2")?.textContent?.trim() === "쿠팡 회계매출 세부내역");

          const setVisible = (node: HTMLElement | undefined | null, visible: boolean) => {
            if (!node) return;
            const next = visible ? "" : "none";
            if (node.style.display !== next) node.style.display = next;
          };

          setVisible(monthly, active === "monthly-gmv");
          setVisible(brand, active === "brand-summary" || active === "item-summary");
          setVisible(ratio, active === "marketing-ratio");
          setVisible(budget, active === "budget");
          setVisible(monthlyGrid, active === "monthly-spend" || active === "sales-deduction");
          setVisible(accounting, active === "accounting-detail");
          setVisible(spend, active === "monthly-spend");
          setVisible(event, active === "sales-deduction");
          setVisible(eventOutside, active === "sales-deduction");

          doc.getElementById("exact-event-spend")?.remove();
          doc.querySelectorAll<HTMLElement>(".exact-values-head strong").forEach(node => {
            const current = node.textContent || "";
            const next = current.replaceAll("정확 수치", "수치");
            if (current !== next) node.textContent = next;
          });

          const anchors: Array<[string, Element | null]> = [
            ["exact-monthly-gmv", monthly?.querySelector(":scope > .chart-scroll") || null],
            ["exact-brand-gmv", brand?.querySelector(":scope > .brand-chart") || null],
            ["exact-brand-inventory", brand?.querySelector(".brand-accounting-block > .brand-chart") || null],
            ["exact-marketing-ratio", ratio?.querySelector(":scope > .chart-scroll") || null],
            ["exact-budget-values", budget?.querySelector(":scope > .budget-list") || null],
            ["exact-monthly-spend", spend?.querySelector(".marketing-spend-bars") || null],
            ["exact-accounting", accounting?.querySelector(".accounting-detail") || null],
          ];
          for (const [id, anchor] of anchors) {
            const table = doc.getElementById(id);
            if (table && anchor && table.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", table);
          }

          applying = false;
        });
      };

      const onClick = () => setTimeout(apply, 80);
      const onChange = () => setTimeout(apply, 120);
      doc.addEventListener("click", onClick, true);
      doc.addEventListener("change", onChange, true);
      const observer = new MutationObserver(apply);
      observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
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
