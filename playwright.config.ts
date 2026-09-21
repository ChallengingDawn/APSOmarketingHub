import { defineConfig } from "@playwright/test";

export const TEST_SESSION_SECRET = "local-browser-tests-only-not-a-production-secret";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: "http://localhost:3100", viewport: { width: 1600, height: 1100 },
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER ? undefined : {
    command: "node node_modules/next/dist/bin/next start --port 3100",
    url: "http://localhost:3100/api/health", timeout: 120000,
    env: { SESSION_SECRET: TEST_SESSION_SECRET },
  },
});
