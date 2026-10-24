import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const ready = async (page: Page) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("[data-cinematic-scene]")).toHaveAttribute(
    "data-scene-status",
    "ready",
    { timeout: 30_000 },
  );
  await page.waitForTimeout(300);
};

const maxScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollHeight - innerHeight);

const seekToUmbrellaControl = async (page: Page) => {
  const control = page.locator("[data-umbrella-hit-target]");
  for (let progress = 0.76; progress <= 0.94; progress += 0.01) {
    await page.evaluate((ratio) => {
      const maximum = document.documentElement.scrollHeight - innerHeight;
      scrollTo(0, maximum * ratio);
    }, progress);
    await page.waitForTimeout(80);
    if (await control.isVisible()) return control;
  }
  return control;
};

test("scroll footprint stays constant through every narrative state", async ({
  page,
}) => {
  await ready(page);
  const initialMaximum = await maxScroll(page);
  const samples: number[] = [];
  const chapterStates = new Set<string>();

  for (const progress of [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.82, 0.92, 1]) {
    await page.evaluate((ratio) => {
      const maximum = document.documentElement.scrollHeight - innerHeight;
      scrollTo(0, maximum * ratio);
    }, progress);
    await page.waitForTimeout(100);
    samples.push(await maxScroll(page));
    chapterStates.add(
      (await page.locator("[data-experience-chapter]").getAttribute("class")) ?? "",
    );
  }

  expect(Math.max(...samples) - Math.min(...samples)).toBeLessThanOrEqual(1);
  expect(samples[0]).toBeCloseTo(initialMaximum, 0);
  expect([...chapterStates].some((value) => value.includes("--held"))).toBe(true);
  expect([...chapterStates].some((value) => value.includes("--overlay"))).toBe(true);
  expect([...chapterStates].some((value) => value.includes("--released"))).toBe(true);

  await page.evaluate(() =>
    scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.68),
  );
  await page.waitForTimeout(200);
  await page.mouse.move(
    Math.round((page.viewportSize()?.width ?? 800) / 2),
    Math.round((page.viewportSize()?.height ?? 600) / 2),
  );
  const beforeReverse = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, -480);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => scrollY)).toBeLessThan(beforeReverse);

  const beforeKeyboard = await page.evaluate(() => scrollY);
  await page.keyboard.press("PageDown");
  await expect
    .poll(() => page.evaluate(() => scrollY), { timeout: 1_000 })
    .toBeGreaterThan(beforeKeyboard);

  const beforeRepeatedInput = await page.evaluate(() => scrollY);
  for (let index = 0; index < 4; index += 1) {
    await page.mouse.wheel(0, 720);
  }
  await page.waitForTimeout(180);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(beforeRepeatedInput);
  expect(await maxScroll(page)).toBeCloseTo(initialMaximum, 0);
});

test("resize and reload settle to one stable scroll footprint", async ({
  page,
}, testInfo) => {
  await ready(page);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;

  await page.setViewportSize({ width: viewport.width, height: viewport.height + 48 });
  await page.waitForTimeout(900);
  const resizedMaximum = await maxScroll(page);
  await page.evaluate(() => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.88));
  await page.waitForTimeout(160);
  expect(await maxScroll(page)).toBeCloseTo(resizedMaximum, 0);

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-cinematic-scene]")).toHaveAttribute(
    "data-scene-status",
    "ready",
    { timeout: 30_000 },
  );
  await page.waitForTimeout(250);
  expect(await maxScroll(page)).toBeCloseTo(resizedMaximum, 0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(testInfo.project.name).toBeTruthy();
});

test("umbrella opens by pointer or keyboard and scrolling continues", async ({
  page,
}, testInfo) => {
  await ready(page);
  const control = await seekToUmbrellaControl(page);
  await expect(control).toBeVisible();
  await expect(control).toHaveAttribute("aria-expanded", "false");

  const directory = path.resolve("audit-results", "interaction", testInfo.project.name);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, "umbrella-closed.png") });

  if (testInfo.project.name === "desktop") {
    await control.focus();
    await page.keyboard.press("Enter");
  } else if (testInfo.project.name === "mobile") {
    await control.tap();
  } else {
    await control.click();
  }

  await expect(control).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-umbrella-status]")).toContainText(
    "umbrella is open",
    { timeout: 2_000 },
  );
  await page.waitForTimeout(950);
  await expect(page.locator("[data-umbrella-open]")).toHaveCSS("opacity", "1");
  await expect(page.locator("#umbrella-safe-title")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: path.join(directory, "umbrella-open.png") });

  const before = await page.evaluate(() => scrollY);
  const maximum = await maxScroll(page);
  const direction = maximum - before > 240 ? 1 : -1;
  await page.mouse.wheel(0, 480 * direction);
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => scrollY);
  expect(Math.sign(after - before)).toBe(direction);
});

test("Space activates the umbrella control", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One keyboard regression is sufficient");
  await ready(page);
  const control = await seekToUmbrellaControl(page);
  await control.focus();
  await page.keyboard.press("Space");
  await expect(control).toHaveAttribute("aria-expanded", "true");
});

test("pointer drag feeds the shared rain interaction field", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Pointer-field regression uses desktop");
  await ready(page);
  const canvas = page.locator("[data-experience-canvas]");
  await page.mouse.move(240, 300);
  await page.mouse.down();
  await page.mouse.move(1180, 620, { steps: 5 });
  await expect
    .poll(async () => Number((await canvas.getAttribute("data-motion-energy")) ?? 0))
    .toBeGreaterThan(0.04);
  await page.mouse.up();
});

test("native touch swipe advances the mobile narrative", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Touch regression uses the mobile project");
  await ready(page);
  const cdp = await page.context().newCDPSession(page);
  const x = Math.round((page.viewportSize()?.width ?? 390) / 2);
  const startY = 700;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: startY }],
  });
  for (const y of [620, 540, 460, 380, 300, 220]) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(250);
});
