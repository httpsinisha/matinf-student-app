import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { projectRoot } from './runtime.mjs';

const base = 'http://127.0.0.1:9400';
const output = resolve(projectRoot, '../artifacts/wordpress');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const response = await page.goto(base, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    assert.match(await page.locator('h1').innerText(), /Znanje/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No horizontal overflow');
    await page.screenshot({ path: resolve(output, `home-${viewport.width}.png`), fullPage: true });
    if (viewport.width === 390) {
      await page.getByRole('button', { name: 'Otvori navigaciju' }).click();
      assert.equal(await page.locator('#main-navigation').isVisible(), true);
      await page.getByRole('navigation', { name: 'Glavna navigacija' }).getByRole('link', { name: 'Studije', exact: true }).click();
      await page.waitForURL('**/studije/');
      await page.waitForLoadState('networkidle');
      assert.equal(await page.locator('.grid .card').count(), 6);
      await page.screenshot({ path: resolve(output, 'studies-mobile.png'), fullPage: true });
    }
  }
  const programs = await (await fetch(`${base}/wp-json/matinf/v1/content/programs`)).json();
  await page.goto(programs.items[0].url, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.year-group').count(), programs.items[0].meta.durationYears);
  await page.screenshot({ path: resolve(output, 'program-mobile.png'), fullPage: true });

  // Real browser login confirms the generated local administrator can edit the
  // site without putting its password into logs or screenshots.
  const credentials = JSON.parse(await readFile(resolve(projectRoot, '.runtime/local-admin.json'), 'utf8'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/wp-login.php`, { waitUntil: 'domcontentloaded' });
  await page.locator('#user_login').fill(credentials.username);
  await page.locator('#user_pass').fill(credentials.password);
  await Promise.all([page.waitForURL('**/wp-admin/**'), page.locator('#wp-submit').click()]);
  await page.goto(`${base}/wp-admin/edit.php?post_type=mf_program`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('#the-list tr').count(), 6);
  await page.screenshot({ path: resolve(output, 'admin-programs.png'), fullPage: true });
  await page.goto(`${base}/wp-admin/post.php?post=${programs.items[0].id}&action=edit`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('#mf-level').count(), 1);
  assert.equal(await page.locator('#mf-documentIds').count(), 1);
  const originalTitle = await page.locator('#title').inputValue();
  try {
    await page.locator('#title').fill(`${originalTitle} — provjera`);
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.locator('#publish').click()]);
    const changed = await (await fetch(`${base}/wp-json/matinf/v1/content/programs/${programs.items[0].id}`)).json();
    assert.equal(changed.title, `${originalTitle} — provjera`);
  } finally {
    await page.goto(`${base}/wp-admin/post.php?post=${programs.items[0].id}&action=edit`, { waitUntil: 'domcontentloaded' });
    await page.locator('#title').fill(originalTitle);
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.locator('#publish').click()]);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: desktop/tablet/mobile layouts, navigation, program detail, admin login, and edit -> save -> API update (title restored).');
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
}
