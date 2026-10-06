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
  await page.route('**/data/building_footprints.geojson', (route) => route.abort());
  await page.goto('./');
  await expect(page.getByRole('status')).toContainText('Optional overlays could not load');
  await expect(page.locator('#toggle-buildings')).toBeDisabled();
  await expect(page.locator('#toggle-plan')).toBeEnabled();
  await expect(page.locator('#project-list button').first()).toBeVisible();
  expect(errors).toEqual([]);
});
