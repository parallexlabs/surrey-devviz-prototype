import { test, expect } from '@playwright/test';

test('map controls stay inside a short desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('./');
  await page.waitForSelector('.rings-legend');
  const controls = page.locator('.map-controls');
  const metrics = await controls.evaluate((el) => ({
    overflow: getComputedStyle(el).overflowY,
    scroll: el.scrollHeight,
    client: el.clientHeight,
  }));
  expect(metrics.overflow).toBe('auto');
  expect(metrics.scroll).toBeGreaterThan(metrics.client);
  const legend = page.locator('.rings-legend');
  await legend.scrollIntoViewIfNeeded();
  await expect(legend).toBeInViewport();
  const mapBox = await page.locator('.map-area').boundingBox();
  const controlsBox = await controls.boundingBox();
  expect(controlsBox.y + controlsBox.height).toBeLessThanOrEqual(mapBox.y + mapBox.height + 1);
});

test('civic markers stay on after the showcase returns to Surrey', async ({ page }) => {
  await page.addInitScript(() => {
    window.__surreyTest = true;
    window.__cameraInstant = true;
  });
  await page.goto('./');
  await page.waitForFunction(() => window.__map?.getLayer('civic-symbols'));
  await expect(page.locator('#toggle-civic')).toBeChecked();
  await page.locator('#start-showcase').click();
  await page.locator('#tour-next').click();
  await expect(page.locator('#toggle-civic')).not.toBeChecked();
  await page.locator('#tour-exit').click();
  await expect(page).toHaveURL(/view=overview/);
  await expect(page.locator('#toggle-civic')).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.__map.getLayoutProperty('civic-symbols', 'visibility') || 'visible')).toBe('visible');
});
