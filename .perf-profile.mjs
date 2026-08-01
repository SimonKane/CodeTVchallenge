import { writeFile } from "node:fs/promises";

const viewport = process.argv[2] === "mobile"
  ? { width: 390, height: 844, mobile: true }
  : { width: 1440, height: 900, mobile: false };
const label = viewport.mobile ? "mobile" : "desktop";
const cycleCount = Math.max(1, Number(process.argv[3] ?? 1));
const targets = await fetch("http://127.0.0.1:9232/json").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && entry.url.includes("127.0.0.1:4387"));
if (!target) throw new Error("Profile page not found");

const socket = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const listeners = new Map();
const ready = new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
    return;
  }
  for (const listener of listeners.get(message.method) ?? []) listener(message.params);
});
await ready;

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id;
  pending.set(requestId, { resolve, reject });
  socket.send(JSON.stringify({ id: requestId, method, params }));
});
const on = (method, listener) => {
  const group = listeners.get(method) ?? [];
  group.push(listener);
  listeners.set(method, group);
};
const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

const instrumentation = `(() => {
  const state = window.__perfAudit = {
    frames: [], rafCallbacks: [], currentRafTime: -1, currentRafCallbacks: 0,
    longTasks: [], layoutShifts: [], resources: [], rectReads: 0,
    computedStyleReads: 0, resizeCallbacks: 0, webgl: {
      drawCalls: 0, textureUploads: 0, bufferUploads: 0, shaderCompiles: 0,
      programLinks: 0, contexts: 0, renderer: "", vendor: ""
    }
  };
  const originalRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => originalRaf((time) => {
    if (state.currentRafTime !== time) {
      if (state.currentRafTime >= 0) state.rafCallbacks.push(state.currentRafCallbacks);
      state.currentRafTime = time;
      state.currentRafCallbacks = 0;
    }
    state.currentRafCallbacks += 1;
    callback(time);
  });
  let lastFrame;
  const sampleFrame = (time) => {
    if (lastFrame !== undefined) state.frames.push(time - lastFrame);
    lastFrame = time;
    originalRaf(sampleFrame);
  };
  originalRaf(sampleFrame);
  const originalRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function(...args) {
    state.rectReads += 1;
    return originalRect.apply(this, args);
  };
  const originalStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = (...args) => {
    state.computedStyleReads += 1;
    return originalStyle(...args);
  };
  const NativeResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class extends NativeResizeObserver {
    constructor(callback) {
      super((...args) => { state.resizeCallbacks += 1; callback(...args); });
    }
  };
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const context = originalGetContext.call(this, type, ...args);
    if (!context || !/^webgl/.test(type) || context.__profileWrapped) return context;
    context.__profileWrapped = true;
    state.webgl.contexts += 1;
    const debug = context.getExtension("WEBGL_debug_renderer_info");
    state.webgl.renderer = String(context.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER));
    state.webgl.vendor = String(context.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : context.VENDOR));
    for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
      if (!context[name]) continue;
      const original = context[name].bind(context);
      context[name] = (...callArgs) => { state.webgl.drawCalls += 1; return original(...callArgs); };
    }
    for (const name of ["texImage2D", "texSubImage2D", "compressedTexImage2D"]) {
      if (!context[name]) continue;
      const original = context[name].bind(context);
      context[name] = (...callArgs) => { state.webgl.textureUploads += 1; return original(...callArgs); };
    }
    for (const name of ["bufferData", "bufferSubData"]) {
      if (!context[name]) continue;
      const original = context[name].bind(context);
      context[name] = (...callArgs) => { state.webgl.bufferUploads += 1; return original(...callArgs); };
    }
    for (const [name, key] of [["compileShader", "shaderCompiles"], ["linkProgram", "programLinks"]]) {
      const original = context[name].bind(context);
      context[name] = (...callArgs) => { state.webgl[key] += 1; return original(...callArgs); };
    }
    return context;
  };
  try {
    new PerformanceObserver((list) => state.longTasks.push(...list.getEntries().map((entry) => ({ start: entry.startTime, duration: entry.duration })))).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((list) => state.layoutShifts.push(...list.getEntries().filter((entry) => !entry.hadRecentInput).map((entry) => ({ start: entry.startTime, value: entry.value })))).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => state.resources.push(...list.getEntries().map((entry) => ({ name: entry.name, duration: entry.duration, transfer: entry.transferSize, decoded: entry.decodedBodySize })))).observe({ type: "resource", buffered: true });
  } catch {}
})();`;

await send("Page.enable");
await send("Runtime.enable");
await send("Performance.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: viewport.width,
  height: viewport.height,
  deviceScaleFactor: viewport.mobile ? 3 : 1,
  mobile: viewport.mobile,
});
await send("Page.addScriptToEvaluateOnNewDocument", { source: instrumentation });
await send("Page.reload", { ignoreCache: true });

for (let attempt = 0; attempt < 120; attempt += 1) {
  await sleep(250);
  const readyState = await evaluate(`({
    ready: document.readyState,
    scene: document.querySelector("[data-cinematic-scene]")?.dataset.sceneStatus,
    height: document.documentElement.scrollHeight
  })`);
  if (readyState.ready === "complete" && readyState.scene === "ready") break;
  if (attempt === 119) throw new Error(`Scene did not become ready: ${JSON.stringify(readyState)}`);
}
await sleep(1800);

