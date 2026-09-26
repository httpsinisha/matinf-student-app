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

const base = 'https://sinisa.alwaysdata.net';
launch(); await waitText('Notifikacije'); await tap('Početna'); capture('native-new-logo');
if (!process.argv.includes('--reminders-only')) {
for (const [tab, collection] of [['Osoblje', 'staff'], ['Predmeti', 'courses']]) {
  const data = await (await fetch(`${base}/wp-json/matinf/v1/content/${collection}?per_page=50`)).json();
  const titles = new Set(data.items.map(row => row.title));
  await tap(tab);
  await waitText((collection === 'staff' ? data.items.find(row => row.meta.staffGroup === 'Rukovodioci') : data.items[0]).title);
  for (let i = 0; i < 3; i++) { run('shell', 'input', 'swipe', '550', '1900', '550', '750', '300'); await pause(250); }
  const visible = (await nodes()).filter(node => titles.has(label(node)) && node.clickable === 'true');
  const chosen = visible.find(node => { const b = node.bounds.match(/\d+/g).map(Number); return b[1] > 300 && b[3] < 2100; });
  assert.ok(chosen, `${tab}: visible item after scrolling`);
  const before = chosen.bounds.match(/\d+/g).map(Number);
  await tap(label(chosen)); await waitText('Nazad'); await pause(700); await tap('Nazad');
  let after = (await nodes()).find(node => label(node) === label(chosen));
  assert.ok(after, `${tab}: same item after back`);
  assert.ok(after.bounds.match(/\d+/g).map(Number).every((value, i) => Math.abs(value - before[i]) < 8), `${tab}: bounds retained after back`);
  await tap('Početna'); await tap(tab);
  after = (await nodes()).find(node => label(node) === label(chosen));
  assert.equal(after?.bounds, chosen.bounds, `${tab}: bounds retained after tab switch`);
  capture(`native-scroll-${collection}`);
  console.log(`PASS: native ${tab} back and tab scroll retention.`);
}
await tap('Notifikacije'); await waitText('Nepročitane'); capture('native-notifications-updated');
if (process.argv.includes('--scroll-only')) process.exit(0);
}
await tap('Više'); await tap('Moj raspored', true); await waitText('Ispiti'); await tap('Ispiti');
await scrollTo('Podsjeti me'); await tap('Podsjeti me'); await waitText('Sat prije'); await tap('Sat prije');
const permission = (await nodes()).find(node => ['Allow', 'Dozvoli'].includes(label(node)));
if (permission) await tap(label(permission));
await waitText('Otkaži podsjetnik'); capture('native-reminder-set');
await tap('Više'); await tap('Moji podsjetnici', true); await waitText('Otkaži podsjetnik'); capture('native-reminders');
run('shell', 'am', 'force-stop', app); launch(); await waitText('Notifikacije');
await tap('Više'); await tap('Moji podsjetnici', true); await waitText('Otkaži podsjetnik');
await tap('Otkaži podsjetnik'); await waitText('Nemate uključenih podsjetnika.');
console.log('PASS: native reminder scheduling, persistence after restart and cancellation.');
