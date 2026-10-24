import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test.use({ reducedMotion: "reduce" });

test("reduced-motion fallback remains complete and lightweight", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(request.url()));

  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page.locator("[data-cinematic-scene]")).toBeHidden();
  const fallback = page.locator("[data-experience-fallback]");
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute("data-active", "static");
  await expect(fallback.locator("h1")).toHaveCount(1);
  const sources = await fallback.locator("img").evaluateAll((images) =>
    images.map((image) => (image as HTMLImageElement).currentSrc),
  );
  expect(sources).toHaveLength(2);
  expect(sources.every((source) => /\.webp($|\?)/i.test(source))).toBe(true);

  const directory = path.resolve("audit-results", "fallback");
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `${testInfo.project.name}.png`),
    fullPage: false,
  });

  const control = page.locator("[data-umbrella-open-control]");
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  if (testInfo.project.name === "desktop") {
    await control.focus();
    await page.keyboard.press("Enter");
  } else {
    await control.tap();
  }
  await expect(control).toHaveAttribute("aria-expanded", "true");
  const openUmbrella = page.locator("[data-umbrella-open]");
  await expect(openUmbrella).toHaveCSS("opacity", "1");
  await openUmbrella.evaluate(async (image: HTMLImageElement) => {
    if (!image.complete) await image.decode();
  });
  await expect(page.locator("#umbrella-safe-title")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: path.join(directory, `${testInfo.project.name}-umbrella-open.png`),
    fullPage: false,
  });

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
