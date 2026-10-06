import { test, expect } from '@playwright/test';

test('civic selection clears a project hash and restores focus', async ({ page }) => {
  await page.goto('./#project=21-0313-00');
  await expect(page.locator('#detail-panel')).toBeVisible();
  const opener = page.locator('#civic-list button').first();
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/project=/);
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
});

test('showcase facts and source links are inside the modal', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto('./');
  await page.locator('#start-showcase').click();
  await page.locator('#tour-next').click();
  await expect(page.locator('#detail-panel')).toHaveJSProperty('inert', true);
  await expect(page.locator('#tour-details')).toContainText('Not a surveyed or approved height');
  const scrolled = await page.locator('#tour-panel').evaluate((el) => ({
    overflow: getComputedStyle(el).overflowY,
    scroll: el.scrollHeight,
    client: el.clientHeight,
  }));
  expect(scrolled.overflow).toBe('auto');
  expect(scrolled.scroll).toBeGreaterThan(scrolled.client);
  await page.locator('#tour-next').click();
  await expect(page.locator('#tour-details')).toContainText('Planned venue; not open to visitors.');
  const source = page.locator('#tour-details a').first();
  await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
  await source.focus();
  await expect(source).toBeFocused();
  await page.locator('#tour-next').click();
  await expect(page.locator('#tour-details')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#start-showcase')).toBeFocused();
});

test('application record link joins year and seq with &', async ({ page }) => {
  await page.goto('./#project=21-0313-00');
  const panel = page.locator('#detail-panel');
  await expect(panel).toBeVisible();
  const record = panel.getByRole('link', { name: "View the City's application record" });
  await expect(record).toHaveAttribute('href', /publicProjectForward\.html\?year=21&seq=0313$/);
});

test('area card follows the area filter', async ({ page }) => {
  await page.goto('./');
  const card = page.locator('#area-card');
  const filter = page.locator('#filter-area');
  await filter.selectOption('campbell_heights');
  await expect(card).toBeVisible();
  await expect(card.locator('h2')).toHaveText('Campbell Heights');
  const listed = await page.locator('.project-list li').count();
  expect(listed).toBeGreaterThan(0);
  await expect(card.locator('.area-count')).toHaveText(`${listed} selected records in this prototype`);
  await filter.selectOption('');
  await expect(card).toBeHidden();
});
