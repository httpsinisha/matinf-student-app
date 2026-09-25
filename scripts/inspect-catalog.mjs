import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseDocument } from 'htmlparser2';
const root = 'artifacts/catalog-source';
mkdirSync(root, { recursive: true });
const text = node => node.type === 'text' ? node.data : (node.children || []).map(text).join('');
const all = (node, predicate) => [...(predicate(node) ? [node] : []), ...(node.children || []).flatMap(child => all(child, predicate))];
const home = parseDocument(readFileSync('artifacts/matinf-source.html', 'utf8'));
const links = all(home, n => n.name === 'a' && n.attribs.href).map(n => ({ title: text(n).trim(), url: n.attribs.href }));
const selected = links.filter(n => /^(Наставни смјер|Општи смјер|Информатички смјер|Мастер студије|Докторске студије|Распоред часова|Наставници|Сарадници)$/.test(n.title));
if (process.argv.includes('--more')) {
  selected.length = 0;
  for (const id of [0, 7]) {
    const page = JSON.parse(readFileSync(`${root}/${id}.json`, 'utf8'));
    selected.push(...page.links.filter(link => /^(Мастер математике|Наставни план и програм)/.test(link.title)));
  }
}
for (const [i, link] of selected.entries()) {
  const index = process.argv.includes('--more') ? i + 8 : i;
  const file = `${root}/${index}.html`;
  execFileSync('curl.exe', ['-sSL', '--max-time', '45', '-o', file, link.url.replace('http:', 'https:') + '?rstr=lat']);
  const doc = parseDocument(readFileSync(file, 'utf8'));
  const content = all(doc, n => (n.attribs?.class || '').split(' ').includes('entry-content'))[0] || doc;
  const contentLinks = all(content, n => n.name === 'a' && n.attribs.href).map(n => ({ title: text(n).trim(), url: n.attribs.href }));
  writeFileSync(`${root}/${index}.json`, JSON.stringify({ ...link, text: text(content), links: contentLinks }, null, 2));
  console.log(index, link.title, text(content).trim().slice(0, 200), contentLinks.length);
}
