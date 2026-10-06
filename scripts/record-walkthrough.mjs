import { chromium } from '@playwright/test';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import {
  assertMapCenterInSurrey,
  assertMapCenterInBbox,
  assertMapViewShowsSurrey,
  loadPilotAreas,
  waitForMapReady,
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
    const proc = spawn('npm', ['run', 'serve:dist'], {
      cwd: ROOT,
      stdio: 'pipe',
      shell: true,
    });
    setTimeout(() => resolve(proc), 3000);
  });
}

async function assertProjectPanel(page) {
  const panel = page.locator('#detail-panel');
  if (!(await panel.isVisible())) {
    throw new Error('Project detail panel is not visible');
  }
  const proximity = await page.locator('.proximity').textContent();
  if (!proximity || !/SkyTrain/i.test(proximity) || !/(m|km)/i.test(proximity)) {
    throw new Error('Project panel is missing SkyTrain proximity distance');
  }
  const rings = await page.evaluate(() => {
    const map = window.__map;
    if (!map) return 0;
    return map.querySourceFeatures('proximity-rings').length;
  });
  if (rings < 2) {
    throw new Error('Proximity rings are not visible on the map');
  }
}

async function captureScreenshot(page, name, action, assertFn) {
  await action();
  await assertFn();
  await page.screenshot({
    path: join(EVIDENCE, `${name}.png`),
    fullPage: false,
  });
  console.log(`Screenshot: ${name}.png`);
}

async function recordTour(page) {
  await page.locator('#start-tour').click();
  await waitForMapReady(page);
  await assertMapCenterInSurrey(page, 'tour step 1');

  let step = 1;
  const next = page.locator('#tour-next');
  while (!(await next.isDisabled())) {
    await next.click();
    step += 1;
    await waitForMapReady(page);
    await assertMapCenterInSurrey(page, `tour step ${step}`);
  }

  await page.locator('#tour-exit').click();
  await waitForMapReady(page);
}

async function main() {
  const server = await startServer();

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1600, height: 1000 } },
  });
  const page = await context.newPage();

  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForSelector('.project-list li button', { timeout: 20000 });
  await waitForMapReady(page);

  const screenshots = [
    {
      name: '01-overview',
      action: async () => {
        await page.click('[data-preset="overview"]');
      },
      assert: () =>
        assertMapViewShowsSurrey(page, '01-overview', {
          minProjects: 10,
          requiredLabels: ['Fleetwood', 'King George Boulevard'],
        }),
    },
    {
      name: '02-city-centre-3d',
      action: async () => {
        await page.click('[data-preset="city_centre"]');
      },
      assert: async () => {
        await assertMapCenterInBbox(page, pilotAreas.city_centre.bbox, '02-city-centre-3d');
        await assertMapViewShowsSurrey(page, '02-city-centre-3d', {
          minProjects: 20,
          requiredLabels: ['Surrey Central', 'King George', 'Scott Road'],
        });
      },
    },
    {
      name: '03-project-panel',
      action: async () => {
        await page.click('[data-preset="city_centre"]');
        await waitForMapReady(page);
        await page.locator('.project-list li button').first().click();
        await waitForMapReady(page);
      },
      assert: async () => {
        await assertMapViewShowsSurrey(page, '03-project-panel', { minProjects: 1 });
        await assertProjectPanel(page);
      },
    },
    {
      name: '04-transit-overlay',
      action: async () => {
        await page.click('[data-preset="city_centre"]');
        await waitForMapReady(page);
        await page.locator('#toggle-ftda').check();
        await page.locator('#toggle-amenities').check();
      },
      assert: async () => {
        await assertMapCenterInBbox(page, pilotAreas.city_centre.bbox, '04-transit-overlay');
        await assertMapViewShowsSurrey(page, '04-transit-overlay', {
          minProjects: 20,
          requiredLabels: ['Surrey Central', 'King George', 'Scott Road'],
        });
      },
    },
    {
      name: '05-fleetwood',
      action: async () => {
        await page.click('[data-preset="fleetwood"]');
      },
      assert: () =>
        assertMapViewShowsSurrey(page, '05-fleetwood', {
          minProjects: 1,
          requiredLabels: ['Fleetwood'],
        }),
    },
    {
      name: '06-campbell-heights',
      action: async () => {
        await page.click('[data-preset="campbell_heights"]');
      },
      assert: () => assertMapViewShowsSurrey(page, '06-campbell-heights', { minProjects: 1 }),
    },
  ];

  for (const shot of screenshots) {
    await captureScreenshot(page, shot.name, shot.action, shot.assert);
  }

  await recordTour(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForSelector('.project-list li button', { timeout: 15000 });
  await page.locator('.project-list li button').first().click();
  await waitForMapReady(page);
  await assertMapCenterInSurrey(page, '07-mobile');
  await page.screenshot({
    path: join(EVIDENCE, '07-mobile.png'),
    fullPage: false,
  });
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
