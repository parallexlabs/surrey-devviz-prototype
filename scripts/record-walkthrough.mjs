import { chromium } from '@playwright/test';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const EVIDENCE = join(ROOT, 'evidence');
const VIDEO_DIR = join(EVIDENCE, 'video-raw');
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

  await page.locator('#start-tour').click();
  await page.waitForTimeout(4000);
  await page.locator('#tour-next').click();
  await page.waitForTimeout(5000);
  await page.locator('#tour-next').click();
  await page.waitForTimeout(5000);
  await page.locator('#tour-exit').click();
  await page.waitForTimeout(2000);

  const screenshots = [
    { name: '01-overview', action: async () => { await page.waitForTimeout(4000); } },
    {
      name: '02-city-centre-3d',
      action: async () => {
        await page.click('[data-preset="city_centre"]');
        await page.waitForTimeout(10000);
      },
    },
    {
      name: '03-project-panel',
      action: async () => {
        await page.locator('.project-list li button').first().click();
        await page.waitForTimeout(8000);
      },
    },
    {
      name: '04-transit-overlay',
      action: async () => {
        await page.locator('#toggle-ftda').check();
        await page.locator('#toggle-amenities').check();
        await page.waitForTimeout(6000);
      },
    },
    {
      name: '05-fleetwood',
      action: async () => {
        await page.click('[data-preset="fleetwood"]');
        await page.waitForTimeout(10000);
      },
    },
    {
      name: '06-campbell-heights',
      action: async () => {
        await page.click('[data-preset="campbell_heights"]');
        await page.waitForTimeout(10000);
      },
    },
  ];

  for (const shot of screenshots) {
    await shot.action();
    await page.screenshot({
      path: join(EVIDENCE, `${shot.name}.png`),
      fullPage: false,
    });
    console.log(`Screenshot: ${shot.name}.png`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForSelector('.project-list li button', { timeout: 15000 });
  await page.locator('.project-list li button').first().click();
  await page.waitForTimeout(6000);
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
