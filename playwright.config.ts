import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PARAPLY_TEST_BASE_URL;
const baseURL = externalBaseUrl ?? "http://127.0.0.1:4321";
const browserChannel = process.env.PARAPLY_BROWSER_CHANNEL;
const headful = process.env.PARAPLY_HEADFUL === "1";

export default defineConfig({
  testDir: "./tests/audit",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: "line",
  use: {
    baseURL,
    ...(browserChannel === "chromium"
      ? {}
      : { channel: browserChannel ?? "chrome" }),
    headless: !headful,
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
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run build && vite preview --host 127.0.0.1 --port 4321",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
