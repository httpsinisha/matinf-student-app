import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseDocument } from 'htmlparser2';
import assert from 'node:assert/strict';
const alphabet = [...'абвгдђежзијклљмнњопрстћуфхцчџш'];
const latin = ['a','b','v','g','d','đ','e','ž','z','i','j','k','l','lj','m','n','nj','o','p','r','s','t','ć','u','f','h','c','č','dž','š'];
const translit = value => [...value].map(c => { const i = alphabet.indexOf(c.toLowerCase()); return i < 0 ? c : c === c.toUpperCase() ? latin[i][0].toUpperCase() + latin[i].slice(1) : latin[i]; }).join('');
const clean = value => translit(value).replace(/\s+/g, ' ').trim();
const text = n => n.type === 'text' ? n.data : (n.children || []).map(text).join('');
const all = (n, p) => [...(p(n) ? [n] : []), ...(n.children || []).flatMap(c => all(c, p))];
const specs = [
  [6, 'opsti', 'Diplomirani matematičar i informatičar', 'undergraduate', 4, 240],
  [10, 'informatika', 'Diplomirani informatičar', 'undergraduate', 4, 240],
  [5, 'nastavni', 'Diplomirani profesor matematike i informatike', 'undergraduate', 4, 240],
  [8, 'analiza', 'Matematička analiza i primjene', 'master', 1, 60],
  [9, 'algebra', 'Algebra i geometrija', 'master', 1, 60],
  [1, 'doktorat', 'Doktor matematičkih nauka', 'doctoral', 3, 180],
];
const programs = [];
for (const [page, key, name, level, years, ects] of specs) {
  const source = JSON.parse(readFileSync(`artifacts/catalog-source/${page}.json`, 'utf8'));
  const doc = parseDocument(readFileSync(`artifacts/catalog-source/${page}.html`, 'utf8'));
  const content = all(doc, n => (n.attribs?.class || '').split(' ').includes('entry-content'))[0];
  const tables = all(content, n => n.name === 'table');
  const rows = [];
  let semester = 1;
  tables.forEach((table, tableIndex) => {
    if (page === 10) semester = tableIndex + 1;
    for (const row of all(table, n => n.name === 'tr')) {
      const cells = all(row, n => ['td','th'].includes(n.name)).map(n => clean(text(n)));
      const heading = cells[0]?.match(/^(\d+)\. Semestar/i);
      if (heading) semester = Number(heading[1]);
      if (!/^\d+\.?$/.test(cells[0] || '') || cells.length < 4) continue;
      if (page === 1) {
        rows.push({ name: cells[1], semester: cells[3] === 'I' ? 1 : 2, year: 1, ects: Number(cells[2]), lectures: null, exercises: null, electiveGroup: 'Doktorski izborni predmeti' });
      } else {
        const hours = page === 10 ? [cells[2], cells[3]] : cells[2].split('+');
        rows.push({ name: cells[1], semester: (semester - 1) % 2 + 1, year: Math.ceil(semester / 2), ects: Number(cells.at(-1)), lectures: Number(hours[0]), exercises: Number(hours[1] || 0), electiveGroup: '' });
      }
    }
  });
  const children = content.children.filter(n => n.name);
  const tail = children.slice(children.findLastIndex(n => n.name === 'table') + 1);
  const choices = {};
  let group = '';
  for (const node of tail) {
    const value = clean(text(node));
    if (/^Izborni predmet/.test(value)) { group = value.replace(/:$/, '').replace(/\s+/g,' '); choices[group] = []; }
    else if (value && group && level !== 'doctoral') {
      const values = ['ol','ul'].includes(node.name) ? all(node, n => n.name === 'li').map(n => clean(text(n))) : [value.replace(/^\d+\.\s*/, '')];
      choices[group].push(...values);
    }
  }
  const courses = [];
  for (const row of rows) {
    if (/^Iz(?:borni|abrani) predmet/.test(row.name)) {
      const groupKey = row.name.includes('Grupa R') ? 'Izborni predmeti grupa ' + row.name.match(/Grupa (R\d)/)[1] : row.name.replace('Izabrani', 'Izborni');
      assert.ok(choices[groupKey]?.length, `Missing choices: ${key} ${groupKey}`);
      for (const name of choices[groupKey]) courses.push({ ...row, name, electiveGroup: groupKey, demoSelected: name === choices[groupKey][row.name.includes('predmet 6') ? 1 : 0] });
    } else courses.push({ ...row, demoSelected: true });
  }
  const uniqueMap = new Map();
  for (const course of courses) {
    const id = `${course.year}:${course.semester}:${course.name}`;
    uniqueMap.set(id, { ...course, demoSelected: course.demoSelected || uniqueMap.get(id)?.demoSelected || false });
  }
  const unique = [...uniqueMap.values()];
  for (const course of unique) {
    const link = source.links.find(link => clean(link.title) === course.name);
    course.syllabusUrl = link?.url.replace('http:', 'https:') || '';
    assert.ok(course.name && Number.isFinite(course.ects) && course.year >= 1 && course.year <= years);
  }
  programs.push({ key, name, level, years, ects, sourceUrl: source.url.replace('http:', 'https:'), courses: unique });
  console.log(key, unique.length, 'courses');
}
const data = { version: '2026-09-25', retrievedAt: new Date().toISOString(), source: 'https://matinf.pmf.unibl.org/', programs };
mkdirSync('wordpress/plugins/matinf-core/data', { recursive: true });
writeFileSync('wordpress/plugins/matinf-core/data/catalog.json', JSON.stringify(data, null, 2) + '\n');
