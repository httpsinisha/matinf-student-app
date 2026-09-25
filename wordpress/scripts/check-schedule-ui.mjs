import { startWordPress } from './runtime.mjs';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const site = await startWordPress({ port: 9412, storage: '.catalog-test-runtime' });
const root = resolve('../artifacts/catalog-web');
const output = resolve('../artifacts/schedule'); await mkdir(output, { recursive: true });
const server = createServer(async (request, response) => {
  try {
    let file = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = resolve(file, 'index.html');
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf' }[extname(file)] || 'application/octet-stream';
    response.setHeader('Content-Type', type); response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(8090, '127.0.0.1', done));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let currentPage;
try {
  const catalog = await (await fetch('http://127.0.0.1:9412/wp-json/matinf/v1/content/programs')).json();
  const program = catalog.items.find(item => item.title === 'Diplomirani informatičar');
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
  await context.addInitScript(({ id }) => localStorage.setItem('@matinf/onboarding/v1', JSON.stringify({ version: 1, completed: true, backend: 'http://127.0.0.1:9412', programYears: [id + ':1'], courseIds: [], selectedProgramId: String(id), notificationsRequested: false, permission: 'not-requested', syncStatus: 'not-needed' })), { id: program.id });
  const page = await context.newPage(); currentPage = page; page.setDefaultTimeout(90000);
  await page.goto('http://127.0.0.1:8090');
  await page.getByRole('button', { name: 'Moj raspored nastave', exact: true }).click();
  await page.getByText('Osnovi programiranja 1', { exact: true }).first().waitFor();
  await page.screenshot({ path: resolve(output, 'schedule-winter.png'), fullPage: true });
  await page.getByRole('button', { name: 'Ljetni semestar', exact: true }).click();
  await page.getByText('Informacione tehnologije i društvo', { exact: true }).waitFor();
  await page.getByRole('button', { name: '2. godina', exact: true }).click();
  await page.getByText('Kombinatorika', { exact: true }).first().waitFor();
  await page.screenshot({ path: resolve(output, 'schedule-second-year.png'), fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: 'Moj raspored nastave', exact: true }).click();
  await page.getByText('Kombinatorika', { exact: true }).first().waitFor();
  const selected = await page.evaluate(() => JSON.parse(localStorage.getItem('@matinf/schedule-selection:http://127.0.0.1:9412')));
  assert.equal(selected.year, 2); assert.equal(selected.semester, 2);
  await context.setOffline(true);
  await page.getByRole('tab', { name: 'Početna', exact: true }).click();
  await page.getByRole('button', { name: 'Moj raspored nastave', exact: true }).click();
  await page.getByText('Sačuvan raspored — provjerite da li je ažuran.', { exact: true }).waitFor();
  await page.getByText('Kombinatorika', { exact: true }).first().waitFor();
  await page.screenshot({ path: resolve(output, 'schedule-offline.png'), fullPage: true });
  await context.setOffline(false);
  console.log('PASS: timetable selection, semester/year content, persistence and cached offline schedule.');
} catch (error) {
  if (currentPage) await currentPage.screenshot({ path: resolve(output, 'schedule-error.png'), fullPage: true });
  throw error;
} finally { await browser.close(); await new Promise(done => server.close(done)); await site[Symbol.asyncDispose](); }
