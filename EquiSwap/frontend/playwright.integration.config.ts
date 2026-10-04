import { defineConfig, devices } from "@playwright/test";

const FRONTEND_PORT = 4174;
const BACKEND_PORT = 8001;
const isCI = Boolean(process.env.CI);
const python = process.env.PYTHON ?? "python3";

// Dedicated ports so a local dev stack on 5173/8000 is never reused or touched.
// Runs the specs against the real FastAPI backend with a throwaway SQLite DB.
export default defineConfig({
  testDir: "./e2e/integration",
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  outputDir: "test-results/integration",
  reporter: isCI ? [["github"], ["html", { open: "never", outputFolder: "playwright-report/integration" }]] : "list",
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `${python} -m uvicorn app.main:app --port ${BACKEND_PORT}`,
      cwd: "../backend",
      url: `http://localhost:${BACKEND_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_URL: "sqlite:///./e2e.db",
        ALLOWED_ORIGINS: `http://localhost:${FRONTEND_PORT}`,
        JWT_SECRET_KEY: "e2e-test-secret",
        UPLOAD_DIR: "./e2e-uploads",
      },
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_BASE_URL: `http://localhost:${BACKEND_PORT}` },
    },
  ],
});
