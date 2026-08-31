"use client";

import { useEffect } from "react";

export default function BrandSelectionSafetyFix() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const stabilize = () => {
      try {
        const frame = document.querySelector<HTMLIFrameElement>(".dashboard-frame");
        const doc = frame?.contentDocument;
        if (!doc?.body) return;
        const panel = doc.querySelector<HTMLElement>(".brand-trend-panel");
        const select = doc.querySelector<HTMLSelectElement>(".report-brand-select");
        const detail = panel?.querySelector<HTMLElement>(".brand-detail");
        if (!panel || !select || !detail || !panel.classList.contains("report-item-summary")) return;

        const brand = select.value.trim();
        if (!brand || brand.includes("전체")) return;

        const validValues = [...select.options].map(option => option.value.trim()).filter(Boolean);
        if (!validValues.includes(brand)) return;

        const gmvHeading = detail.querySelector<HTMLElement>(":scope > .panel-heading h3");
        const inventoryHeading = detail.querySelector<HTMLElement>(".product-accounting-heading h3");
        if (gmvHeading && !gmvHeading.textContent?.trim().startsWith(brand)) {
          gmvHeading.textContent = `${brand} 품목별 GMV`;
        }
        if (inventoryHeading && !inventoryHeading.textContent?.trim().startsWith(brand)) {
          inventoryHeading.textContent = `${brand} 품목별 재고매출`;
        }

        detail.style.removeProperty("display");
        detail.removeAttribute("aria-hidden");
      } catch {
        // 선택 안정화 실패가 보고서 화면을 막지 않도록 격리합니다.
      }
    };

    stabilize();
    timer = setInterval(stabilize, 250);
    return () => { if (timer) clearInterval(timer); };
  }, []);

  return null;
}
