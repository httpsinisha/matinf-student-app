import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDocument } from 'htmlparser2';
import assert from 'node:assert/strict';

const adb = resolve(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const hosted = process.argv.includes('--hosted');
const output = resolve(hosted ? 'artifacts/reader-hosted' : 'artifacts/reader');
const native = process.argv.includes('--native');
const app = native ? 'com.matinf.demo' : 'host.exp.exponent';
mkdirSync(output, { recursive: true });
const run = (...args) => execFileSync(adb, args, { encoding: 'utf8', timeout: 30000 });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function launch() {
  if (native) run('shell', 'am', 'start', '-W', '-n', 'com.matinf.demo/.MainActivity');
  else run('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'exp://127.0.0.1:8081', '-p', app);
}
async function nodes(attempt = 0) {
  let dumped = '';
  try { dumped = run('shell', 'uiautomator', 'dump', '/sdcard/matinf-reader.xml'); }
  catch (error) { if (attempt >= 5) throw error; await pause(1000); return nodes(attempt + 1); }
  if (!dumped.includes('dumped')) { if (attempt >= 5) throw new Error('Android UI hierarchy unavailable'); await pause(800); return nodes(attempt + 1); }
  const document = parseDocument(run('shell', 'cat', '/sdcard/matinf-reader.xml'), { xmlMode: true });
  const list = [];
  function walk(node) { if (node.attribs) list.push(node.attribs); if (node.children) node.children.forEach(walk); }
  walk(document);
  return list;
}
const label = node => node['content-desc'] || node.text || '';
async function waitText(text) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const list = await nodes();
    if (list.some(node => label(node).includes(text))) return list;
    await pause(750);
  }
  throw new Error(`Missing Android text: ${text}`);
}
async function tap(text, partial = false) {
  const list = await nodes();
  const matches = list.filter(node => partial ? label(node).includes(text) : label(node) === text);
  const node = matches.find(node => node.clickable === 'true') || matches[0];
  assert.ok(node, `Control exists: ${text}`);
  const numbers = node.bounds.match(/\d+/g).map(Number);
  run('shell', 'input', 'tap', String(Math.round((numbers[0] + numbers[2]) / 2)), String(Math.round((numbers[1] + numbers[3]) / 2)));
  await pause(500);
}
function capture(name) {
  run('shell', 'screencap', '-p', '/sdcard/matinf-reader.png');
  run('pull', '/sdcard/matinf-reader.png', resolve(output, name + '.png'));
}
async function scrollTo(text) {
  for (let attempt = 0; attempt < 16; attempt++) {
    const found = (await nodes()).find(node => label(node) === text);
    if (found) return found;
    run('shell', 'input', 'swipe', '550', '1950', '550', '650', '350');
    await pause(500);
  }
  throw new Error(`Missing scrollable Android control: ${text}`);
}
async function verifyOffline() {
  assert.ok(!hosted, 'Hosted offline checks require disconnecting device networking, not local port forwarding.');
  run('reverse', '--remove', 'tcp:9400');
  // Removing a forwarding rule does not close every pooled HTTP socket.
  // Restart the app to establish a fresh connection against the closed port.
  run('shell', 'am', 'force-stop', app); launch();
  await waitText('Početna'); await tap('Osoblje');
  await waitText('Prikazan je sačuvan sadržaj'); await waitText('Ana Primjer'); capture('offline-staff');
  run('shell', 'am', 'force-stop', app); launch();
  await waitText('Početna'); await tap('Predmeti');
  await waitText('Prikazan je sačuvan sadržaj'); await waitText('Algoritmi i strukture podataka'); capture('offline-after-restart');
}
try {
  if (!hosted) run('reverse', 'tcp:9400', 'tcp:9400');
  launch();
  await waitText('Početna');
  if (process.argv.includes('--preferences')) {
    const program = 'Diplomirani informatičar';
    const year = `4. godina, ${program}`;
    await tap('Podesi praćenje');
    await scrollTo('Osnovne studije'); await tap('Osnovne studije');
    await scrollTo(program); await tap(program);
    const checkbox = await scrollTo(year);
    if (checkbox.checked !== 'true') await tap(year);
    capture('preferences-fourth-year');
    await scrollTo('Sačuvaj izbor'); await tap('Sačuvaj izbor');
    await waitText('Početna');
    run('shell', 'am', 'force-stop', app); launch();
    await waitText('Početna'); await tap('Podesi praćenje');
    await waitText(`${program} · 4. godina`); capture('preferences-saved-summary');
    await scrollTo(program);
    assert.ok((await nodes()).some(node => label(node) === program && node.checked === 'true'), 'Saved program is already selected without tapping it');
    assert.equal((await scrollTo(year)).checked, 'true', 'Fourth year remains selected after restart');
    run('shell', 'input', 'swipe', '550', '650', '550', '2050', '400');
    await scrollTo('Master studije'); await tap('Master studije');
    await scrollTo('Algebra i geometrija'); capture('preferences-master');
    await scrollTo('Doktorske studije'); await tap('Doktorske studije');
    await scrollTo('Doktor matematičkih nauka'); capture('preferences-doctoral');
    run('shell', 'input', 'keyevent', '4'); await waitText('Početna');
    await tap('Podesi praćenje'); await scrollTo(program);
    assert.ok((await nodes()).some(node => label(node) === program && node.checked === 'true'), 'Back cancels unsaved program change');
    run('shell', 'input', 'keyevent', '4'); await waitText('Početna');
    await tap('Notifikacije'); await waitText(`${program} · 4. godina`); capture('preferences-personal-feed');
    console.log('PASS: program/year persist through restart, study levels separated, Back cancels unsaved changes, personal feed names saved selection.');
  } else if (process.argv.includes('--targeting')) {
    const program = 'Diplomirani matematičar i informatičar';
    const year = `2. godina, ${program}`;
    await tap('Podesi praćenje');
    await scrollTo('Osnovne studije'); await tap('Osnovne studije');
    await scrollTo(program); await tap(program);
    const checkbox = await scrollTo(year);
    if (checkbox.checked !== 'true') await tap(year);
    capture('selected-year');
    await scrollTo('Sačuvaj izbor'); await tap('Sačuvaj izbor');
    await waitText('Početna'); await tap('Notifikacije');
    await waitText('Sve objave');
    await scrollTo('Informativni sastanak za drugu godinu');
    capture('personal-year-feed');
    await tap('Informativni sastanak za drugu godinu');
    await waitText('Teme sastanka'); capture('targeted-article');
    run('shell', 'am', 'force-stop', app); launch();
    await waitText('Početna'); await tap('Podesi praćenje');
    await scrollTo('Studijski program');
    await scrollTo(program);
    assert.ok((await nodes()).some(node => label(node) === program && node.checked === 'true'), 'Program is restored without reselecting it');
    assert.equal((await scrollTo(year)).checked, 'true', 'Year selection survives native restart');
    run('shell', 'am', 'force-stop', app); launch();
    console.log('PASS: WordPress year selected in app, targeted article visible in personal feed, selection retained after native restart.');
  } else if (process.argv.includes('--offline')) {
    await verifyOffline();
    console.log('PASS: previously loaded staff and courses survive offline native restarts, with saved-content notice.');
  } else {
  await tap('Početna'); await waitText('Dobro došli.'); capture('home');
  console.log('Home loaded; checking staff and course details.');
  await tap('Osoblje'); await waitText('Ana Primjer'); capture('staff');
  await tap('Ana Primjer'); await waitText('Pošalji email'); capture('staff-detail');
  run('shell', 'input', 'keyevent', '4'); await waitText('Nastavno osoblje');
  await tap('Predmeti'); await waitText('Algoritmi i strukture podataka'); capture('courses');
  await tap('Algoritmi i strukture podataka'); await waitText('Pratite objave ovog predmeta'); capture('course-detail');
  run('shell', 'input', 'swipe', '550', '2050', '550', '600', '400'); await pause(600); capture('course-body');
  await tap('Notifikacije'); await waitText('Sve objave'); await tap('Sve objave'); await scrollTo('Predstavite svoj studentski projekat'); capture('feed');
  await tap('Predstavite svoj studentski projekat'); await waitText('Od ideje do rješenja'); capture('article');
  await tap('Više'); await waitText('Studijski programi'); capture('more');
  console.log('Feed and article loaded; checking study hierarchy and documents.');
  await tap('Studijski programi', true); await waitText('Diplomirani informatičar'); capture('studies');
  await tap('Diplomirani informatičar'); await waitText('O programu');
  run('shell', 'input', 'swipe', '550', '2050', '550', '600', '400'); await pause(600); capture('program-detail');
  await tap('Više'); await waitText('Dokumenti'); await tap('Dokumenti', true);
  await waitText('Primjer nastavnog plana (PDF)'); await tap('Primjer nastavnog plana (PDF)');
  await waitText('Otvori dokument'); capture('document-detail');
  await tap('Predmeti'); await waitText('Algoritmi i strukture podataka');
  if (!hosted) await verifyOffline();
  console.log(hosted ? 'PASS: five tabs and hosted WordPress course/profile/article/program details.' : 'PASS: five tabs, live WordPress lists, course/profile/article/program details, and cached content after offline restart.');
  }
} finally {
  if (!hosted) run('reverse', 'tcp:9400', 'tcp:9400');
}
