import { test, expect } from '@playwright/test';

test('a failed basemap preserves the non-map interface', async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/styles/liberty', (route) => route.abort());
  await page.goto('./');
  await expect(page.getByRole('status')).toContainText('The map is unavailable');
  await page.locator('#project-list button').first().click();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('#detail-content')).toContainText('Application status:');
  await page.locator('#close-detail').click();
  await page.locator('#civic-list button').first().click();
  await expect(page.locator('#detail-content a')).toHaveAttribute('href', /^https?:/);
  await page.locator('#open-methodology').click();
  await expect(page.locator('#methodology-drawer')).toBeVisible();
});

test('optional overlay errors are handled', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/data/city_centre_plan.geojson', (route) => route.abort());
  await page.goto('./');
  await expect(page.getByRole('status')).toContainText('Optional overlays could not load');
  await expect(page.locator('#toggle-plan')).toBeDisabled();
  await expect(page.locator('#toggle-buildings')).toBeEnabled();
  await expect(page.locator('#project-list button').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('building footprints load only after the toggle is checked', async ({ page }) => {
  const hits = [];
  page.on('request', (request) => {
    if (request.url().includes('building_footprints.geojson')) hits.push(request.url());
  });
  await page.goto('./');
  await page.waitForSelector('#map canvas');
  await page.waitForLoadState('networkidle');
  expect(hits).toEqual([]);
  await page.locator('#toggle-buildings').check();
  await expect.poll(() => hits.length).toBe(1);
});

test('a failed building footprint load disables only that toggle', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/data/building_footprints.geojson', (route) => route.abort());
  await page.goto('./');
  await page.waitForSelector('#map canvas');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-overlay-status]')).toHaveCount(0);
  await page.locator('#toggle-buildings').click();
  await expect(page.getByRole('status')).toContainText('Optional overlays could not load');
  await expect(page.locator('#toggle-buildings')).toBeDisabled();
  await expect(page.locator('#toggle-plan')).toBeEnabled();
  expect(errors).toEqual([]);
});
