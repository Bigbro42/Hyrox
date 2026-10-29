import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * E2E tests run the built app (dist/) under /Hyrox/, like GitHub Pages. Only Chromium is
 * available in this environment; the iPhone profiles emulate viewport, touch and user agent but
 * not Safari's engine.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/Hyrox/`,
    locale: 'de-AT',
    timezoneId: 'Europe/Vienna',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'iphone-se', use: { ...devices['iPhone SE'], browserName: 'chromium', defaultBrowserType: 'chromium' } },
    { name: 'iphone-15', use: { ...devices['iPhone 15'], browserName: 'chromium', defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'node scripts/static-server.mjs',
    env: { PORT: String(PORT), ...(process.env.E2E_PUBLISHED ? { E2E_PUBLISHED: '1' } : {}) },
    url: `http://127.0.0.1:${PORT}/Hyrox/`,
    reuseExistingServer: false,
  },
});
