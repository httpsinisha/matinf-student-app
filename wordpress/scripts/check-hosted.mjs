import assert from 'node:assert/strict';

// Read-only acceptance check for a hosted installation with MATINF demo content.
const site = new URL(process.argv[2] || 'https://sinisa.alwaysdata.net');
assert.equal(site.protocol, 'https:');
const base = site.href.replace(/\/$/, '');
async function get(path, status = 200) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(20000), headers: { 'Cache-Control': 'no-cache' } });
  assert.equal(response.status, status, path);
  assert.ok(response.headers.get('content-type')?.includes('application/json'), `JSON response: ${path}`);
  return response.json();
}
const api = '/wp-json/matinf/v1';
const health = await get(api + '/health');
assert.equal(health.status, 'ok');
assert.equal(new URL(health.siteUrl).origin, site.origin);
const core = await get('/?rest_route=/');
assert.equal(new URL(core.url).protocol, 'https:', 'WordPress Address uses HTTPS');
assert.equal(new URL(core.home).protocol, 'https:', 'Site Address uses HTTPS');
const collections = {};
for (const collection of ['programs', 'courses', 'staff', 'documents', 'feed']) {
  const data = await get(`${api}/content/${collection}?per_page=50`);
  assert.ok(data.items.length > 0, collection);
  collections[collection] = data;
  for (const item of data.items) assert.equal(new URL(item.url).protocol, 'https:', item.title);
  console.log(`${collection}: ${data.total} public items`);
}
const course = await get(`${api}/content/courses/${collections.courses.items[0].id}`);
assert.ok(course.relations.program?.id);
assert.ok(course.relations.staff?.length);
assert.ok(course.relations.documents?.length);
await get(`${api}/content/courses/2147483647`, 404);
const program = collections.programs.items.find(item => item.slug === 'matematika-informatika');
assert.ok(program, 'Demo program exists');
const general = await get(`${api}/content/feed?following=true&per_page=50`);
const selected = await get(`${api}/content/feed?following=true&per_page=50&program_years=${program.id}:2`);
assert.ok(!general.items.some(item => item.slug === 'sastanak-druga-godina'));
assert.ok(selected.items.some(item => item.slug === 'sastanak-druga-godina'));
const document = collections.documents.items[0];
assert.equal(new URL(document.meta.fileUrl).protocol, 'https:', 'PDF uses HTTPS');
const pdf = await fetch(document.meta.fileUrl, { signal: AbortSignal.timeout(20000), headers: { Range: 'bytes=0-4' } });
assert.ok([200, 206].includes(pdf.status));
assert.ok(pdf.headers.get('content-type')?.includes('application/pdf'));
const reader = pdf.body.getReader();
try {
  const { value } = await reader.read();
  assert.equal(Buffer.from(value).subarray(0, 5).toString(), '%PDF-');
} finally { await reader.cancel(); }
console.log(`PASS: ${base} serves HTTPS JSON, academic relationships, targeted feeds, unavailable-content errors, and a valid PDF without browser authentication.`);
console.log('Not tested here: server-side outbound push requests, authenticated publication, or physical-device connectivity.');
