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

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:4173/demos/surrey/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.project-list li button', { timeout: 20000 });

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const report = {
    scanned_at: new Date().toISOString(),
    url: 'http://localhost:4173/demos/surrey/',
    violations: results.violations,
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    serious_or_critical: results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    ),
  };

  const outPath = join(EVIDENCE, 'axe-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  await context.close();
  await browser.close();
  server.kill();

  const serious = report.serious_or_critical.length;
  console.log(`Axe scan complete: ${report.violations.length} violations (${serious} serious/critical)`);
  console.log(`Report: ${outPath}`);

  if (serious > 0) {
    console.error('FAIL: serious or critical accessibility violations found');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
