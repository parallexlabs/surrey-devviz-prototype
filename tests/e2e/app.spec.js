import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { PNG } from 'pngjs';
import {
  assertCityCentreView,
  assertOverviewView,
  assertPilotMassingView,
  assertProjectPanel,
  loadPilotAreas,
  selectCityCentreProject,
  waitForCameraSettled,
} from '../helpers/mapAssertions.js';

const pilotAreas = loadPilotAreas();

function countBodyBackgroundPixels(pngPath, xMin = 354, xMax = 729, yMin = 52, yMax = 480) {
  const png = PNG.sync.read(readFileSync(pngPath));
  let count = 0;
  for (let y = yMin; y <= yMax; y += 1) {
    for (let x = xMin; x <= xMax; x += 1) {
      const i = (png.width * y + x) << 2;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      if (r === 247 && g === 248 && b === 250) count += 1;
    }
  }
  return count;
}

test.describe('Surrey DevViz prototype', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__cameraInstant = true;
    });
  });

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

  test('camera presets keep the map centered in Surrey', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-preset="overview"]', { timeout: 15000 });
    await waitForCameraSettled(page);

    const presets = [
      { id: 'overview', label: 'Surrey overview' },
      { id: 'city_centre', label: 'City Centre' },
      { id: 'fleetwood', label: 'Fleetwood', bbox: pilotAreas.fleetwood.bbox },
      { id: 'campbell_heights', label: 'Campbell Heights', bbox: pilotAreas.campbell_heights.bbox },
    ];

    for (const preset of presets) {
      await page.click(`[data-preset="${preset.id}"]`);
      if (preset.id === 'overview') await assertOverviewView(page, preset.label);
      else if (preset.id === 'city_centre') await assertCityCentreView(page, preset.label);
      else await assertPilotMassingView(page, preset.bbox, preset.label);
    }
  });

  test('guided tour keeps the map centered in Surrey on every step', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#start-tour', { timeout: 15000 });
    await page.locator('#start-tour').click();
    await assertOverviewView(page, 'tour step 1');

    let step = 1;
    const next = page.locator('#tour-next');
    while (!(await next.isDisabled())) {
      await next.click();
      step += 1;
      await waitForCameraSettled(page);
    }

    await page.locator('#tour-exit').click();
    await waitForCameraSettled(page);
  });

  test('selecting project from list shows distance and centers map in Surrey', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.project-list li button', { timeout: 15000 });
    await page.click('[data-preset="city_centre"]');
    await assertCityCentreView(page, 'City Centre preset');
    await selectCityCentreProject(page);
    await assertProjectPanel(page);
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
    await assertProjectPanel(page, 'keyboard-selected project');
  });

  test('no empty overlay covers the map when project panel is open', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/');
    await page.waitForSelector('.project-list li button', { timeout: 15000 });
    await page.click('[data-preset="city_centre"]');
    await waitForCameraSettled(page);
    await selectCityCentreProject(page);
    const shot = '/tmp/e2e-panel-overlay.png';
    await page.screenshot({ path: shot });
    const whitePixels = countBodyBackgroundPixels(shot);
    expect(whitePixels).toBeLessThan(1000);
    await assertProjectPanel(page, 'project panel open');
  });

  test('showcase view filters by default and all applications switch works', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.project-list li button', { timeout: 15000 });
    const showcaseCount = await page.locator('.project-list li').count();
    expect(showcaseCount).toBeGreaterThan(0);
    await page.locator('#toggle-all-apps').check();
    await page.waitForTimeout(300);
    const allCount = await page.locator('.project-list li').count();
    expect(allCount).toBeGreaterThanOrEqual(showcaseCount);
    await page.locator('#filter-status').selectOption({ label: 'Under Review' });
    const underReview = page.locator('.under-review-label');
    if (await underReview.count()) {
      await expect(underReview.first()).toHaveText('Under review');
    }
  });

  test('at a glance summary is shown', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#at-a-glance', { timeout: 15000 });
    await expect(page.locator('#at-a-glance')).toContainText(/Showcase projects/i);
    await expect(page.locator('#at-a-glance')).toContainText(/SkyTrain/i);
  });

  test('guided tour opens with keyboard controls', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#start-tour', { timeout: 15000 });
    await page.locator('#start-tour').click();
    await expect(page.locator('#tour-panel')).toBeVisible();
    await expect(page.locator('#tour-caption')).not.toBeEmpty();
    await page.locator('#tour-next').click();
    await expect(page.locator('#tour-title')).not.toBeEmpty();
    await page.keyboard.press('ArrowRight');
    await page.locator('#tour-exit').click();
    await expect(page.locator('#tour-panel')).toBeHidden();
  });

  test('licence attribution and disclaimer are visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.app-footer')).toContainText(
      'Contains information licensed under the Open Government License',
    );
    await expect(page.locator('.app-footer')).toContainText(
      'not affiliated with or endorsed by the City of Surrey',
    );
    await page.locator('#tab-about').click();
    await expect(page.locator('#about-content')).toContainText(
      'not affiliated with or endorsed by the City of Surrey',
    );
  });

  test('mobile viewport works', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForSelector('#map', { timeout: 15000 });
    await expect(page.locator('.sidebar')).toBeVisible();
    await selectCityCentreProject(page);
    await assertProjectPanel(page, 'mobile project selection');
  });
});
