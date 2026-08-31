"use client";

import { useEffect } from "react";

type DashboardPayload = { data?: { status?: string[] } };

export default function ActualStatusFix() {
  useEffect(() => {
    let status: string[] = [];
    let frame: HTMLIFrameElement | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;
    let rangeChangeHandler: ((event: Event) => void) | null = null;
    let frameLoadHandler: (() => void) | null = null;
    let queued = false;

    const actualPalette = ["#174ea6", "#2867f0", "#4384dc", "#5b99e6", "#78adeb", "#9bc5f2", "#b9d4f4"];

    const monthIndex = (value: unknown) => {
      const match = String(value || "").match(/(\d{1,2})월/);
      if (!match) return -1;
      const index = Number(match[1]) - 1;
      return index >= 0 && index < 12 ? index : -1;
    };

    const isActual = (index: number) => String(status[index] || "").trim() === "실적";

    const forceBlueSegments = (node: HTMLElement) => {
      const direct = [...node.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
      const segments = direct.filter(child => {
        if (["STRONG", "SPAN", "B", "SMALL", "EM"].includes(child.tagName)) return false;
        return child.tagName === "BUTTON" || child.tagName === "I" || Boolean(child.style.background || child.style.backgroundColor);
      });
      segments.forEach((segment, segmentIndex) => {
        const color = segment.tagName === "I" ? "#d6e5f7" : actualPalette[segmentIndex % actualPalette.length];
        segment.style.setProperty("background", color, "important");
        segment.style.setProperty("background-color", color, "important");
      });
    };

    const adjustSvgMonthGroups = (doc: Document) => {
      doc.querySelectorAll<SVGGElement>("svg g").forEach(group => {
        const label = group.querySelector<SVGTextElement>(".month-axis-label");
        const index = monthIndex(label?.textContent);
        if (index < 0) return;
        const actual = isActual(index);

        const bg = group.querySelector<SVGRectElement>(".gmv-target-actual-bg, .gmv-target-forecast-bg");
        if (bg) {
          const next = actual ? "gmv-target-actual-bg" : "gmv-target-forecast-bg";
          if (bg.getAttribute("class") !== next) bg.setAttribute("class", next);
        }

        const bars = [...group.querySelectorAll<SVGRectElement>(".bar-rocket, .bar-wing, .bar-forecast")];
        bars.forEach((bar, barIndex) => {
          const next = actual
            ? (barIndex === 0 ? "bar-rocket" : "bar-wing")
            : (barIndex === 0 ? "bar-forecast" : "bar-forecast wing-forecast");
          if (bar.getAttribute("class") !== next) bar.setAttribute("class", next);
        });
      });
    };

    const adjustBrandMonths = (doc: Document) => {
      doc.querySelectorAll<HTMLElement>(".brand-month").forEach(node => {
        const index = monthIndex(node.querySelector(":scope > span:last-child")?.textContent || node.textContent);
        if (index < 0) return;
        const actual = isActual(index);
        const shouldForecast = !actual;
        if (node.classList.contains("forecast-brand-month") !== shouldForecast) {
          node.classList.toggle("forecast-brand-month", shouldForecast);
        }
        if (actual) forceBlueSegments(node);
      });
    };

    const adjustProductMonths = (doc: Document) => {
      doc.querySelectorAll<HTMLElement>(".product-month").forEach(node => {
        const index = monthIndex(
          node.querySelector(":scope > strong")?.textContent ||
          node.querySelector(":scope > span:last-child")?.textContent ||
          node.textContent
        );
        if (index < 0 || !isActual(index)) return;
        node.classList.remove("forecast-product-month", "forecast", "is-forecast");
        node.classList.add("actual-product-month");
        forceBlueSegments(node);
        node.querySelectorAll<HTMLElement>("[style*='background']").forEach((segment, segmentIndex) => {
          if (["STRONG", "SPAN", "B", "SMALL", "EM"].includes(segment.tagName)) return;
          const color = actualPalette[segmentIndex % actualPalette.length];
          segment.style.setProperty("background", color, "important");
          segment.style.setProperty("background-color", color, "important");
        });
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
        const nextText = actual ? "실적" : "예상";
        if (mini && mini.textContent !== nextText) mini.textContent = nextText;
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
      actualRect.setAttribute("width", String(boundary - left));
      forecastRect.setAttribute("x", String(boundary));
      forecastRect.setAttribute("width", String(right - boundary));
      if (actualTitle) actualTitle.setAttribute("x", String((left + boundary) / 2));
      if (forecastTitle) forecastTitle.setAttribute("x", String((boundary + right) / 2));
    };

    const adjustCopy = (doc: Document) => {
      doc.querySelectorAll<HTMLElement>(".brand-chart-guide span, .gmv-chart-guide span, .unit, .product-legend span").forEach(node => {
        const current = node.textContent || "";
        if (current.includes("8~12월 예상")) node.textContent = current.replace("8~12월 예상", "9~12월 예상");
      });
      doc.querySelectorAll<HTMLElement>(".brand-chart-legend span").forEach(node => {
        const current = node.textContent || "";
        if (current.includes("8~12월 예상")) {
          const textNode = [...node.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent?.includes("8~12월 예상"));
          if (textNode) textNode.textContent = textNode.textContent!.replace("8~12월 예상", "9~12월 예상");
        }
      });
    };

    const apply = () => {
      const doc = frame?.contentDocument;
      if (!status.length || !doc?.body) return;
      adjustSvgMonthGroups(doc);
      adjustBrandMonths(doc);
      adjustProductMonths(doc);
      adjustSpendMonths(doc);
      adjustAccountingMonths(doc);
      adjustPeriodBackground(doc);
      adjustCopy(doc);
    };

    const scheduleApply = (delay = 0) => {
      if (queued && delay === 0) return;
      if (delay === 0) queued = true;
      window.setTimeout(() => {
        if (delay === 0) queued = false;
        requestAnimationFrame(apply);
      }, delay);
    };

    const attach = () => {
      frame = document.querySelector<HTMLIFrameElement>(".dashboard-frame");
      const doc = frame?.contentDocument;
      if (!frame || !doc?.body) return false;

      if (!rangeChangeHandler) {
        rangeChangeHandler = event => {
          const target = event.target as Element | null;
          if (target?.matches(".range-filter select, .report-brand-select")) {
            scheduleApply(180);
            scheduleApply(550);
          }
        };
        doc.addEventListener("change", rangeChangeHandler, true);
      }

      if (!frameLoadHandler) {
        frameLoadHandler = () => {
          scheduleApply(100);
          scheduleApply(500);
        };
        frame.addEventListener("load", frameLoadHandler);
      }

      scheduleApply();
      scheduleApply(500);
      return true;
    };

    fetch("/api/dashboard-data", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("dashboard data")))
      .then((payload: DashboardPayload) => {
        status = Array.isArray(payload.data?.status) ? payload.data!.status! : [];
        if (!attach()) {
          retryTimer = setInterval(() => {
            if (attach() && retryTimer) {
              clearInterval(retryTimer);
              retryTimer = null;
            }
          }, 300);
        }
      })
      .catch(() => {});

    return () => {
      if (retryTimer) clearInterval(retryTimer);
      const doc = frame?.contentDocument;
      if (doc && rangeChangeHandler) doc.removeEventListener("change", rangeChangeHandler, true);
      if (frame && frameLoadHandler) frame.removeEventListener("load", frameLoadHandler);
    };
  }, []);

  return null;
}
