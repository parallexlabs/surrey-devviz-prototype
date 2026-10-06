import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const EVIDENCE = join(ROOT, 'evidence');
mkdirSync(EVIDENCE, { recursive: true });

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

async function scan(page, name) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return {
    name,
    violations: results.violations.map((item) => ({
      id: item.id,
      impact: item.impact,
      help: item.help,
      nodes: item.nodes.length,
    })),
    passes: results.passes.length,
    incomplete: results.incomplete.length,
  };
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__cameraInstant = true;
  });
  await page.goto('http://localhost:4173/demos/surrey/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.project-list li button', { timeout: 20000 });

  const states = [];
  states.push(await scan(page, 'overview'));

  await page.locator('#project-list').focus();
  states.push(await scan(page, 'list'));

  await page.locator('.project-list li button').first().click();
  await page.waitForSelector('#detail-panel:not([hidden])');
  states.push(await scan(page, 'panel'));
  await page.locator('#close-detail').click();

  await page.locator('#start-showcase').click();
  await page.waitForSelector('#tour-panel:not([hidden])');
  states.push(await scan(page, 'tour'));
  await page.locator('#tour-exit').click();

  await page.locator('#open-methodology').click();
  await page.waitForSelector('#methodology-drawer:not([hidden])');
  states.push(await scan(page, 'methodology'));
  await page.locator('#close-methodology').click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  states.push(await scan(page, 'phone'));

  const violations = states.reduce((sum, state) => sum + state.violations.length, 0);
  const report = {
    scanned_at: new Date().toISOString(),
    url: 'http://localhost:4173/demos/surrey/',
    violations: states.flatMap((state) => state.violations.map((item) => ({ state: state.name, ...item }))),
    states,
    passes: states.reduce((sum, state) => sum + state.passes, 0),
    incomplete: states.reduce((sum, state) => sum + state.incomplete, 0),
    serious_or_critical: states.flatMap((state) =>
      state.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical'),
    ),
  };

  const outPath = join(EVIDENCE, 'axe-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  await context.close();
  await browser.close();
  server.kill();

  console.log(`Axe scan complete: ${violations} violations across ${states.length} states`);
  for (const state of states) {
    console.log(`  ${state.name}: ${state.violations.length}`);
  }
  console.log(`Report: ${outPath}`);

  if (violations > 0) {
    console.error(JSON.stringify(report.violations, null, 2));
    console.error('FAIL: accessibility violations found');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
