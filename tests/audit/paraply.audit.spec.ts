import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { installBrowserObservers, type BrowserAuditState } from "./browser-observers";
import { summarizeTrace, type TraceEvent } from "./trace-metrics";

type ResourceMetric = {
  name: string;
  initiatorType: string;
  transferSize: number;
  encodedBodySize: number;
};

async function readTrace(cdp: CDPSession, stream: string) {
  let contents = "";
  while (true) {
    const chunk = await cdp.send("IO.read", { handle: stream });
    contents += chunk.data;
    if (chunk.eof) break;
  }
  await cdp.send("IO.close", { handle: stream });
  return contents;
}

async function stopTracing(cdp: CDPSession) {
  const completed = new Promise<{ stream: string }>((resolve) =>
    cdp.once("Tracing.tracingComplete", resolve),
  );
  await cdp.send("Tracing.end");
  return readTrace(cdp, (await completed).stream);
}

async function captureCheckpoint(page: Page, directory: string, name: string) {
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: false });
}

test("complete Paraply narrative audit", async ({ page, browser }, testInfo) => {
  const label = process.env.AUDIT_LABEL ?? "current";
  const runName = `run-${testInfo.repeatEachIndex + 1}`;
  const resultDirectory = path.resolve("audit-results", label, testInfo.project.name, runName);
  await mkdir(resultDirectory, { recursive: true });

  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`),
  );
  await page.addInitScript(installBrowserObservers);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Tracing.start", {
    categories: "devtools.timeline,loading,blink.user_timing,disabled-by-default-devtools.timeline.frame",
    options: "sampling-frequency=10000",
    transferMode: "ReturnAsStream",
  });

  let traceContents = "";
  let reachedFinal = false;
  let preIntroTransferBytes = 0;
  let preIntroImageTransferBytes = 0;
  try {
    await page.goto("/", { waitUntil: "networkidle" });
    const scene = page.locator("[data-cinematic-scene]");
    await expect(scene).toHaveAttribute("data-scene-status", /ready|fallback/, { timeout: 30_000 });
    const preIntroResources = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => {
        const resource = entry as PerformanceResourceTiming;
        return {
          name: resource.name,
          initiatorType: resource.initiatorType,
          transferSize: resource.transferSize,
        };
      }),
    );
    preIntroTransferBytes = preIntroResources.reduce(
      (total, resource) => total + resource.transferSize,
      0,
    );
    preIntroImageTransferBytes = preIntroResources
      .filter(
        (resource) =>
          resource.initiatorType === "img" ||
          /\.(avif|webp|png|jpe?g)(\?|$)/i.test(resource.name),
      )
      .reduce((total, resource) => total + resource.transferSize, 0);
    await page.waitForTimeout(5_500);
    await captureCheckpoint(page, resultDirectory, "00-hero");
    await page.evaluate(() => {
      window.__auditMarkInteraction?.();
      window.__auditStartFrames?.();
    });

    const checkpointTargets = [0.25, 0.5, 0.75, 0.98];
    let nextCheckpoint = 0;
    for (let step = 0; step < 500; step += 1) {
      const sequenceLocked = await page.locator("[data-experience-chapter]").getAttribute("data-sequence-locked");
      if (sequenceLocked === "true") {
        await page.waitForTimeout(250);
        continue;
      }
      await page.mouse.wheel(0, 480);
      await page.waitForTimeout(80);
      const progress = await page.evaluate(() => {
        const maximum = Math.max(1, document.documentElement.scrollHeight - innerHeight);
        return scrollY / maximum;
      });
      if (nextCheckpoint < checkpointTargets.length && progress >= checkpointTargets[nextCheckpoint]) {
        await captureCheckpoint(page, resultDirectory, `${String(nextCheckpoint + 1).padStart(2, "0")}-${Math.round(checkpointTargets[nextCheckpoint] * 100)}`);
        nextCheckpoint += 1;
      }
      const finished = await page.locator("#umbrella-safe-title").evaluate((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return Number(style.opacity) > 0.9 && rect.top < innerHeight && rect.bottom > 0;
      });
      if (finished && progress > 0.96) {
        reachedFinal = true;
        break;
      }
    }
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__auditStopFrames?.());
    await captureCheckpoint(page, resultDirectory, "05-final");
  } finally {
    traceContents = await stopTracing(cdp);
  }

  const trace = JSON.parse(traceContents) as { traceEvents?: TraceEvent[] };
  await writeFile(path.join(resultDirectory, "chrome-trace.json"), traceContents);
  const traceSummary = summarizeTrace(trace.traceEvents ?? []);
  const browserState = await page.evaluate(() => window.__auditState) as BrowserAuditState;
  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => {
      const resource = entry as PerformanceResourceTiming;
      return {
        name: resource.name,
        initiatorType: resource.initiatorType,
        transferSize: resource.transferSize,
        encodedBodySize: resource.encodedBodySize,
      };
    }),
  ) as ResourceMetric[];
  const frameIntervals = browserState.frameTimes
    .slice(1)
    .map((time, index) => time - browserState.frameTimes[index])
    .filter((duration) => duration > 0 && duration < 1000);
  const totalFrameTime = frameIntervals.reduce((total, duration) => total + duration, 0);
  const sortedFrames = [...frameIntervals].sort((a, b) => a - b);
  const p95FrameMs = sortedFrames[Math.max(0, Math.ceil(sortedFrames.length * 0.95) - 1)] ?? 0;
  const semantics = await page.evaluate(() => {
    const isAccessible = (element: Element) => {
      for (let current: Element | null = element; current; current = current.parentElement) {
        if (current.hasAttribute("hidden") || current.getAttribute("aria-hidden") === "true") return false;
        const style = getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
      return true;
    };
    const images = [...document.images];
    const interactive = [...document.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [role='button'], [tabindex]")];
    const canvas = document.querySelector<HTMLCanvasElement>("[data-experience-canvas]");
    const context = canvas?.getContext("webgl2");
    const rendererExtension = context?.getExtension("WEBGL_debug_renderer_info");
    const renderer = context
      ? String(context.getParameter(rendererExtension?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER))
      : "";
    return {
      mainCount: document.querySelectorAll("main").length,
      h1Total: document.querySelectorAll("h1").length,
      h1Accessible: [...document.querySelectorAll("h1")].filter(isAccessible).length,
      headingOrder: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(isAccessible).map((heading) => heading.tagName),
      imagesMissingAlt: images.filter((image) => !image.hasAttribute("alt")).length,
      imageCount: images.length,
      interactiveCount: interactive.length,
      horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      title: document.title,
      description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "",
      lang: document.documentElement.lang,
      renderer,
      canvasBuffer: canvas ? { width: canvas.width, height: canvas.height } : null,
      canvasCss: canvas ? { width: canvas.clientWidth, height: canvas.clientHeight } : null,
      devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
      coarsePointer: matchMedia("(pointer: coarse)").matches,
    };
  });
  const totalTransferBytes = resources.reduce((total, resource) => total + resource.transferSize, 0);
  const imageTransferBytes = resources
    .filter((resource) => resource.initiatorType === "img" || /\.(avif|webp|png|jpe?g)(\?|$)/i.test(resource.name))
    .reduce((total, resource) => total + resource.transferSize, 0);
  const metrics = {
    capturedAt: new Date().toISOString(),
    project: testInfo.project.name,
    viewport: page.viewportSize(),
    browserVersion: browser.version(),
    url: page.url(),
    reachedFinal,
    lcpMs: browserState.lcpMs,
    lcpElement: browserState.lcpElement,
    cls: browserState.navigationCls,
    journeyCls: browserState.cls,
    layoutShifts: browserState.layoutShifts,
    meanFps: totalFrameTime > 0 ? (frameIntervals.length * 1000) / totalFrameTime : 0,
    p95FrameMs,
    framesOver50Ms: frameIntervals.filter((duration) => duration >= 50).length,
    longTaskCount: browserState.longTasks.length,
    longTaskTotalMs: browserState.longTasks.reduce((total, task) => total + task.duration, 0),
    longestTaskMs: Math.max(0, ...browserState.longTasks.map((task) => task.duration)),
    trace: traceSummary,
    totalTransferBytes,
    imageTransferBytes,
    preIntroTransferBytes,
    preIntroImageTransferBytes,
    resources,
    consoleErrors,
    failedRequests,
    semantics,
  };
  await writeFile(path.join(resultDirectory, "metrics.json"), JSON.stringify(metrics, null, 2));

  expect(consoleErrors, "browser console errors").toEqual([]);
  expect(failedRequests, "failed first-party requests").toEqual([]);
  expect(reachedFinal, "the deterministic journey reaches the final safe-place chapter").toBe(true);
});
