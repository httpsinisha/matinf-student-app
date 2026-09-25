import { startWordPress, projectRoot } from './runtime.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const site = await startWordPress({ port: 9412, storage: '.catalog-test-runtime' });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
  const base = 'http://127.0.0.1:9412';
  await page.goto(base + '/raspored/');
  await page.getByRole('heading', { name: 'Raspored ispita', exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('select[name="study_year"]').selectOption('2');
  await page.getByRole('button', { name: 'Prikaži raspored', exact: true }).click();
  await page.getByRole('heading', { name: 'Apsolventski rokovi', exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('study_year'), '2');
  await page.screenshot({ path: resolve(projectRoot, '../artifacts/schedule/website-schedule.png') });
  await page.getByRole('heading', { name: 'Raspored ispita', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(projectRoot, '../artifacts/schedule/website-exams.png') });
  await page.goto(base + '/osoblje/');
  for (const name of ['Rukovodioci', 'Nastavnici', 'Saradnici']) await page.getByRole('heading', { name, exact: true }).waitFor();
  assert.equal(await page.locator('.staff-avatar').count(), 35);
  assert.equal(await page.locator('a[href^="mailto:"]').count(), 35);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: resolve(projectRoot, '../artifacts/schedule/website-staff.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: resolve(projectRoot, '../artifacts/schedule/website-staff-desktop.png') });
  console.log('PASS: mobile form submission, contained tables, 35 staff contacts and avatars, ordered groups.');
} finally { await browser.close(); await site[Symbol.asyncDispose](); }
