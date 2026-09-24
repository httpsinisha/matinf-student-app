import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDocument } from 'htmlparser2';
import assert from 'node:assert/strict';

const adb = resolve(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const app = 'com.matinf.demo';
const output = resolve('artifacts/push');
mkdirSync(output, { recursive: true });
const run = (...args) => execFileSync(adb, args, { encoding: 'utf8', timeout: 30000 });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const label = node => node['content-desc'] || node.text || '';
async function nodes() {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const message = run('shell', 'uiautomator', 'dump', '/sdcard/matinf-push.xml');
      if (!message.includes('dumped')) { await pause(1000); continue; }
      const document = parseDocument(run('shell', 'cat', '/sdcard/matinf-push.xml'), { xmlMode: true });
      const list = [];
      function walk(node) { if (node.attribs) list.push(node.attribs); node.children?.forEach(walk); }
      walk(document); return list;
    } catch (error) { if (attempt === 4) throw error; await pause(1000); }
  }
  throw new Error('Android hierarchy unavailable');
}
async function tapNode(node) {
  assert.ok(node, 'Android control exists');
  const [x1, y1, x2, y2] = node.bounds.match(/\d+/g).map(Number);
  run('shell', 'input', 'tap', String(Math.round((x1 + x2) / 2)), String(Math.round((y1 + y2) / 2)));
  await pause(800);
}
async function find(text, scroll = false) {
  const wanted = Array.isArray(text) ? text : [text];
  for (let attempt = 0; attempt < 15; attempt++) {
    const matches = (await nodes()).filter(node => wanted.includes(label(node)));
    if (matches.length) return matches.find(node => node.clickable === 'true') || matches[0];
    if (scroll) run('shell', 'input', 'swipe', '550', '2000', '550', '650', '400');
    await pause(700);
  }
  throw new Error(`Missing Android control: ${text}`);
}
function capture(name) {
  run('shell', 'screencap', '-p', '/sdcard/matinf-push.png');
  run('pull', '/sdcard/matinf-push.png', resolve(output, name + '.png'));
}

if (process.argv.includes('--background')) {
  run('shell', 'input', 'keyevent', '3');
  await pause(1500);
  run('shell', 'am', 'kill', app);
  await pause(1000);
  let running = false;
  try { running = !!run('shell', 'pidof', app).trim(); } catch (error) { if (error.status !== 1) throw error; }
  assert.equal(running, false, 'App process stopped in background without force-stop');
  console.log('App backgrounded and process killed without force-stop. Ready for a real cold-start notification test.');
} else if (process.argv.includes('--open-title')) {
  const title = process.argv[process.argv.indexOf('--open-title') + 1];
  assert.ok(title, 'Provide published post title');
  run('shell', 'cmd', 'statusbar', 'expand-notifications');
  await find(title); capture('received-notification'); await tapNode(await find(title));
  await find('Nazad'); await find(title); capture('opened-article');
  console.log('PASS: Android notification was visible and tapping it opened the titled article.');
} else {
  run('shell', 'am', 'start', '-W', '-n', `${app}/.MainActivity`);
  await tapNode(await find('Više'));
  const action = process.argv.includes('--disable') ? 'Isključi push obavještenja' : 'Uključi push obavještenja';
  const button = await find(['Isključi push obavještenja', 'Uključi push obavještenja'], true);
  if (label(button) === action) await tapNode(button);
  const permission = (await nodes()).find(node => node['resource-id']?.endsWith('/permission_allow_button'));
  if (permission) await tapNode(permission);
  const expected = process.argv.includes('--disable') ? 'Push obavještenja su isključena.' : 'Push je uključen za vaš sačuvani izbor.';
  const status = await find([expected, 'Izbor je povezan. Slanje na sajtu još nije uključeno.',
    'Android dozvola nije odobrena. Uključite je u podešavanjima telefona.',
    'Povezivanje nije uspjelo. Izbor je sačuvan; pokušajte ponovo.',
    'Push još nije podešen u ovoj verziji aplikacije.']);
  capture(process.argv.includes('--disable') ? 'disabled' : 'registered');
  assert.equal(label(status), expected, 'Actual device push registration status');
  console.log(`PASS: ${expected}`);
}
