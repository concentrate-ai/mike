import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:4000",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "cd ../backend && npm run dev",
      port: 4001,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "cd ../frontend && npm run dev",
      port: 4000,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