const startMetrics = await send("Performance.getMetrics");
const startState = await evaluate(`({
  scrollHeight: document.documentElement.scrollHeight,
  viewport: [innerWidth, innerHeight],
  dpr: devicePixelRatio,
  canvas: (() => { const c = document.querySelector("[data-experience-canvas]"); return c ? { css: [c.clientWidth, c.clientHeight], buffer: [c.width, c.height], quality: c.dataset.adaptiveQuality ?? "full" } : null; })(),
  heap: performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize } : null
})`);
const baselineScreenshot = await send("Page.captureScreenshot", { format: "png" });
await writeFile(`.perf-${label}-before.png`, Buffer.from(baselineScreenshot.data, "base64"));

const traceEvents = [];
on("Tracing.dataCollected", ({ value }) => traceEvents.push(...value));
let traceDone;
const traceComplete = new Promise((resolve) => { traceDone = resolve; });
on("Tracing.tracingComplete", traceDone);
await send("Tracing.start", {
  categories: "devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline.frame",
  options: "sampling-frequency=10000",
});

await evaluate(`window.__perfAudit.frames.length = 0; window.__perfAudit.rafCallbacks.length = 0; window.scrollTo(0, 0)`);
const scrollHeight = startState.scrollHeight - viewport.height;
const steps = 260;
const heapCycles = [];
for (let cycle = 0; cycle < cycleCount; cycle += 1) {
  for (let step = 1; step <= steps; step += 1) {
    const targetY = (scrollHeight * step) / steps;
    await evaluate(`window.scrollTo(0, ${targetY})`);
    await sleep(viewport.mobile ? 48 : 42);
  }
  await sleep(6500);
  for (let step = steps - 1; step >= 0; step -= 1) {
    if (step % 2 !== 0) continue;
    const targetY = (scrollHeight * step) / steps;
    await evaluate(`window.scrollTo(0, ${targetY})`);
    await sleep(viewport.mobile ? 35 : 30);
  }
  await sleep(1200);
  await send("HeapProfiler.collectGarbage");
  heapCycles.push(await evaluate(`performance.memory ? performance.memory.usedJSHeapSize : 0`));
}
await send("Tracing.end");
await traceComplete;

const endMetrics = await send("Performance.getMetrics");
const endState = await evaluate(`(() => {
  const state = window.__perfAudit;
  const frames = state.frames.filter((value) => value > 0 && value < 1000).sort((a, b) => a - b);
  const percentile = (p) => frames[Math.min(frames.length - 1, Math.floor(frames.length * p))] ?? 0;
  return {
    frames: { count: frames.length, average: frames.reduce((sum, value) => sum + value, 0) / Math.max(1, frames.length), p95: percentile(.95), p99: percentile(.99), worst: frames.at(-1) ?? 0, over25: frames.filter((value) => value > 25).length, over50: frames.filter((value) => value > 50).length },
    rafCallbacks: { average: state.rafCallbacks.reduce((sum, value) => sum + value, 0) / Math.max(1, state.rafCallbacks.length), max: Math.max(0, ...state.rafCallbacks) },
    longTasks: state.longTasks,
    layoutShift: state.layoutShifts.reduce((sum, entry) => sum + entry.value, 0),
    rectReads: state.rectReads,
    computedStyleReads: state.computedStyleReads,
    resizeCallbacks: state.resizeCallbacks,
    webgl: state.webgl,
    resources: { count: state.resources.length, transfer: state.resources.reduce((sum, entry) => sum + (entry.transfer || 0), 0), slowest: [...state.resources].sort((a, b) => b.duration - a.duration).slice(0, 8) },
    canvas: (() => { const c = document.querySelector("[data-experience-canvas]"); return c ? { css: [c.clientWidth, c.clientHeight], buffer: [c.width, c.height], quality: c.dataset.adaptiveQuality ?? "full" } : null; })(),
    heap: performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize } : null,
    scrollY,
    scrollHeight: document.documentElement.scrollHeight
  };
})()`);
const finalScreenshot = await send("Page.captureScreenshot", { format: "png" });
await writeFile(`.perf-${label}-after-cycle.png`, Buffer.from(finalScreenshot.data, "base64"));

const metricMap = (result) => Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]));
const before = metricMap(startMetrics);
const after = metricMap(endMetrics);
const metricDelta = Object.fromEntries([
  "TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration",
  "LayoutCount", "RecalcStyleCount", "JSHeapUsedSize", "Nodes"
].map((name) => [name, (after[name] ?? 0) - (before[name] ?? 0)]));
const traceSummary = {};
for (const event of traceEvents) {
  if (event.ph !== "X" || !event.dur) continue;
  const entry = traceSummary[event.name] ??= { count: 0, totalMs: 0, worstMs: 0 };
  const duration = event.dur / 1000;
  entry.count += 1;
  entry.totalMs += duration;
  entry.worstMs = Math.max(entry.worstMs, duration);
}
const significantTrace = Object.fromEntries(Object.entries(traceSummary)
  .filter(([, value]) => value.totalMs >= 5 || value.worstMs >= 3)
  .sort((a, b) => b[1].totalMs - a[1].totalMs)
  .slice(0, 30));

console.log(JSON.stringify({ label, cycleCount, heapCycles, startState, endState, metricDelta, trace: significantTrace }, null, 2));
socket.close();
