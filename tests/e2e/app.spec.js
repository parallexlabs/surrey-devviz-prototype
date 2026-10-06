import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PNG } from 'pngjs';
import {
  assertCityCentreView,
  assertOverviewFraming,
  assertOverviewView,
  assertPilotMassingView,
  assertProjectPanel,
  getMapCenter,
  loadPilotAreas,
  readOverviewDecoration,
  selectCityCentreProject,
  waitForCameraSettled,
} from '../helpers/mapAssertions.js';
import { RINGS_EXPLANATION } from '../../src/copy.js';
import { geometryContains } from '../../src/data.js';

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
      window.__surreyTest = true;
      window.__cameraInstant = true;
    });
  });

  test('page loads with no console errors', async ({ page }) => {
    await page.addInitScript(() => {
      window.__surreyTest = true;
      window.__cameraInstant = false;
    });
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error' && msg.type() !== 'warning') return;
      if (msg.text().includes('GL Driver Message')) return;
      errors.push(`${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('./');
    await page.waitForSelector('#map', { timeout: 15000 });
    await page.waitForSelector('.project-list li button', { timeout: 15000 });
    await page.waitForTimeout(1000);
    expect(errors).toEqual([]);
  });

  test('camera presets keep the map centered in Surrey', async ({ page }) => {
    await page.goto('./');
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
    await page.goto('./');
    await page.waitForSelector('#start-showcase', { timeout: 15000 });
    await page.locator('#start-showcase').click();
    await assertCityCentreView(page, 'tour step 1');

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
    await page.goto('./');
    await page.waitForSelector('.project-list li button', { timeout: 15000 });
    await page.click('[data-preset="city_centre"]');
    await assertCityCentreView(page, 'City Centre preset');
    await selectCityCentreProject(page);
    await assertProjectPanel(page);
  });

  test('layer toggles work', async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('#map', { timeout: 15000 });
    const ftda = page.locator('#toggle-ftda');
    await ftda.check();
    await expect(ftda).toBeChecked();
    await ftda.uncheck();
    await expect(ftda).not.toBeChecked();
  });

  test('keyboard path from skip link to project panel', async ({ page }) => {
    await page.goto('./');
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
    await page.goto('./');
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
    await page.goto('./');
    await page.waitForSelector('.project-list li button', { timeout: 15000 });
    const showcaseCount = await page.locator('.project-list li').count();
    expect(showcaseCount).toBe(49);
    expect(await page.locator('#civic-list li').count()).toBe(6);
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
    await page.goto('./');
    await page.waitForSelector('#at-a-glance', { timeout: 15000 });
    await expect(page.locator('#at-a-glance')).toContainText(/Showcase projects/i);
    await expect(page.locator('#at-a-glance')).toContainText(/SkyTrain/i);
  });

  test('tallest summary keeps the project number in a nowrap span', async ({ page }) => {
    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('./');
      await page.waitForSelector('#at-a-glance', { timeout: 15000 });
      const tallest = page.locator('#at-a-glance .summary-project');
      await expect(tallest).toHaveCount(1);
      await expect(tallest).toHaveText('21-0313-00');
      await expect(page.locator('#at-a-glance')).toContainText('Tallest: 67 storeys');
    }
  });

  test('guided tour opens with keyboard controls', async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('#start-showcase', { timeout: 15000 });
    await page.locator('#start-showcase').click();
    await expect(page.locator('#tour-panel')).toBeVisible();
    await expect(page.locator('#tour-caption')).not.toBeEmpty();
    await page.locator('#tour-next').click();
    await expect(page.locator('#tour-title')).not.toBeEmpty();
    await page.keyboard.press('ArrowRight');
    await page.locator('#tour-exit').click();
    await expect(page.locator('#tour-panel')).toBeHidden();
  });

  test('licence attribution and disclaimer are visible', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.app-footer')).toContainText(
      'Contains information licensed under the Open Government License',
    );
    await expect(page.locator('.app-footer')).toContainText(
      'Not affiliated with or endorsed by the City of Surrey',
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
    await page.goto('./');
    await page.waitForSelector('#map', { timeout: 15000 });
    await expect(page.locator('.sidebar')).toBeVisible();
    await selectCityCentreProject(page);
    await assertProjectPanel(page, 'mobile project selection');
  });

  test('opening actions start the showcase or move to the list', async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('#start-showcase', { timeout: 15000 });
    await page.waitForSelector('.project-list li button', { timeout: 15000 });
    await waitForCameraSettled(page);
    await expect(page.locator('h1')).toHaveText("Explore Surrey's development and destinations");
    await expect(page.locator('.what-this-is')).toHaveText(
      'Approved development projects alongside civic investments, transit and places to visit in three Surrey pilot areas.',
    );
    await expect(page.getByRole('button', { name: 'Start the showcase' })).toHaveCount(1);
    await expect(page.locator('.quiet-line')).toContainText(
      'Independent public-data prototype by ParalleX Labs Inc. Not affiliated with or endorsed by the City of Surrey.',
    );
    await expect(page.locator('#area-card')).toContainText('43 selected records in this prototype');
    await expect(page.locator('#area-card')).toContainText(
      "A public-data selection, not a complete inventory or the City's final showcase list.",
    );

    await page.locator('#browse-list').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#project-list')).toBeFocused();

    await page.locator('#start-showcase').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#tour-panel')).toBeVisible();
    await expect(page.locator('#tour-title')).toHaveText('Development and destinations in City Centre');
    await page.locator('#tour-exit').click();
    await expect(page.locator('#tour-panel')).toBeHidden();
    await expect(page.locator('#start-showcase')).toBeFocused();
  });

  test('rings are explained in the legend and the project panel', async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('.rings-legend', { timeout: 15000 });
    await waitForCameraSettled(page);
    await expect(page.locator('.rings-legend')).toHaveText(RINGS_EXPLANATION);
    await page.click('[data-preset="city_centre"]');
    await assertCityCentreView(page, 'rings City Centre');
    await selectCityCentreProject(page);
    await expect(page.locator('#detail-panel')).toContainText('straight-line (not a walking route)');
    await expect(page.locator('#detail-panel')).not.toContainText('5-minute walk');
    await assertProjectPanel(page, 'rings explained');
  });

  test('a view hash restores the camera preset', async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('[data-preset="fleetwood"]', { timeout: 15000 });
    await waitForCameraSettled(page);
    await page.click('[data-preset="fleetwood"]');
    await assertPilotMassingView(page, pilotAreas.fleetwood.bbox, 'fleetwood preset');
    await expect(page).toHaveURL(/\/demos\/surrey\/.*#view=fleetwood/);
    await page.reload();
    await page.waitForFunction(() => window.__map?.getLayer('projects-extrusion'));
    await assertPilotMassingView(page, pilotAreas.fleetwood.bbox, 'fleetwood hash');
  });

  test('a project hash restores that application', async ({ page }) => {
    await page.goto('./#project=21-0313-00');
    await page.waitForFunction(() => window.__map?.getLayer('projects-extrusion'));
    await expect(page.locator('#detail-panel')).toBeVisible();
    await expect(page.locator('#detail-content')).toContainText('21-0313-00');
    await expect(page.locator('#detail-content')).toContainText(
      'Estimated height about 214.4 m: 67 storeys stated in the application x 3.2 m. Not a surveyed or approved height.',
    );
    await expect(page.locator('#detail-content')).toContainText('Application status: Conditional Approval');
    await expect(page.locator('#detail-content')).toContainText("View the City's application record");
    await expect(page.locator('#detail-content')).toContainText(
      'Source: City of Surrey Development Applications',
    );
    await expect(page.locator('.status-line + .context-line')).toHaveText(
      'Development context only. Property availability and investment terms are not shown.',
    );
    await expect(page.locator('#detail-content')).toContainText('Schematic application-area extrusion');
    await expect(page.getByRole('link', { name: "View the City's application record" })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    await assertProjectPanel(page, 'project hash');
    await expect(page).toHaveURL(/\/demos\/surrey\/.*#project=21-0313-00/);
  });

  test('the published page asks crawlers not to index it', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  });

  test('Campbell Heights sits on the official local area plans', async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('[data-preset="campbell_heights"]', { timeout: 15000 });
    await page.click('[data-preset="campbell_heights"]');
    await assertPilotMassingView(page, pilotAreas.campbell_heights.bbox, 'Campbell Heights official extent');
    const center = await getMapCenter(page);
    const area = pilotAreas.campbell_heights;
    expect(area.bbox[0]).toBeGreaterThan(-122.72);
    expect(area.bbox[2]).toBeLessThan(-122.67);
    expect(area.bbox[1]).toBeGreaterThan(49.01);
    expect(area.bbox[3]).toBeLessThan(49.09);
    expect(geometryContains(area.geometry, center.lng, center.lat)).toBe(true);

    const projects = JSON.parse(
      readFileSync(join(process.cwd(), 'public/data/development_projects.geojson'), 'utf8'),
    );
    const tagged = projects.features.filter((feature) => feature.properties.pilot_area === 'campbell_heights');
    expect(tagged.length).toBeGreaterThan(0);
    for (const feature of tagged) {
      const { assign_lon: lon, assign_lat: lat } = feature.properties;
      expect(geometryContains(area.geometry, lon, lat)).toBe(true);
      expect(geometryContains(feature.geometry, lon, lat)).toBe(true);
    }
  });

  test('overview shows the three pilot areas without amenity clutter', async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('[data-preset="overview"]', { timeout: 15000 });
    await page.click('[data-preset="overview"]');
    await assertOverviewView(page, 'pilot overview');
    const view = await readOverviewDecoration(page);
    expect(view.amenities).toBeLessThan(30);
    expect(view.names).toEqual(['Campbell Heights', 'City Centre', 'Fleetwood Town Centre']);
    expect(view.markers).toBeGreaterThan(10);
  });

  test('start here fits a 390px screen and touch targets are at least 44px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    await page.waitForSelector('#start-showcase', { timeout: 15000 });
    await waitForCameraSettled(page);
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(fits).toBe(true);
    await page.locator('.header-actions').scrollIntoViewIfNeeded();
    const bar = await page.locator('.header-actions').boundingBox();
    expect(bar.x).toBeGreaterThanOrEqual(0);
    expect(bar.x + bar.width).toBeLessThanOrEqual(391);
    expect(bar.y).toBeGreaterThanOrEqual(0);
    expect(bar.y + bar.height).toBeLessThanOrEqual(844);

    const ids = ['start-showcase', 'browse-list', 'open-methodology'];
    for (const id of ids) {
      const target = page.locator(`#${id}`);
      await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(391);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(844);
    }

    const preset = await page.locator('[data-preset="city_centre"]').boundingBox();
    expect(preset.height).toBeGreaterThanOrEqual(44);
    expect(preset.width).toBeGreaterThanOrEqual(44);
  });

  test('one attribution control lists the map credits', async ({ page }) => {
    await page.goto('./');
    const attrib = page.locator('.maplibregl-ctrl-attrib');
    await expect(attrib).toHaveCount(1);
    await expect(attrib).toContainText('OpenStreetMap', { timeout: 15000 });
    const visibleCredits = async () =>
      page.locator('.maplibregl-ctrl-attrib').evaluate((el) => {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('.visually-hidden').forEach((node) => node.remove());
        return clone.textContent.replace(/\s+/g, ' ');
      });
    const text = await visibleCredits();
    const credit = 'MapLibre | OpenFreeMap © OpenMapTiles © OpenStreetMap contributors';
    expect(text).toContain(credit);
    const links = page.locator('.maplibregl-ctrl-attrib a');
    await expect(links).toHaveCount(4);
    const expected = [
      ['https://maplibre.org/', 'MapLibre'],
      ['https://openfreemap.org/', 'OpenFreeMap'],
      ['https://openmaptiles.org/', '© OpenMapTiles'],
      ['https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors'],
    ];
    for (const [index, [href, label]] of expected.entries()) {
      const link = links.nth(index);
      await expect(link).toHaveAttribute('href', href);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(link.locator('.visually-hidden')).toHaveText('(opens in a new tab)');
      await expect(link).toContainText(label);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    expect(await visibleCredits()).toContain(credit);
  });

  test('overview frames every pilot area', async ({ page }) => {
    for (const size of [
      { width: 1600, height: 1000 },
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.goto('./');
      await page.waitForSelector('[data-preset="overview"]', { timeout: 15000 });
      await page.click('[data-preset="overview"]');
      await assertOverviewFraming(page, `${size.width}x${size.height}`);
    }
  });

  test('project panel keeps the full title clear of the close button', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./#project=21-0313-00');
    await page.waitForSelector('#detail-title', { timeout: 15000 });
    const title = page.locator('#detail-title');
    await expect(title).toContainText('consisting of');
    await expect(title).not.toContainText('…');
    const overlap = await page.evaluate(() => {
      const heading = document.getElementById('detail-title').getBoundingClientRect();
      const button = document.getElementById('close-detail').getBoundingClientRect();
      const overlapX = Math.min(heading.right, button.right) - Math.max(heading.left, button.left);
      const overlapY = Math.min(heading.bottom, button.bottom) - Math.max(heading.top, button.top);
      return overlapX > 0 && overlapY > 0;
    });
    expect(overlap).toBe(false);
    await expect(page.locator('#close-detail')).toBeFocused();
  });

  test('escape closes the project panel and restores focus', async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('.project-list li button', { timeout: 15000 });
    const opener = page.locator('.project-list li button').first();
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#detail-panel')).toBeVisible();
    await expect(page.locator('#close-detail')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#detail-panel')).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('reduced motion jumps the camera instead of flying', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    await page.waitForSelector('[data-preset="city_centre"]', { timeout: 15000 });
    await waitForCameraSettled(page);
    await page.evaluate(() => {
      window.__cameraInstant = false;
      window.__flew = 0;
      const original = window.__map.flyTo.bind(window.__map);
      window.__map.flyTo = (...args) => {
        window.__flew += 1;
        return original(...args);
      };
    });
    await page.click('[data-preset="city_centre"]');
    await page.waitForTimeout(250);
    const flew = await page.evaluate(() => window.__flew);
    expect(flew).toBe(0);
    const moving = await page.evaluate(() => window.__map.isMoving());
    expect(moving).toBe(false);
    await assertCityCentreView(page, 'reduced motion');
  });

  test('320px width reflows without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('./');
    await page.waitForSelector('#map', { timeout: 15000 });
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(fits).toBe(true);
    await expect(page.locator('.what-this-is')).toBeVisible();
    await expect(page.locator('#open-methodology')).toBeVisible();
    await expect(page.locator('[data-preset="overview"]')).toBeVisible();
  });

  test('about states that the page does not track visitors', async ({ page }) => {
    await page.goto('./');
    await page.locator('#tab-about').click();
    await expect(page.locator('#about-content')).toContainText('does not use tracking or cookies');
    await expect(page.locator('#about-content')).toContainText(
      'Third-party requests are limited to OpenFreeMap (style, tiles, fonts).',
    );
    await expect(page.locator('#about-content')).toContainText(
      'prepared in response to City of Surrey RFP 1220-030-2026-063',
    );
    await expect(page.locator('#about-content a[href$="data/README.md"]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /Data sources/ })).toBeVisible();
    await expect(page.locator('#about-content h3')).toHaveCount(0);
    await expect(page.locator('#about-content')).toContainText(
      'Tested with axe-core: 0 automatically detected violations in the tested states, plus manual keyboard testing.',
    );
    await expect(page.locator('#about-content')).not.toContainText('screen reader');
  });

  test('civic places open their own card and stay out of the project count', async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('#civic-list li button', { timeout: 15000 });
    await expect(page.locator('#toggle-civic')).toBeChecked();
    await page.locator('#civic-list li button', { hasText: 'City Centre Arena (planned)' }).click();
    await expect(page.locator('#detail-title')).toHaveText('City Centre Arena (planned)');
    await expect(page.locator('#detail-content')).toContainText('Civic investment');
    await expect(page.locator('#detail-content')).toContainText('demolition had begun');
    await expect(page.locator('#detail-content a')).toContainText("Read the City's update");
    await expect(page.locator('#detail-content a')).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(page.locator('.project-list li')).toHaveCount(49);
  });

  test('showcase tour visits the five stops and opens the matching cards', async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('#start-showcase', { timeout: 15000 });
    await page.locator('#start-showcase').click();
    const titles = [
      'Development and destinations in City Centre',
      'A major project and its transit context',
      'Civic investment: City Centre Arena',
      'Fleetwood Town Centre',
      'Campbell Heights',
    ];
    for (let index = 0; index < titles.length; index += 1) {
      await expect(page.locator('#tour-title')).toHaveText(titles[index]);
      if (index === 1) {
        await expect(page.locator('#detail-content')).toContainText('21-0313-00');
        await expect(page.locator('#detail-content')).toContainText('not a walking route');
        await expect(page.locator('#toggle-skytrain')).toBeChecked();
        await expect(page.locator('#toggle-civic')).not.toBeChecked();
      }
      if (index === 2) {
        await expect(page.locator('#detail-title')).toHaveText('City Centre Arena (planned)');
        await expect(page.locator('#toggle-civic')).toBeChecked();
      }
      if (index === 3) {
        await expect(page.locator('#area-card')).toContainText('Fleetwood Town Centre');
        await expect(page.locator('#area-card')).toContainText('2 selected records in this prototype');
        await expect(page.locator('#area-card a')).toHaveAttribute('href', /fleetwood-town-centre-plan/);
        await expect(page.locator('#area-card a')).toContainText('Fleetwood Town Centre Plan on surrey.ca');
      }
      if (index === titles.length - 1) {
        await expect(page.locator('#tour-closing')).toHaveText(
          'Explore a project, open its City source, or share this view.',
        );
        await expect(page.locator('#tour-next')).toBeDisabled();
      } else {
        await page.locator('#tour-next').click();
      }
    }
    await page.locator('#tour-prev').click();
    await expect(page.locator('#tour-title')).toHaveText('Fleetwood Town Centre');
    await page.locator('#tour-exit').click();
    await expect(page.locator('#start-showcase')).toBeFocused();
  });

  test('a missing project still applies a valid view', async ({ page }) => {
    await page.goto('./#view=fleetwood&project=missing');
    await page.waitForFunction(() => window.__map?.getLayer('projects-extrusion'));
    await assertPilotMassingView(page, pilotAreas.fleetwood.bbox, 'missing project hash');
    await expect(page.locator('#detail-panel')).toBeHidden();
  });

  test('methodology is modal and returns focus', async ({ page }) => {
    await page.goto('./');
    await page.waitForSelector('#open-methodology');
    await page.locator('#open-methodology').click();
    await expect(page.locator('#methodology-drawer')).toBeVisible();
    await expect(page.locator('#sidebar')).toHaveJSProperty('inert', true);
    await expect(page.locator('#map')).toHaveJSProperty('inert', true);
    await expect(page.locator('.map-controls')).toContainText(
      'Application areas are extruded uniformly for illustration. They are not proposed building footprints or approved architectural massing.',
    );
    await expect(page.locator('#methodology-content')).toContainText(
      'Application areas are extruded uniformly for illustration. They are not proposed building footprints or approved architectural massing.',
    );
    await page.locator('#close-methodology').click();
    await expect(page.locator('#open-methodology')).toBeFocused();
    await expect(page.locator('#sidebar')).toHaveJSProperty('inert', false);
  });

  test('phase filter buttons keep focus', async ({ page }) => {
    await page.goto('./');
    await page.locator('#toggle-all-apps').check();
    const button = page.locator('.phase-filter', { hasText: 'Conditional Approval' });
    await button.click();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  test('the built page includes a no-javascript summary', async ({ request }) => {
    const html = await (await request.get('./')).text();
    expect(html).toContain('<noscript>');
    expect(html).toContain("Explore Surrey's development and destinations");
    const places = html.match(/<h2>Civic investments and destinations<\/h2>\s*<ul>([\s\S]*?)<\/ul>/);
    expect(places[1].match(/<li>/g)).toHaveLength(6);
    const projects = html.match(/<h2>Development projects<\/h2>\s*<ul>([\s\S]*?)<\/ul>/);
    expect(projects[1].match(/<li>/g)).toHaveLength(49);
    expect(html).toContain('Not affiliated with or endorsed by the City of Surrey.');
  });
});
