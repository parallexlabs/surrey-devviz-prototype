import { test, expect } from '@playwright/test';

test('the no-script summary is reachable and scrollable', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  await page.goto('http://localhost:4173/demos/surrey/');
  await expect(page.locator('.static-summary')).toHaveCount(1);
  await expect(page.locator('#main-content')).toBeVisible();
  await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#main-content');
  await expect(page.locator('.static-summary')).toContainText('Open Government License – City of Surrey');
  await expect(page.locator('.static-summary')).toContainText('OpenStreetMap contributors');
  await expect(page.locator('.static-summary')).toContainText('ODbL');
  await page.locator('.static-summary p').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.static-summary p').last()).toBeInViewport();
  await context.close();
});
