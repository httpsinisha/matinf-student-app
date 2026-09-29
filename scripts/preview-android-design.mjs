import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDocument } from 'htmlparser2';
const adb = resolve(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const output = resolve('artifacts/android-redesign');
mkdirSync(output, { recursive: true });
const run = (...args) => execFileSync(adb, ['-s', 'emulator-5554', ...args], { encoding: 'utf8', timeout: 30000 });
const pause = ms => new Promise(r => setTimeout(r, ms));
async function nodes() {
  run('shell', 'uiautomator', 'dump', '/sdcard/matinf-design.xml');
  const xml = run('shell', 'cat', '/sdcard/matinf-design.xml');
  const all = [];
  function walk(node) { if (node.attribs) all.push(node.attribs); node.children?.forEach(walk); }
  walk(parseDocument(xml, { xmlMode: true }));
  return { all, xml };
}
const [action, value = 'screen'] = process.argv.slice(2);
if (action === 'tap') {
  const { all } = await nodes();
  const match = all.find(n => n['content-desc'] === value && n.clickable === 'true') || all.find(n => n.text === value || n['content-desc'] === value);
  if (!match) throw new Error('Missing control: ' + value);
  const [x1, y1, x2, y2] = match.bounds.match(/\d+/g).map(Number);
  run('shell', 'input', 'tap', String((x1 + x2) / 2), String((y1 + y2) / 2));
  await pause(1800);
} else if (action === 'back') { run('shell', 'input', 'keyevent', '4'); await pause(800); }
else if (action === 'scroll') { run('shell', 'input', 'swipe', '550', '1800', '550', '650', '500'); await pause(700); }
const { all, xml } = await nodes();
writeFileSync(resolve(output, value + '.xml'), xml);
writeFileSync(resolve(output, value + '.png'), execFileSync(adb, ['-s', 'emulator-5554', 'exec-out', 'screencap', '-p']));
console.log(all.map(n => n['content-desc'] || n.text).filter(Boolean).join('\n'));
