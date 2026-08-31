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

      doc.getElementById("value-table-position-fix")?.remove();
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
        innerObserver.observe(doc.body, { childList: true, subtree: true });
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
