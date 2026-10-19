import { expect, test } from "@playwright/test";

async function advanceToSequenceLock(page: import("@playwright/test").Page) {
  const chapter = page.locator("[data-experience-chapter]");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(100);
    if ((await chapter.getAttribute("data-sequence-locked")) === "true") return;
  }
  throw new Error("Narrative sequence lock was not reached");
}

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

  expect(pacing.scrollViewports).toBeGreaterThan(15);
  expect(pacing.child).toBeDefined();
  expect(pacing.child?.blendMode).toBe("normal");
  expect(pacing.child?.topRatio).toBeLessThan(0.36);
  expect(pacing.child?.aspectRatio).toBeGreaterThan(0.6);
});

test("wheel intent during the SILENCE transition is carried forward", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop wheel regression");

  await page.goto("/", { waitUntil: "networkidle" });
  const scene = page.locator("[data-cinematic-scene]");
  const chapter = page.locator("[data-experience-chapter]");
  await expect(scene).toHaveAttribute("data-scene-status", "ready", {
    timeout: 30_000,
  });
  await page.waitForTimeout(5_500);

  await advanceToSequenceLock(page);
  await expect(chapter).not.toHaveAttribute("data-sequence-locked", "true", {
    timeout: 5_000,
  });
  await advanceToSequenceLock(page);

  const lockedY = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 480);
  await page.mouse.wheel(0, 480);
  await page.mouse.wheel(0, 480);
  await expect(chapter).not.toHaveAttribute("data-sequence-locked", "true", {
    timeout: 4_000,
  });
  await page.waitForTimeout(900);

  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(lockedY + 100);
});
