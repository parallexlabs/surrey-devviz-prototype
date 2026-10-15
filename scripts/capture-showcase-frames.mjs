import { chromium } from '@playwright/test';
import { mkdirSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import {
  assertCityCentreView,
  assertOverviewView,
  assertPilotMassingView,
  assertProjectPanel,
  loadPilotAreas,
  selectCityCentreProject,
  selectTallestApprovedProject,
  tallestApprovedByStoreys,
  waitForCameraSettled,
} from '../tests/helpers/mapAssertions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MEDIA = join(ROOT, 'docs', 'media');
const FRAMES = join(ROOT, 'showcase-media', 'frames');
const pilotAreas = loadPilotAreas();

mkdirSync(MEDIA, { recursive: true });
mkdirSync(FRAMES, { recursive: true });

function startServer() {
  return new Promise((resolve) => {
    const proc = spawn('npm', ['run', 'serve:site'], {
      cwd: ROOT,
      stdio: 'pipe',
      shell: true,
    });
    setTimeout(() => resolve(proc), 3000);
  });
}

async function shot(page, fileName, width, height, action, assertFn, fullPage = false) {
  await page.setViewportSize({ width, height });
  await action();
  await assertFn();
  await page.waitForTimeout(600);
  const mediaPath = join(MEDIA, fileName);
  const framePath = join(FRAMES, fileName.replace(/\.(png|jpg|jpeg|webp)$/i, '.png'));
  if (existsSync(mediaPath)) unlinkSync(mediaPath);
  await page.screenshot({ path: mediaPath, fullPage });
  await page.screenshot({ path: framePath, fullPage });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__surreyTest = true;
    window.__cameraInstant = true;
  });

  await page.goto('http://localhost:4173/demos/surrey/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.project-list li button', { timeout: 20000 });
  await page.waitForFunction(() => window.__overlaysReady === true, { timeout: 20000 });
  await waitForCameraSettled(page);

  await page.locator('#start-showcase').click();
  await assertCityCentreView(page, 'showcase start');
  await page.locator('#tour-exit').click();
  await waitForCameraSettled(page);

  await shot(
    page,
    'hero.png',
    1400,
    900,
    async () => {
      await page.click('[data-preset="overview"]');
    },
    () => assertOverviewView(page, 'hero'),
  );

  await shot(
    page,
    '01-overview.jpg',
    1600,
    1000,
    async () => {
      await page.click('[data-preset="overview"]');
    },
    () => assertOverviewView(page, '01-overview'),
  );

  await shot(
    page,
    '02-city-centre-3d.jpg',
    1600,
    1000,
    async () => {
      await page.locator('#toggle-skytrain').check();
      await page.locator('#toggle-civic').check();
      await page.locator('#toggle-plan').check();
      await page.locator('#toggle-ftda').uncheck();
      await page.locator('#toggle-amenities').uncheck();
      await page.locator('#toggle-buildings').uncheck();
      await page.click('[data-preset="city_centre"]');
    },
    () => assertCityCentreView(page, '02-city-centre-3d'),
  );

  await shot(
    page,
    '03-project-panel.jpg',
    1600,
    1000,
    async () => {
      await page.click('[data-preset="city_centre"]');
      await waitForCameraSettled(page);
      await selectTallestApprovedProject(page);
    },
    async () => {
      await assertProjectPanel(page, '03-project-panel');
      const project = tallestApprovedByStoreys();
      const text = await page.locator('#detail-panel').innerText();
      if (!text.includes(project.projectNo)) {
        throw new Error(`03-project-panel is missing ${project.projectNo}`);
      }
    },
  );

  await shot(
    page,
    '04-transit-overlay.jpg',
    1600,
    1000,
    async () => {
      await page.click('#close-detail');
      await page.locator('#toggle-skytrain').check();
      await page.locator('#toggle-civic').check();
      await page.locator('#toggle-plan').check();
      await page.locator('#toggle-ftda').check();
      await page.locator('#toggle-amenities').check();
      await page.click('[data-preset="city_centre"]');
      await waitForCameraSettled(page);
    },
    () => assertCityCentreView(page, '04-transit-overlay'),
  );

  await shot(
    page,
    '05-fleetwood.jpg',
    1600,
    1000,
    async () => {
      await page.locator('#toggle-ftda').uncheck();
      await page.locator('#toggle-amenities').uncheck();
      await page.locator('#toggle-skytrain').uncheck();
      await page.locator('#toggle-civic').uncheck();
      await page.locator('#toggle-plan').uncheck();
      await page.click('[data-preset="fleetwood"]');
    },
    () => assertPilotMassingView(page, pilotAreas.fleetwood.bbox, '05-fleetwood'),
  );

  await shot(
    page,
    '06-campbell-heights.jpg',
    1600,
    1000,
    async () => {
      await page.click('[data-preset="campbell_heights"]');
    },
    () => assertPilotMassingView(page, pilotAreas.campbell_heights.bbox, '06-campbell-heights'),
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:4173/demos/surrey/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.project-list li button', { timeout: 15000 });
  await selectCityCentreProject(page);
  await assertProjectPanel(page, '07-mobile');
  const mobilePath = join(MEDIA, '07-mobile.jpg');
  if (existsSync(mobilePath)) unlinkSync(mobilePath);
  await page.screenshot({ path: mobilePath, fullPage: true });
  await page.screenshot({ path: join(FRAMES, '07-mobile.png'), fullPage: true });

  await context.close();
  await browser.close();
  server.kill();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
