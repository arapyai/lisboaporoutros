import { defineConfig, devices } from '@playwright/test';

const api = process.env.LISBOA_EDITORIAL_API;
const port = Number(process.env.LISBOA_EDITORIAL_FRONTEND_PORT);
if (!api || !/^http:\/\/127\.0\.0\.1:\d+$/.test(api) || !Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('Use scripts/test-editorial-browser.sh with its isolated local API.');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'editorial-backend.spec.ts',
  workers: 1,
  outputDir: `test-results/editorial/${process.env.LISBOA_EDITORIAL_BROWSER}-${process.env.LISBOA_EDITORIAL_WIDTH}`,
  retries: 0,
  timeout: 120_000,
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: `npm run dev --workspace @ecosdelisboa/admin -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: { VITE_API_BASE_URL: api, VITE_ENABLE_MOCKS: 'false', VITE_MAPTILER_KEY: '' }
  },
  projects: [
    { name: 'editorial-chromium', use: { ...devices['Desktop Chrome'], launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} } },
    { name: 'editorial-firefox', use: { ...devices['Desktop Firefox'], launchOptions: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH } : {} } },
    { name: 'editorial-webkit', use: { ...devices['Desktop Safari'], launchOptions: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : {} } }
  ]
});
