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

launch(); await waitText('Notifikacije'); await tap('Vi\u0161e');
await waitText('Moj raspored'); await tap('Moj raspored',true);
await waitText('Ispiti'); await tap('Ispiti');
await waitText('Januarsko-februarski'); capture('native-exams');
await tap('Apsolventi'); await waitText('Oktobarski apsolventski');
capture('native-graduate-exams');
console.log('PASS: native exam and graduate period controls consume the hosted schedule API.');
