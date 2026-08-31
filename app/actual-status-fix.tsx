"use client";

import { useEffect } from "react";

type DashboardPayload = { data?: { status?: string[] } };

export default function ActualStatusFix() {
  useEffect(() => {
    let status: string[] = [];
    let frame: HTMLIFrameElement | null = null;
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let applying = false;

    const monthIndex = (value: unknown) => {
      const match = String(value || "").match(/(\d{1,2})월/);
      if (!match) return -1;
      const index = Number(match[1]) - 1;
      return index >= 0 && index < 12 ? index : -1;
    };
    const isActual = (index: number) => String(status[index] || "").trim() === "실적";

    const adjustSvgMonthGroups = (doc: Document) => {
      doc.querySelectorAll<SVGGElement>("svg g").forEach(group => {
        const label = group.querySelector<SVGTextElement>(".month-axis-label");
        const index = monthIndex(label?.textContent);
        if (index < 0) return;
        const actual = isActual(index);

        const bg = group.querySelector<SVGRectElement>(".gmv-target-actual-bg, .gmv-target-forecast-bg");
        if (bg) bg.setAttribute("class", actual ? "gmv-target-actual-bg" : "gmv-target-forecast-bg");

        const bars = [...group.querySelectorAll<SVGRectElement>(".bar-rocket, .bar-wing, .bar-forecast")];
        bars.forEach((bar, barIndex) => {
          if (actual) {
            bar.setAttribute("class", barIndex === 0 ? "bar-rocket" : "bar-wing");
          } else {
            bar.setAttribute("class", barIndex === 0 ? "bar-forecast" : "bar-forecast wing-forecast");
          }
        });
      });
    };

    const adjustBrandMonths = (doc: Document) => {
      doc.querySelectorAll<HTMLElement>(".brand-month").forEach(node => {
        const index = monthIndex(node.querySelector(":scope > span:last-child")?.textContent || node.textContent);
        if (index < 0) return;
        node.classList.toggle("forecast-brand-month", !isActual(index));
      });
    };

    const adjustSpendMonths = (doc: Document) => {
      doc.querySelectorAll<HTMLElement>(".spend-column").forEach(node => {
        const labels = node.querySelectorAll<HTMLElement>(":scope > span");
        const index = monthIndex(labels[labels.length - 1]?.textContent);
        if (index < 0) return;
        const actual = isActual(index);
        node.classList.toggle("actual-column", actual);
        node.classList.toggle("forecast-column", !actual);
        const mini = node.querySelector<HTMLElement>(".period-mini");
        if (mini) mini.textContent = actual ? "실적" : "예상";
      });
    };

    const adjustAccountingMonths = (doc: Document) => {
      doc.querySelectorAll<HTMLElement>(".accounting-month").forEach(node => {
        const index = monthIndex(node.querySelector(":scope > strong")?.textContent);
        if (index < 0) return;
        const actual = isActual(index);
        const label = node.querySelector<HTMLElement>(".accounting-label");
        const stack = node.querySelector<HTMLElement>(".accounting-stack");
        [label, stack].forEach(element => {
          if (!element) return;
          element.classList.toggle("actual", actual);
          element.classList.toggle("forecast", !actual);
        });
      });
    };

    const adjustPeriodBackground = (doc: Document) => {
      const svg = doc.querySelector<SVGSVGElement>(".gmv-combo");
      if (!svg) return;
      const monthGroups = [...svg.querySelectorAll<SVGGElement>("g")]
        .map(group => {
          const label = group.querySelector<SVGTextElement>(".month-axis-label");
          const index = monthIndex(label?.textContent);
          const x = Number(label?.getAttribute("x"));
          return { index, x };
        })
        .filter(item => item.index >= 0 && Number.isFinite(item.x));
      const lastActual = monthGroups.filter(item => isActual(item.index)).at(-1);
      const firstForecast = monthGroups.find(item => !isActual(item.index));
      const actualRect = svg.querySelector<SVGRectElement>(".period-actual");
      const forecastRect = svg.querySelector<SVGRectElement>(".period-forecast");
      const actualTitle = svg.querySelector<SVGTextElement>(".actual-title");
      const forecastTitle = svg.querySelector<SVGTextElement>(".forecast-title");
      if (!actualRect || !forecastRect || !lastActual || !firstForecast) return;

      const left = Number(actualRect.getAttribute("x")) || 64;
      const right = (Number(forecastRect.getAttribute("x")) || 0) + (Number(forecastRect.getAttribute("width")) || 0);
      const boundary = (lastActual.x + firstForecast.x) / 2;
      actualRect.setAttribute("x", String(left));
      actualRect.setAttribute("width", String(boundary - left));
      forecastRect.setAttribute("x", String(boundary));
      forecastRect.setAttribute("width", String(right - boundary));
      if (actualTitle) actualTitle.setAttribute("x", String((left + boundary) / 2));
      if (forecastTitle) forecastTitle.setAttribute("x", String((boundary + right) / 2));
    };

    const adjustCopy = (doc: Document) => {
      doc.querySelectorAll<HTMLElement>(".brand-chart-guide span, .gmv-chart-guide span, .unit, .forecast-legend-chip").forEach(node => {
        if (node.childElementCount === 0 && node.textContent?.includes("8~12월 예상")) {
          node.textContent = node.textContent.replace("8~12월 예상", "9~12월 예상");
        }
      });
      doc.querySelectorAll<HTMLElement>(".brand-chart-legend span").forEach(node => {
        if (node.textContent?.includes("8~12월 예상")) node.lastChild && (node.lastChild.textContent = "9~12월 예상");
      });
    };

    const apply = () => {
      if (applying || !status.length || !frame?.contentDocument) return;
      applying = true;
      try {
        const doc = frame.contentDocument;
        adjustSvgMonthGroups(doc);
        adjustBrandMonths(doc);
        adjustSpendMonths(doc);
        adjustAccountingMonths(doc);
        adjustPeriodBackground(doc);
        adjustCopy(doc);
      } finally {
        applying = false;
      }
    };

    const attach = () => {
      frame = document.querySelector<HTMLIFrameElement>(".dashboard-frame");
      const doc = frame?.contentDocument;
      if (!frame || !doc?.body) return false;
      observer?.disconnect();
      observer = new MutationObserver(() => requestAnimationFrame(apply));
      observer.observe(doc.body, { childList: true, subtree: true });
      doc.addEventListener("change", () => setTimeout(apply, 80), true);
      doc.addEventListener("click", () => setTimeout(apply, 80), true);
      apply();
      return true;
    };

    fetch("/api/dashboard-data", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("dashboard data")))
      .then((payload: DashboardPayload) => {
        status = Array.isArray(payload.data?.status) ? payload.data!.status! : [];
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
