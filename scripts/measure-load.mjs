import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Chrome DevTools "Fast 4G" network preset (devtools-frontend NetworkManager.Fast4GConditions).
const FAST_4G = {
  offline: false,
  latency: 60 * 2.75,
  downloadThroughput: (9 * 1000 * 1000) / 8 * 0.9,
  uploadThroughput: (1.5 * 1000 * 1000) / 8 * 0.9,
  connectionType: 'cellular4g',
};

function startServer() {
  return new Promise((resolve) => {
    const proc = spawn('npm', ['run', 'serve:site'], {
      cwd: ROOT,
      stdio: 'pipe',
      shell: true,
    });
    setTimeout(() => resolve(proc), 2500);
  });
}

const server = await startServer();
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const client = await context.newCDPSession(page);
await client.send('Network.enable');
await client.send('Network.emulateNetworkConditions', FAST_4G);
await client.send('Network.setCacheDisabled', { cacheDisabled: true });

await page.addInitScript(() => {
  window.__surreyTest = true;
});
await page.goto('http://localhost:4173/demos/surrey/', { waitUntil: 'commit' });
await page.waitForFunction(() => {
  const list = document.querySelector('.project-list li button');
  const canvas = document.querySelector('#map canvas');
  return Boolean(list && canvas && canvas.width > 0);
});
const meaningful = await page.evaluate(() => performance.now());
const atMeaningful = await page.evaluate(() =>
  performance.getEntriesByType('resource').reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
);

await page.waitForFunction(() => window.__overlaysReady === true, null, { timeout: 60000 });
await page.waitForLoadState('networkidle');
const paints = await page.evaluate(() => {
  const paint = performance.getEntriesByType('paint');
  const resources = performance.getEntriesByType('resource');
  return {
    fcp: paint.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? null,
    transfer: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
    encoded: resources.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0),
    requests: resources.length,
    largest: resources
      .map((entry) => ({ name: entry.name.split('/').slice(-1)[0], size: entry.transferSize || 0 }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 8),
  };
});

console.log(JSON.stringify({
  profile: 'Fast 4G',
  latencyMs: FAST_4G.latency,
  downloadBytesPerSec: Math.round(FAST_4G.downloadThroughput),
  firstContentfulPaintMs: paints.fcp == null ? null : Math.round(paints.fcp),
  firstMeaningfulPaintMs: Math.round(meaningful),
  transferAtMeaningfulBytes: atMeaningful,
  transferAfterIdleBytes: paints.transfer,
  encodedBodyBytes: paints.encoded,
  requests: paints.requests,
  largest: paints.largest,
}, null, 2));

await browser.close();
server.kill();
