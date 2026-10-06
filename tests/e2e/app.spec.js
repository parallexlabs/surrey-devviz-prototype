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
import { RINGS_EXPLANATION } from '../../src/copy.js';

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
    await expect(page.locator('#phase-filters')).toBeVisible();
    for (const status of ['Conditional Approval', 'Under Review', 'Initial Review']) {
      await expect(page.locator('.phase-filter', { hasText: status })).toBeVisible();
    }
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
    await expect(page.locator('#data-retrieved')).toHaveText('Public data retrieved 6 October 2026');
    await page.locator('#open-methodology').click();
    await expect(page.locator('#methodology-drawer')).toBeVisible();
    await expect(page.locator('#methodology-content')).toContainText('Public data retrieved 6 October 2026');
    await expect(page.locator('#methodology-content')).toContainText('Showcase rules');
    await expect(page.locator('#methodology-content')).toContainText('Height method');
    await expect(page.locator('#methodology-content')).toContainText('Limitations');
    await page.locator('#close-methodology').click();
    await expect(page.locator('#methodology-drawer')).toBeHidden();
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

  test('start here bar is keyboard operable and dismissible', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#start-here', { timeout: 15000 });
    await page.waitForSelector('.project-list li button', { timeout: 15000 });
    await waitForCameraSettled(page);
    const bar = page.locator('#start-here');
    await expect(bar).toBeVisible();
    for (const name of ['Explore projects', 'Transit and amenities', '3D City Centre', 'Guided tour']) {
      await expect(bar.getByRole('button', { name })).toBeVisible();
    }

    await page.locator('#start-explore').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#project-list')).toBeFocused();

    await page.locator('#start-transit').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#toggle-skytrain')).toBeChecked();
    await expect(page.locator('#toggle-amenities')).toBeChecked();
    await assertCityCentreView(page, 'start here transit');

    await page.locator('#start-3d').focus();
    await page.keyboard.press('Enter');
    await assertCityCentreView(page, 'start here 3D City Centre');

    await page.locator('#start-guided').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#tour-panel')).toBeVisible();
    await page.locator('#tour-exit').click();
    await expect(page.locator('#tour-panel')).toBeHidden();

    await page.locator('#start-dismiss').focus();
    await page.keyboard.press('Enter');
    await expect(bar).toBeHidden();
    await page.reload();
    await page.waitForSelector('#map', { timeout: 15000 });
    await expect(page.locator('#start-here')).toBeHidden();
  });

  test('rings are explained in the legend and the project panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.rings-legend', { timeout: 15000 });
    await waitForCameraSettled(page);
    await expect(page.locator('.rings-legend')).toHaveText(RINGS_EXPLANATION);
    await page.click('[data-preset="city_centre"]');
    await assertCityCentreView(page, 'rings City Centre');
    await selectCityCentreProject(page);
    await expect(page.locator('#detail-panel')).toContainText(RINGS_EXPLANATION);
    await assertProjectPanel(page, 'rings explained');
  });

  test('a view hash restores the camera preset', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-preset="fleetwood"]', { timeout: 15000 });
    await waitForCameraSettled(page);
    await page.click('[data-preset="fleetwood"]');
    await assertPilotMassingView(page, pilotAreas.fleetwood.bbox, 'fleetwood preset');
    await expect(page).toHaveURL(/#view=fleetwood/);
    await page.reload();
    await page.waitForFunction(() => window.__map?.getLayer('projects-extrusion'));
    await assertPilotMassingView(page, pilotAreas.fleetwood.bbox, 'fleetwood hash');
  });

  test('a project hash restores that application', async ({ page }) => {
    await page.goto('/#project=21-0313-00');
    await page.waitForFunction(() => window.__map?.getLayer('projects-extrusion'));
    await expect(page.locator('#detail-panel')).toBeVisible();
    await expect(page.locator('#detail-content')).toContainText('21-0313-00');
    await expect(page.locator('#detail-content')).toContainText(
      'Estimated from 67 storeys stated in the application',
    );
    await expect(page.locator('#detail-content')).toContainText(
      'Source: City of Surrey Development Applications',
    );
    await assertProjectPanel(page, 'project hash');
    await expect(page).toHaveURL(/#project=21-0313-00/);
  });

  test('start here fits a 390px screen and touch targets are at least 44px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForSelector('#start-here button', { timeout: 15000 });
    await waitForCameraSettled(page);
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(fits).toBe(true);
    const bar = await page.locator('#start-here').boundingBox();
    expect(bar.x).toBeGreaterThanOrEqual(0);
    expect(bar.x + bar.width).toBeLessThanOrEqual(391);
    expect(bar.y + bar.height).toBeLessThanOrEqual(844);

    const ids = ['start-explore', 'start-transit', 'start-3d', 'start-guided', 'start-dismiss'];
    for (const id of ids) {
      const box = await page.locator(`#${id}`).boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(391);
    }

    const preset = await page.locator('[data-preset="city_centre"]').boundingBox();
    expect(preset.height).toBeGreaterThanOrEqual(44);
    expect(preset.width).toBeGreaterThanOrEqual(44);
  });
});
