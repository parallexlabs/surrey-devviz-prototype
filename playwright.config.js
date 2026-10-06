import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:4173/demos/surrey/',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run serve:site',
    url: 'http://localhost:4173/demos/surrey/',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
