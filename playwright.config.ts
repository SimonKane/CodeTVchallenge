import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/audit",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4321",
    launchOptions: {
      args: ["--disable-crash-reporter", "--disable-features=Crashpad"],
    },
    colorScheme: "dark",
    reducedMotion: "no-preference",
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1100 } },
    },
    {
      name: "tablet",
      use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, isMobile: false, hasTouch: true },
    },
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4321",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
