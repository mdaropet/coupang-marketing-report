"use client";

import { useEffect } from "react";

export default function AdPerformanceFix() {
  useEffect(() => {
    let frame: HTMLIFrameElement | null = null;
    let attachTimer: ReturnType<typeof setInterval> | null = null;
    let frameLoadHandler: (() => void) | null = null;

    const hideAdDashboards = () => {
      const doc = frame?.contentDocument;
      if (!doc?.head || !doc.body) return;

      let style = doc.getElementById("hide-all-brand-ad-performance") as HTMLStyleElement | null;
      if (!style) {
        style = doc.createElement("style");
        style.id = "hide-all-brand-ad-performance";
        style.textContent = `
          .brand-trend-panel .safe-ad-ops,
          .brand-trend-panel .custom-ad-ops,
          .brand-trend-panel .ad-performance-summary,
          .brand-trend-panel .ad-performance-inline,
          .brand-trend-panel .report-ad-clean,
          .brand-trend-panel [class*="ad-performance"] {
            display: none !important;
          }
        `;
        doc.head.appendChild(style);
      }

      doc.querySelectorAll<HTMLElement>(
        ".brand-trend-panel .safe-ad-ops, .brand-trend-panel .custom-ad-ops"
      ).forEach(node => node.remove());
    };

    const attach = () => {
      frame = document.querySelector<HTMLIFrameElement>(".dashboard-frame");
      const doc = frame?.contentDocument;
      if (!frame || !doc?.body) return false;

      if (!frameLoadHandler) {
        frameLoadHandler = () => window.setTimeout(hideAdDashboards, 300);
        frame.addEventListener("load", frameLoadHandler);
      }

      hideAdDashboards();
      window.setTimeout(hideAdDashboards, 600);
      return true;
    };

    if (!attach()) {
      attachTimer = setInterval(() => {
        if (attach() && attachTimer) {
          clearInterval(attachTimer);
          attachTimer = null;
        }
      }, 300);
    }

    return () => {
      if (attachTimer) clearInterval(attachTimer);
      if (frame && frameLoadHandler) frame.removeEventListener("load", frameLoadHandler);
    };
  }, []);

  return null;
}
