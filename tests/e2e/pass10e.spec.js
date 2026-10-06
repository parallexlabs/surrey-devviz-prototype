import { test, expect } from '@playwright/test';

test('third-party requests stay on OpenFreeMap and the page stores nothing', async ({ page }) => {
  const hosts = new Set();
  page.on('request', (request) => {
    hosts.add(new URL(request.url()).hostname);
  });
  await page.goto('./');
  await page.waitForSelector('#map canvas');
  await page.locator('#start-showcase').click();
  await page.locator('#tour-exit').click();
  await page.locator('#open-methodology').click();
  await expect(page.locator('#methodology-drawer')).toBeVisible();
  await page.locator('#close-methodology').click();
  await page.waitForLoadState('networkidle');
  const allowed = new Set(['localhost', '127.0.0.1', 'tiles.openfreemap.org']);
  expect([...hosts].filter((host) => !allowed.has(host))).toEqual([]);
  expect(hosts.has('tiles.openfreemap.org')).toBe(true);
  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
    cookie: document.cookie,
  }));
  expect(storage).toEqual({ local: 0, session: 0, cookie: '' });
});

test('the built page reports no content security policy violations', async ({ page }) => {
  const violations = [];
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  page.on('console', (message) => {
    if (/content security policy|refused to/i.test(message.text())) violations.push(message.text());
  });
  const urls = [];
  page.on('request', (request) => urls.push(request.url()));
  await page.goto('./');
  await page.waitForSelector('#map canvas');
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#map canvas');
    return Boolean(canvas && canvas.width > 0);
  });
  await page.locator('#start-showcase').click();
  await expect(page.locator('#tour-panel')).toBeVisible();
  await page.locator('#tour-exit').click();
  await page.locator('#open-methodology').click();
  await expect(page.locator('#methodology-drawer')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(urls.some((url) => url.includes('tiles.openfreemap.org/styles/liberty'))).toBe(true);
  expect(urls.some((url) => url.includes('.pbf'))).toBe(true);
  expect(urls.some((url) => url.includes('/sprites/'))).toBe(true);
  expect(urls.some((url) => url.includes('/fonts/'))).toBe(true);
  expect(urls.some((url) => url.includes('maplibre-gl-worker'))).toBe(true);
  const reported = await page.evaluate(() => window.__cspViolations);
  expect(reported).toEqual([]);
  expect(violations).toEqual([]);
});
