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

      if (!doc.getElementById("event-live-outside-style")) {
        const style = doc.createElement("style");
        style.id = "event-live-outside-style";
        style.textContent = `
          .event-live-wrap.event-live-outside{margin:14px 0 22px;padding:22px 24px;border:1px solid #dfe7f1;border-radius:16px;background:#fff;box-shadow:0 7px 18px rgba(16,32,61,.04)}
          .event-live-wrap.event-live-outside .event-live-list{display:grid;gap:10px;margin-top:0}
          .event-live-wrap.event-live-outside .event-live-row{display:grid;grid-template-columns:150px minmax(0,1fr) 90px;align-items:center;gap:12px}
          .event-live-wrap.event-live-outside .event-live-name{color:#526176;font-size:11px;font-weight:850}
          .event-live-wrap.event-live-outside .event-live-track{height:22px;border-radius:7px;background:#edf1f6;overflow:hidden}
          .event-live-wrap.event-live-outside .event-live-bar{display:block;height:100%;min-width:2px;border-radius:7px;background:#2867f0}
          .event-live-wrap.event-live-outside .event-live-value{text-align:right;color:#10203d;font-size:11px;font-weight:900;font-variant-numeric:tabular-nums}
          .event-live-wrap.event-live-outside .event-live-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;padding:11px 13px;border:1px solid #dfe7f1;border-radius:10px;background:#f8faff}
          .event-live-wrap.event-live-outside .event-live-summary span{color:#718096;font-size:10px;font-weight:800}
          .event-live-wrap.event-live-outside .event-live-summary strong{color:#205ac9;font-size:14px}
          @media(max-width:760px){.event-live-wrap.event-live-outside .event-live-row{grid-template-columns:110px minmax(0,1fr) 76px}.event-live-wrap.event-live-outside .event-live-name,.event-live-wrap.event-live-outside .event-live-value{font-size:9px}}
        `;
        doc.head.appendChild(style);
      }

      const moveEventDetail = () => {
        const panel = doc.querySelector(".event-spend-panel");
        if (!panel) return;
        const inside = panel.querySelector(".event-live-wrap");
        if (inside) {
          inside.classList.add("event-live-outside");
          panel.insertAdjacentElement("afterend", inside);
          return;
        }
        const next = panel.nextElementSibling;
        if (next?.classList.contains("event-live-wrap")) next.classList.add("event-live-outside");
      };

      moveEventDetail();
      observer?.disconnect();
      observer = new MutationObserver(moveEventDetail);
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
