import { test, expect } from '@playwright/test';

test.describe('Surrey DevViz prototype', () => {
  test('page loads with no console errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForSelector('#map', { timeout: 15000 });
    await page.waitForSelector('.project-list li button', { timeout: 15000 });
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('layer toggles work', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map', { timeout: 15000 });
    const ftda = page.locator('#toggle-ftda');
    await ftda.check();
    await expect(ftda).toBeChecked();
    await ftda.uncheck();
    await expect(ftda).not.toBeChecked();
  });

  test('keyboard path from skip link to project panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.project-list li button', { timeout: 15000 });
    await page.keyboard.press('Tab');
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const firstProject = page.locator('.project-list li button').first();
    await firstProject.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#detail-panel')).toBeVisible();
  });

  test('selecting project from list shows distance', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.project-list li button', { timeout: 15000 });
    await page.locator('.project-list li button').first().click();
    await expect(page.locator('#detail-panel')).toBeVisible();
    await expect(page.locator('.proximity')).toContainText(/m|km|SkyTrain/);
  });

  test('mobile viewport works', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForSelector('#map', { timeout: 15000 });
    await expect(page.locator('.sidebar')).toBeVisible();
    await page.locator('.project-list li button').first().click();
    await expect(page.locator('#detail-panel')).toBeVisible();
  });
});
