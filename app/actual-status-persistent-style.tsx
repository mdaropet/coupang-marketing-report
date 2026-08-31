"use client";

import { useEffect } from "react";

type DashboardPayload = { data?: { status?: string[] } };

export default function ActualStatusPersistentStyle() {
  useEffect(() => {
    let frame: HTMLIFrameElement | null = null;
    let loadHandler: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;
    let actualCount = 0;

    const buildCss = (count: number) => {
      if (count <= 0) return "";
      const palette = ["#174ea6", "#2867f0", "#4384dc", "#5b99e6", "#78adeb", "#9bc5f2"];
      const brandRules = palette.map((color, index) =>
        `.brand-chart .brand-month:nth-child(-n+${count}) > button:nth-of-type(${index + 1}){background:${color}!important;background-color:${color}!important}`
      ).join("\n");
      const productRules = palette.map((color, index) =>
        `.product-bars .product-month:nth-child(-n+${count}) > .product-stack > i:nth-child(${index + 1}){background:${color}!important;background-color:${color}!important}`
      ).join("\n");
      return `
${brandRules}
.brand-chart .brand-month:nth-child(-n+${count}) > i{background:#d6e5f7!important;background-color:#d6e5f7!important}
${productRules}
.product-bars .product-month:nth-child(-n+${count}) > .product-stack{background:transparent!important}
.product-bars .product-month:nth-child(-n+${count}) > .product-stack > i{background-color:#2867f0!important}
.product-bars .product-month:nth-child(-n+${count}) > strong{color:#111827!important}
`;
    };

    const install = () => {
      const doc = frame?.contentDocument;
      if (!doc?.head || actualCount <= 0) return;
      let style = doc.getElementById("actual-status-persistent-style") as HTMLStyleElement | null;
      if (!style) {
        style = doc.createElement("style");
        style.id = "actual-status-persistent-style";
        doc.head.appendChild(style);
      }
      style.textContent = buildCss(actualCount);
    };

    const attach = () => {
      frame = document.querySelector<HTMLIFrameElement>(".dashboard-frame");
      if (!frame) return false;
      if (!loadHandler) {
        loadHandler = () => {
          install();
          window.setTimeout(install, 300);
          window.setTimeout(install, 900);
        };
        frame.addEventListener("load", loadHandler);
      }
      install();
      window.setTimeout(install, 300);
      window.setTimeout(install, 900);
      return Boolean(frame.contentDocument?.head);
    };

    fetch("/api/dashboard-data", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("dashboard data")))
      .then((payload: DashboardPayload) => {
        const status = Array.isArray(payload.data?.status) ? payload.data!.status! : [];
        actualCount = 0;
        for (const value of status) {
          if (String(value || "").trim() !== "실적") break;
          actualCount += 1;
        }
        if (!attach()) {
          retryTimer = setInterval(() => {
            if (attach() && retryTimer) {
              clearInterval(retryTimer);
              retryTimer = null;
            }
          }, 250);
        }
      })
      .catch(() => {});

    return () => {
      if (retryTimer) clearInterval(retryTimer);
      if (frame && loadHandler) frame.removeEventListener("load", loadHandler);
    };
  }, []);

  return null;
}
