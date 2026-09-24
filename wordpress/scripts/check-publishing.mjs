import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { projectRoot } from './runtime.mjs';

const base = 'http://127.0.0.1:9400';
const output = resolve(projectRoot, '../artifacts/wordpress');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const publicJson = async path => {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(90000) });
  assert.equal(response.status, 200);
  return response.json();
};
let userId, postId, admin, nonce, adminId, editor;
try {
  admin = await browser.newContext();
  const page = await admin.newPage();
  page.setDefaultTimeout(60000);
  const credentials = JSON.parse(await readFile(resolve(projectRoot, '.runtime/local-admin.json'), 'utf8'));
  await page.goto(`${base}/prijava/`);
  assert.match(await page.locator('h1').innerText(), /Prijava/);
  await page.screenshot({ path: resolve(output, 'professor-login.png'), fullPage: true });
  await page.locator('#user_login').fill(credentials.username);
  await page.locator('#user_pass').fill(credentials.password);
  await Promise.all([page.waitForURL('**/wp-admin/**'), page.locator('#wp-submit').click()]);
  await page.goto(`${base}/wp-admin/tools.php?page=matinf-demo`);
  await Promise.all([page.waitForNavigation(), page.getByRole('button', { name: 'Dodaj demo sadržaj' }).click()]);
  nonce = await (await admin.request.get(`${base}/wp-admin/admin-ajax.php?action=rest-nonce`)).text();
  const headers = { 'X-WP-Nonce': nonce };
  adminId = (await (await admin.request.get(`${base}/wp-json/wp/v2/users/me`, { headers })).json()).id;
  const username = `professor-check-${Date.now()}`;
  const password = randomBytes(24).toString('base64url');
  const created = await admin.request.post(`${base}/wp-json/wp/v2/users`, { headers, data: { username, password, email: `${username}@example.invalid`, name: 'Profesor · provjera', roles: ['matinf_professor'] } });
  assert.equal(created.status(), 201, await created.text());
  userId = (await created.json()).id;
  const professor = await browser.newContext();
  editor = await professor.newPage();
  editor.on('pageerror', error => console.error('Editor script error:', error.message));
  editor.setDefaultTimeout(60000);
  await editor.goto(`${base}/prijava/`);
  await editor.locator('#user_login').fill(username);
  await editor.locator('#user_pass').fill(password);
  await Promise.all([editor.waitForURL('**/wp-admin/**'), editor.locator('#wp-submit').click()]);
  await editor.goto(`${base}/wp-admin/post-new.php`);
  postId = Number(await editor.locator('#post_ID').inputValue());
  await editor.locator('#title').fill('Provjera objave profesora — ciljani predmet');
  const htmlTab = editor.locator('#content-html');
  if (await htmlTab.isVisible()) await htmlTab.click();
  await editor.locator('#content').fill('<p>Objava profesora preko WordPress forme. Ovaj privremeni sadržaj provjerava REST API.</p>');
  const courses = await publicJson('/wp-json/matinf/v1/content/courses');
  const course = courses.items[0];
  await editor.locator('input[name="matinf[everyone]"]').uncheck();
  await editor.locator('#mf-audienceCourseIds').selectOption(String(course.id));
  const category = editor.locator('#categorychecklist label').filter({ hasText: 'Obavještenja' });
  await category.locator('input').check();
  // WordPress disables this button with a CSS class during title autosave.
  // Playwright's normal enabled check only sees the native disabled attribute.
  await editor.locator('#publish:not(.disabled)').click();
  await editor.waitForURL(url => url.pathname.endsWith('/post.php') && url.searchParams.get('post') === String(postId));
  await editor.locator('#message').filter({ hasText: 'Post published' }).waitFor();
  await editor.screenshot({ path: resolve(output, 'professor-published.png'), fullPage: true });
  assert.ok(postId);
  const item = await publicJson(`/wp-json/matinf/v1/content/announcements/${postId}`);
  assert.equal(item.title, 'Provjera objave profesora — ciljani predmet');
  assert.equal(item.meta.audience.everyone, false);
  assert.deepEqual(item.meta.audience.courseIds, [course.id]);
  const targeted = await publicJson(`/wp-json/matinf/v1/content/feed?following=true&program_years=${course.meta.programId}:${course.meta.year}&per_page=50`);
  const general = await publicJson('/wp-json/matinf/v1/content/feed?following=true&per_page=50');
  assert.ok(targeted.items.some(post => post.id === postId));
  assert.ok(!general.items.some(post => post.id === postId));
  console.log('PASS: Administrator creates Professor; Professor signs in and publishes own targeted post; REST year feed includes it and unrelated/general-only feed excludes it.');
} catch (error) {
  if (editor) {
    await editor.screenshot({ path: resolve(output, 'professor-publish-error.png'), fullPage: true });
    console.error('Editor URL:', editor.url());
    console.error('Editor status:', await editor.locator('#post-status-display').textContent().catch(() => 'not present'));
    console.error('Editor notices:', await editor.locator('#message, .notice-error, .wp-die-message').allTextContents());
  }
  // Playwright request logs may contain authenticated cookies. Keep those out
  // of terminal output; the status, page screenshot, and message suffice.
  throw new Error(String(error.message).split('Call log:')[0]);
} finally {
  if (admin && nonce) {
    const headers = { 'X-WP-Nonce': nonce };
    if (postId) assert.equal((await admin.request.delete(`${base}/wp-json/wp/v2/posts/${postId}?force=true`, { headers })).status(), 200);
    if (userId) assert.equal((await admin.request.delete(`${base}/wp-json/wp/v2/users/${userId}?force=true&reassign=${adminId}`, { headers })).status(), 200);
  }
  await browser.close();
}
