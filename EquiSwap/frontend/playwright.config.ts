import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e/mocked",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  outputDir: "test-results/mocked",
  reporter: isCI ? [["github"], ["html", { open: "never", outputFolder: "playwright-report/mocked" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
