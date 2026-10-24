import { expect, test } from "@playwright/test";

test("narrative pacing and sheltered child composition stay readable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop composition regression");

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("[data-cinematic-scene]")).toHaveAttribute(
    "data-scene-status",
    "ready",
    { timeout: 30_000 },
  );

  const pacing = await page.evaluate(() => ({
    scrollViewports:
      (document.documentElement.scrollHeight - innerHeight) / innerHeight,
    child: (() => {
      const element = document.querySelector<HTMLElement>(
        "[data-umbrella-sheltered-child]",
      );
      if (!element) return undefined;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const stage = element.closest<HTMLElement>("[data-umbrella-stage]");
      return {
        aspectRatio: rect.width / rect.height,
        blendMode: style.mixBlendMode,
        topRatio: parseFloat(style.top) / (stage?.clientHeight || innerHeight),
      };
    })(),
  }));

  expect(pacing.scrollViewports).toBeGreaterThan(8);
  expect(pacing.scrollViewports).toBeLessThan(11);
  expect(pacing.child).toBeDefined();
  expect(pacing.child?.blendMode).toBe("normal");
  expect(pacing.child?.topRatio).toBeLessThan(0.36);
  expect(pacing.child?.aspectRatio).toBeGreaterThan(0.6);
});

test("one wheel gesture keeps the browser's native scroll distance", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop wheel regression");

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("[data-cinematic-scene]")).toHaveAttribute(
    "data-scene-status",
    "ready",
    { timeout: 30_000 },
  );
  await page.waitForTimeout(5_500);

  const startY = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 480);
  await page.waitForTimeout(900);
  const travelled = (await page.evaluate(() => scrollY)) - startY;

  expect(travelled).toBeGreaterThanOrEqual(479);
  expect(travelled).toBeLessThanOrEqual(481);
});

test("the SILENCE to umbrella crossfade never locks scrolling", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop wheel regression");

  await page.goto("/", { waitUntil: "networkidle" });
  const scene = page.locator("[data-cinematic-scene]");
  const chapter = page.locator("[data-experience-chapter]");
  const umbrellaStage = page.locator("[data-umbrella-stage]");
  const silenceMessage = page.locator("[data-editorial-hidden-message]");
  const safeTitle = page.locator("#umbrella-safe-title");
  await expect(scene).toHaveAttribute("data-scene-status", "ready", {
    timeout: 30_000,
  });
  await page.waitForTimeout(5_500);

  let hasVisibleCrossfade = false;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(50);
    expect(await chapter.getAttribute("data-sequence-locked")).not.toBe("true");
    const [umbrellaOpacity, silenceOpacity] = await Promise.all([
      umbrellaStage.evaluate((node) => Number(getComputedStyle(node).opacity)),
      silenceMessage.evaluate((node) => Number(getComputedStyle(node).opacity)),
    ]);
    if (
      umbrellaOpacity > 0.2 &&
      umbrellaOpacity < 0.85 &&
      silenceOpacity > 0.2
    ) {
      hasVisibleCrossfade = true;
      break;
    }
  }

  expect(hasVisibleCrossfade).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("silence-umbrella-crossfade.png"),
    fullPage: false,
  });

  const transitionStartY = await page.evaluate(() => scrollY);
  for (let step = 0; step < 12; step += 1) {
    await page.mouse.wheel(0, 480);
    await page.waitForTimeout(120);
    expect(await chapter.getAttribute("data-sequence-locked")).not.toBe("true");
    if (Number(await safeTitle.evaluate((node) => getComputedStyle(node).opacity)) > 0.9) {
      break;
    }
  }
  const transitionDistance = (await page.evaluate(() => scrollY)) - transitionStartY;
  expect(transitionDistance).toBeLessThan((await page.evaluate(() => innerHeight)) * 2.5);
});
