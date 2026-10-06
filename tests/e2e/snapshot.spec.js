import { test, expect } from '@playwright/test';

test('the page does not refresh bundled data from ArcGIS', async ({ page }) => {
  await page.addInitScript(() => {
    window.__surreyTest = true;
  });
  const requests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).hostname.endsWith('arcgis.com')) requests.push(request.url());
  });
  await page.goto('./');
  await page.waitForFunction(() => window.__overlaysReady === true);
  await page.waitForLoadState('networkidle');
  expect(requests).toEqual([]);
  await page.locator('#open-methodology').click();
  await expect(page.locator('#methodology-content')).toContainText('uses the bundled snapshot');
});
