import { chromium } from '@playwright/test';
import { mkdirSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
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
const EVIDENCE = join(ROOT, 'evidence');
const VIDEO_DIR = join(EVIDENCE, 'video-raw');
const pilotAreas = loadPilotAreas();
mkdirSync(EVIDENCE, { recursive: true });
mkdirSync(VIDEO_DIR, { recursive: true });

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

async function captureScreenshot(page, name, action, assertFn) {
  const dest = join(EVIDENCE, `${name}.png`);
  if (existsSync(dest)) unlinkSync(dest);
  await action();
  await assertFn();
  await page.screenshot({ path: dest, fullPage: false });
  await page.waitForTimeout(1000);
  console.log(`Screenshot: ${name}.png`);
}

async function recordTour(page) {
  await page.locator('#start-showcase').click();
  await assertCityCentreView(page, 'tour step 1');
  await page.waitForTimeout(1200);

  let step = 1;
  const next = page.locator('#tour-next');
  while (!(await next.isDisabled())) {
    await next.click();
    step += 1;
    await waitForCameraSettled(page);
    await page.waitForTimeout(1200);
  }

  await page.locator('#tour-exit').click();
  await waitForCameraSettled(page);
}

async function main() {
  for (const name of [
    '01-overview',
    '02-city-centre-3d',
    '03-project-panel',
    '04-transit-overlay',
    '05-fleetwood',
    '06-campbell-heights',
    '07-mobile',
  ]) {
    const dest = join(EVIDENCE, `${name}.png`);
    if (existsSync(dest)) unlinkSync(dest);
  }

  const server = await startServer();

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1600, height: 1000 } },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__surreyTest = true;
    window.__cameraInstant = true;
  });

  await page.goto('http://localhost:4173/demos/surrey/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.project-list li button', { timeout: 20000 });
  await page.waitForFunction(() => window.__overlaysReady === true, { timeout: 20000 });
  await waitForCameraSettled(page);
  await page.waitForTimeout(800);
  await recordTour(page);

  const screenshots = [
    {
      name: '01-overview',
      action: async () => {
        await page.click('[data-preset="overview"]');
      },
      assert: () => assertOverviewView(page, '01-overview'),
    },
    {
      name: '02-city-centre-3d',
      action: async () => {
        await page.locator('#toggle-skytrain').check();
        await page.locator('#toggle-civic').check();
        await page.locator('#toggle-plan').check();
        await page.locator('#toggle-ftda').uncheck();
        await page.locator('#toggle-amenities').uncheck();
        await page.locator('#toggle-buildings').uncheck();
        await page.click('[data-preset="city_centre"]');
      },
      assert: () => assertCityCentreView(page, '02-city-centre-3d'),
    },
    {
      name: '03-project-panel',
      action: async () => {
        await page.click('[data-preset="city_centre"]');
        await waitForCameraSettled(page);
        await selectTallestApprovedProject(page);
      },
      assert: async () => {
        await assertProjectPanel(page, '03-project-panel');
        const project = tallestApprovedByStoreys();
        const text = await page.locator('#detail-panel').innerText();
        if (!text.includes(project.projectNo)) {
          throw new Error(`03-project-panel is missing ${project.projectNo}`);
        }
        const height = `${project.storeys} storeys stated in the application x 3.2 m`;
        if (!text.includes(height)) throw new Error(`03-project-panel is missing ${height}`);
        if (!text.includes('Not a surveyed or approved height.')) {
          throw new Error('03-project-panel is missing the height caveat');
        }
      },
    },
    {
      name: '04-transit-overlay',
      action: async () => {
        await page.click('#close-detail');
        await page.locator('#toggle-skytrain').check();
        await page.locator('#toggle-civic').check();
        await page.locator('#toggle-plan').check();
        await page.locator('#toggle-ftda').check();
        await page.locator('#toggle-amenities').check();
        await page.click('[data-preset="city_centre"]');
        await waitForCameraSettled(page);
      },
      assert: () => assertCityCentreView(page, '04-transit-overlay'),
    },
    {
      name: '05-fleetwood',
      action: async () => {
        await page.locator('#toggle-ftda').uncheck();
        await page.locator('#toggle-amenities').uncheck();
        await page.locator('#toggle-skytrain').uncheck();
        await page.locator('#toggle-civic').uncheck();
        await page.locator('#toggle-plan').uncheck();
        await page.click('[data-preset="fleetwood"]');
      },
      assert: () => assertPilotMassingView(page, pilotAreas.fleetwood.bbox, '05-fleetwood'),
    },
    {
      name: '06-campbell-heights',
      action: async () => {
        await page.click('[data-preset="campbell_heights"]');
      },
      assert: () =>
        assertPilotMassingView(page, pilotAreas.campbell_heights.bbox, '06-campbell-heights'),
    },
  ];

  for (const shot of screenshots) {
    await captureScreenshot(page, shot.name, shot.action, shot.assert);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileShot = join(EVIDENCE, '07-mobile.png');
  if (existsSync(mobileShot)) unlinkSync(mobileShot);
  await page.goto('http://localhost:4173/demos/surrey/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.project-list li button', { timeout: 15000 });
  await selectCityCentreProject(page);
  await assertProjectPanel(page, '07-mobile');
  await page.screenshot({ path: mobileShot, fullPage: true });
  console.log('Screenshot: 07-mobile.png');

  await context.close();
  await browser.close();
  server.kill();

  const videoFiles = existsSync(VIDEO_DIR)
    ? execSync(`ls -t "${VIDEO_DIR}"/*.webm 2>/dev/null | head -1`, { encoding: 'utf8' }).trim()
    : '';

  if (videoFiles) {
    const mp4Path = join(EVIDENCE, 'walkthrough.mp4');
    execSync(
      `ffmpeg -y -i "${videoFiles}" -c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p -movflags +faststart "${mp4Path}"`,
      { stdio: 'inherit' },
    );
    const size = execSync(`stat -f%z "${mp4Path}"`, { encoding: 'utf8' }).trim();
    console.log(`Video: ${mp4Path} (${Math.round(Number(size) / 1024 / 1024)} MB)`);
  }

  console.log('Recording complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
