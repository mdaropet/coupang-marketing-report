"use client";

import { useEffect, useRef } from "react";

export default function Home() {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let observer: MutationObserver | null = null;

    const install = () => {
      const doc = frame.contentDocument;
      if (!doc?.body) return;

      const placeEventDetailBelowTitle = () => {
        const panel = doc.querySelector(".event-spend-panel");
        if (!panel) return;
        const heading = panel.querySelector(":scope > .panel-heading");
        const detail = panel.querySelector(":scope > .event-live-wrap") ||
          (panel.nextElementSibling?.classList.contains("event-live-wrap") ? panel.nextElementSibling : null);
        if (!heading || !detail) return;
        detail.classList.remove("event-live-outside");
        heading.insertAdjacentElement("afterend", detail);
      };

      const normalizeMonthlyOperationLabels = () => {
        doc.querySelectorAll(".operation-plan-monthly article > div > strong, .gmv-target-panel .operation-plan-grid article > div > strong").forEach(node => {
          const current = node.textContent?.trim() || "";
          const normalized = current
            .replace(/^\d{1,2}월\s*/, "")
            .replace("운영 요약", "운영요약")
            .replace("향후 계획", "향후계획");
          if (normalized && normalized !== current) node.textContent = normalized;
        });
      };

      const applyAdjustments = () => {
        placeEventDetailBelowTitle();
        normalizeMonthlyOperationLabels();
      };

      applyAdjustments();
      observer?.disconnect();
      observer = new MutationObserver(applyAdjustments);
      observer.observe(doc.body, { childList: true, subtree: true });
    };

    frame.addEventListener("load", install);
    if (frame.contentDocument?.readyState === "complete") install();

    return () => {
      frame.removeEventListener("load", install);
      observer?.disconnect();
    };
  }, []);

  return (
    <main className="dashboard-shell">
      <iframe
        ref={frameRef}
        className="dashboard-frame"
        src="/dashboard/report.html"
        title="쿠팡 성과 대시보드 정적 디자인 미리보기"
      />
    </main>
  );
}
