import { expect, test } from "@playwright/test";

test("no-WebGL fallback keeps the complete umbrella interaction", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      contextId: string,
      ...args: unknown[]
    ) {
      if (/^webgl2?$/.test(contextId)) return null;
      return original.call(this, contextId, ...args as []) as RenderingContext | null;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page.locator("[data-cinematic-scene]")).toHaveAttribute(
    "data-scene-status",
    "fallback",
  );
  await expect(page.locator("[data-experience-fallback]")).toBeVisible();
  const control = page.locator("[data-umbrella-hit-target]");
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  await control.click();
  await expect(control).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-umbrella-open]")).toHaveCSS("opacity", "1");
  await expect(page.locator("#umbrella-safe-title")).toHaveCSS("opacity", "1");
});
