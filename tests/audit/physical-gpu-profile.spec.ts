import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const percentile = (values: number[], portion: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * portion) - 1)] ?? 0;
};

const profileDirection = async (page: Page, deltaY: number) => {
  await page.evaluate(() => {
    const state = { frames: [] as { time: number; y: number }[], active: true };
    (window as typeof window & { __physicalFrames?: typeof state }).__physicalFrames = state;
    const tick = (time: number) => {
      if (!state.active) return;
      state.frames.push({ time, y: scrollY });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const before = await page.evaluate(() => scrollY);
  for (let index = 0; index < 28; index += 1) {
    await page.mouse.wheel(0, deltaY);
    // Matches the October 24 fast-scroll profile (~4.5–5 kpx/s).
    await page.waitForTimeout(48);
  }
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => scrollY);
  const times = await page.evaluate(() => {
    const state = (window as typeof window & {
      __physicalFrames?: {
        frames: { time: number; y: number }[];
        active: boolean;
      };
    }).__physicalFrames;
    if (!state) return [];
    state.active = false;
    return state.frames;
  });
  const intervals = times.slice(1).map((frame, index) => ({
    duration: frame.time - times[index].time,
    y: frame.y,
  }));
  const durations = intervals.map(({ duration }) => duration);
  return {
    travelled: after - before,
    frameCount: intervals.length,
    meanFrameMs:
      durations.reduce((total, value) => total + value, 0) /
      Math.max(1, durations.length),
    p95FrameMs: percentile(durations, 0.95),
    maxFrameMs: Math.max(0, ...durations),
    framesOver50Ms: durations.filter((value) => value >= 50).length,
    spikes: intervals.filter(({ duration }) => duration >= 50),
  };
};

test("physical GPU fast forward and reverse profile", async ({ page }, testInfo) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("[data-cinematic-scene]")).toHaveAttribute(
    "data-scene-status",
    "ready",
    { timeout: 30_000 },
  );
  await page.waitForTimeout(5_500);
  const renderer = await page.locator("[data-experience-canvas]").evaluate((canvas) => {
    const context = (canvas as HTMLCanvasElement).getContext("webgl2");
    const extension = context?.getExtension("WEBGL_debug_renderer_info");
    return context
      ? String(
          context.getParameter(
            extension?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER,
          ),
        )
      : "";
  });
  test.skip(/SwiftShader/i.test(renderer), "Physical GPU profile excludes SwiftShader");

  // Match the October audit's warmed journey before the comparable samples.
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1_000);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(1_000);

  const forward = await profileDirection(page, 260);
  const reverse = await profileDirection(page, -260);
  const result = {
    capturedAt: new Date().toISOString(),
    project: testInfo.project.name,
    renderer,
    viewport: page.viewportSize(),
    forward,
    reverse,
  };
  const directory = path.resolve("audit-results", "2026-10-24-physical-profile");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${testInfo.project.name}.json`),
    JSON.stringify(result, null, 2),
  );

  expect(renderer).toMatch(/NVIDIA GeForce RTX 3060/i);
  expect(forward.p95FrameMs).toBeLessThan(20);
  expect(reverse.p95FrameMs).toBeLessThan(20);
});
