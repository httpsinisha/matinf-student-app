import { startWordPress } from './runtime.mjs';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { checkAppUpdates } from './check-app-updates.mjs';
const site = await startWordPress({ port: 9412, storage: '.catalog-test-runtime' });
const enrichment = await site.playground.run({ code: "<?php require '/wordpress/wp-load.php'; matinf_enrich_student_life(); echo 'ok';" });
assert.equal(enrichment.exitCode, 0, enrichment.errors);
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
  await context.addInitScript(({ id }) => {
    if (!localStorage.getItem('@matinf/onboarding/v1')) {
      localStorage.setItem('@matinf/onboarding/v1', JSON.stringify({ version: 1, completed: true, backend: 'http://127.0.0.1:9412', programYears: [id + ':1'], courseIds: [], selectedProgramId: String(id), notificationsRequested: false, permission: 'not-requested', syncStatus: 'not-needed' }));
      localStorage.setItem('@matinf/schedule-selection:http://127.0.0.1:9412', JSON.stringify({ programId: id, year: 4, semester: 1 }));
    }
  }, { id: program.id });
  const page = await context.newPage(); currentPage = page; page.setDefaultTimeout(90000);
  const scheduleRequests = [];
  page.on('request', request => { if (request.url().includes('/matinf/v1/schedule?')) scheduleRequests.push(new URL(request.url())); });
  await page.goto('http://127.0.0.1:8090');
  if (process.argv.includes('--updates-only')) {
    await checkAppUpdates(site, browser, context, program, output);
  } else {
  await page.getByRole('button', { name: 'Moj raspored nastave', exact: true }).click();
  await page.getByText('Osnovi programiranja 1', { exact: true }).first().waitFor();
  await page.screenshot({ path: resolve(output, 'schedule-winter.png'), fullPage: true });
  await page.getByRole('button', { name: 'Ljetni semestar', exact: true }).click();
  await page.getByText('Informacione tehnologije i društvo', { exact: true }).waitFor();
  await page.getByRole('button', { name: '2. godina', exact: true }).click();
  await page.getByText('Kombinatorika', { exact: true }).first().waitFor();
  await page.screenshot({ path: resolve(output, 'schedule-second-year.png'), fullPage: true });
  await page.getByRole('button', { name: 'Ispiti', exact: true }).click();
  await page.getByRole('button', { name: 'Januarsko-februarski', exact: true }).waitFor();
  await page.getByText('Kombinatorika', { exact: true }).first().waitFor();
  await page.screenshot({ path: resolve(output, 'exams.png'), fullPage: true });
  await page.getByRole('button', { name: 'Apsolventi', exact: true }).click();
  await page.getByRole('button', { name: 'Oktobarski apsolventski', exact: true }).waitFor();
  await page.getByText('Baze podataka – napredni koncepti', { exact: true }).first().waitFor();
  assert.equal(await page.getByText('Osnovi programiranja 1', { exact: true }).count(), 0);
  await page.screenshot({ path: resolve(output, 'graduate-exams.png'), fullPage: true });
  const timetable = await (await fetch(`http://127.0.0.1:9412/wp-json/matinf/v1/schedule?program_id=${program.id}&year=2`)).json();
  assert.ok(timetable.exams.every(row => row.year === 2));
  assert.deepEqual([...new Set(timetable.graduateExams.map(row => row.year))], [4]);
  assert.equal(timetable.graduateExams.length, 6);
  assert.equal(new Set(timetable.graduateExams.map(row => row.courseId)).size, 3);
  for (const rows of [timetable.exams, timetable.graduateExams]) {
    assert.ok(rows.length > 0);
    assert.equal(new Set(rows.map(row => row.date + row.start)).size, rows.length);
    assert.ok(rows.every(row => row.room && ![0, 6].includes(new Date(row.date + 'T12:00:00Z').getUTCDay())));
  }
  await page.reload();
  await page.getByRole('button', { name: 'Moj raspored nastave', exact: true }).click();
  await page.getByText('Informacione tehnologije i društvo', { exact: true }).first().waitFor();
  const selected = await page.evaluate(() => JSON.parse(localStorage.getItem('@matinf/schedule-selection:http://127.0.0.1:9412')));
  assert.deepEqual(selected, { semester: 2 });
  const math = catalog.items.find(item => item.title === 'Diplomirani matematičar i informatičar');
  await page.getByRole('button', { name: 'Podesi praćenje', exact: true }).click();
  await page.getByRole('button', { name: 'Ukloni praćenje: ' + program.title, exact: true }).click();
  await page.getByRole('button', { name: math.title, exact: true }).click();
  await page.getByRole('checkbox', { name: '4. godina, ' + math.title, exact: true }).click();
  await page.getByRole('button', { name: program.title, exact: true }).click();
  await page.getByRole('checkbox', { name: '2. godina, ' + program.title, exact: true }).click();
  await page.getByRole('button', { name: 'Sačuvaj izbor', exact: true }).first().click();
  const expectedSchedule = await (await fetch(`http://127.0.0.1:9412/wp-json/matinf/v1/schedule?program_id=${math.id}&year=4&semester=2`)).json();
  const expectedCourse = expectedSchedule.items[0].course.title;
  await page.getByText(expectedCourse, { exact: true }).first().waitFor();
  assert.equal(scheduleRequests.at(-1).searchParams.get('program_id'), String(math.id));
  assert.equal(scheduleRequests.at(-1).searchParams.get('year'), '4');
  await page.getByRole('button', { name: 'Ispiti', exact: true }).click();
  await page.getByText(expectedCourse, { exact: true }).first().waitFor();
  await page.screenshot({ path: resolve(output, 'following-schedule.png'), fullPage: true });
  await context.setOffline(true);
  await page.getByRole('tab', { name: 'Početna', exact: true }).click();
  await page.getByRole('button', { name: 'Moj raspored nastave', exact: true }).click();
  await page.getByText('Sačuvan raspored — provjerite da li je ažuran.', { exact: true }).waitFor();
  await page.getByText(expectedCourse, { exact: true }).first().waitFor();
  await page.screenshot({ path: resolve(output, 'schedule-offline.png'), fullPage: true });
  await context.setOffline(false);
  const website = await context.newPage();
  currentPage = website;
  await website.goto(`http://127.0.0.1:9412/raspored/?program_id=${program.id}&study_year=2`);
  await website.getByRole('heading', { name: 'Apsolventski rokovi', exact: true }).waitFor();
  assert.equal(await website.locator('table').count(), 2);
  await website.screenshot({ path: resolve(output, 'website-schedule.png') });
  const staff = await (await fetch('http://127.0.0.1:9412/wp-json/matinf/v1/content/staff?per_page=50')).json();
  assert.ok(staff.items.every(item => item.meta.email));
  assert.deepEqual([...new Set(staff.items.map(item => item.meta.staffGroup))].sort(), ['Nastavnici', 'Rukovodioci', 'Saradnici']);
  const pages = await (await fetch('http://127.0.0.1:9412/wp-json/matinf/v1/content/pages?per_page=50')).json();
  const stories = pages.items.find(item => item.slug === 'studentske-price');
  assert.ok(stories && stories.bodyHtml.includes('Ana Jovanović'));
  await website.goto(stories.url);
  await website.getByRole('heading', { name: 'Ana Jovanović', exact: true }).waitFor();
  await website.screenshot({ path: resolve(output, 'student-stories.png'), fullPage: true });
  await checkAppUpdates(site, browser, context, program, output);
  console.log('PASS: timetable selection, exams, graduate coverage, rooms, persistence, offline cache, website tables, staff contacts/groups and stories.');
  }
} catch (error) {
  if (currentPage) await currentPage.screenshot({ path: resolve(output, 'schedule-error.png'), fullPage: true });
  throw error;
} finally { await browser.close(); await new Promise(done => server.close(done)); await site[Symbol.asyncDispose](); }
