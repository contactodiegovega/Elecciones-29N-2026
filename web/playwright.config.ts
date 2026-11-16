import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts$/,
  testIgnore: process.env.REVIEW_E2E === "1" ? /application\.spec\.ts$/ : /review\.spec\.ts$/,
  timeout: 45000,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4187",
    browserName: "chromium",
    channel: process.platform === "win32" ? "msedge" : undefined,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python scripts/preview.py --port 4187",
    url: "http://127.0.0.1:4187",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
