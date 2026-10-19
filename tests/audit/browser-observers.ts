export type LayoutShiftSource = {
  selector: string;
  previousRect?: DOMRectReadOnly;
  currentRect?: DOMRectReadOnly;
};

export type BrowserAuditState = {
  cls: number;
  navigationCls: number;
  layoutShifts: Array<{
    value: number;
    time: number;
    sources: LayoutShiftSource[];
    scrollY: number;
    chapterClass: string;
  }>;
  lcpMs: number;
  lcpElement: string;
  longTasks: Array<{ startTime: number; duration: number }>;
  frameTimes: number[];
  supportedEntryTypes: string[];
};

declare global {
  interface Window {
    __auditState?: BrowserAuditState;
    __auditMarkInteraction?: () => void;
    __auditStartFrames?: () => void;
    __auditStopFrames?: () => void;
  }
}

export function installBrowserObservers() {
  const selectorFor = (node: Node | null): string => {
    if (!(node instanceof Element)) return "";
    if (node.id) return `#${CSS.escape(node.id)}`;
    const testAttribute = [...node.attributes].find((attribute) =>
      attribute.name.startsWith("data-"),
    );
    if (testAttribute) return `[${testAttribute.name}]`;
    return node.tagName.toLowerCase();
  };

  const state: BrowserAuditState = {
    cls: 0,
    navigationCls: 0,
    layoutShifts: [],
    lcpMs: 0,
    lcpElement: "",
    longTasks: [],
    frameTimes: [],
    supportedEntryTypes: [...PerformanceObserver.supportedEntryTypes],
  };
  window.__auditState = state;

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const lcp = entry as PerformanceEntry & { element?: Element | null; renderTime?: number; loadTime?: number };
        state.lcpMs = lcp.renderTime || lcp.loadTime || lcp.startTime;
        state.lcpElement = selectorFor(lcp.element ?? null);
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {}

  try {
    let sessionValue = 0;
    let sessionStart = 0;
    let previousShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources?: Array<{ node?: Node | null; previousRect?: DOMRectReadOnly; currentRect?: DOMRectReadOnly }>;
        };
        if (shift.hadRecentInput) continue;
        if (
          sessionValue > 0 &&
          shift.startTime - previousShift < 1000 &&
          shift.startTime - sessionStart < 5000
        ) {
          sessionValue += shift.value;
        } else {
          sessionValue = shift.value;
          sessionStart = shift.startTime;
        }
        previousShift = shift.startTime;
        state.cls = Math.max(state.cls, sessionValue);
        state.layoutShifts.push({
          value: shift.value,
          time: shift.startTime,
          scrollY,
          chapterClass:
            document.querySelector<HTMLElement>("[data-experience-chapter]")?.className ?? "",
          sources: (shift.sources ?? []).map((source) => ({
            selector: selectorFor(source.node ?? null),
            previousRect: source.previousRect,
            currentRect: source.currentRect,
          })),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}

  window.__auditMarkInteraction = () => {
    state.navigationCls = state.cls;
  };

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {}

  let frame = 0;
  let running = false;
  const recordFrame = (time: number) => {
    if (!running) return;
    state.frameTimes.push(time);
    frame = requestAnimationFrame(recordFrame);
  };
  window.__auditStartFrames = () => {
    if (running) return;
    running = true;
    state.frameTimes.length = 0;
    frame = requestAnimationFrame(recordFrame);
  };
  window.__auditStopFrames = () => {
    running = false;
    cancelAnimationFrame(frame);
  };
}
