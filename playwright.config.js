import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run serve:dist',
    port: 4173,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
