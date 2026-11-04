import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL: 'http://localhost:5180', browserName: 'chromium', viewport: { width: 1440, height: 1000 } },
  reporter: 'list',
  webServer: [
    { command: 'node ../server/scripts/startTestServer.js', url: 'http://127.0.0.1:5100', env: { E2E_API_PORT: '5100', E2E_APP_ORIGIN: 'http://localhost:5180' }, reuseExistingServer: false, timeout: 120000 },
    { command: 'npm run dev -- --port 5180', url: 'http://localhost:5180', env: { API_PROXY_TARGET: 'http://127.0.0.1:5100' }, reuseExistingServer: false, timeout: 60000 },
  ],
});
