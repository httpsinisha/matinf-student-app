import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startWordPress } from '../scripts/runtime.mjs';

let site;
let fixtures;
const base = 'http://127.0.0.1:9410';
async function php(code) {
  const response = await site.playground.run({ code: `<?php require '/wordpress/wp-load.php'; ${code}` });
  assert.equal(response.exitCode, 0, response.errors);
  return JSON.parse(response.text);
}
async function request(path, options = {}) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(30000), ...options });
  return { status: response.status, json: await response.json() };
}
const api = '/wp-json/matinf/v1';

before(async () => {
  site = await startWordPress({ port: 9410, storage: '.test-runtime' });
  fixtures = await php(`
    $ids = [];
    foreach (['draft', 'private', 'publish'] as $status) {
      $ids[$status] = wp_insert_post(['post_type' => 'mf_program', 'post_title' => 'Integration fixture ' . $status, 'post_status' => $status, 'post_password' => $status === 'publish' ? 'private-fixture' : '']);
    }
    $ids['program'] = get_posts(['post_type' => 'mf_program', 'post_status' => 'publish', 'has_password' => false, 'numberposts' => 1])[0]->ID;
    $ids['course'] = get_posts(['post_type' => 'mf_course', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
    $ids['staff'] = get_posts(['post_type' => 'mf_staff', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
    $ids['unsafe'] = wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Unsafe integration fixture']);
    global $wpdb;
    $wpdb->update($wpdb->posts, ['post_content' => '<p>Hello <strong>world</strong></p><script>alert(1)</script><a href="javascript:alert(1)">bad</a><img src="https://example.invalid/demo.png" onerror="alert(2)">'], ['ID' => $ids['unsafe']]);
    clean_post_cache($ids['unsafe']);
    echo wp_json_encode($ids);
  `);
}, { timeout: 240000 });

after(async () => {
  if (site) {
    if (fixtures) await php(`foreach (${JSON.stringify([fixtures.draft, fixtures.private, fixtures.publish, fixtures.unsafe])} as $id) wp_delete_post($id, true); echo 'true';`);
    await site[Symbol.asyncDispose]();
  }
});

test('all six programs and public content are supplied by WordPress', async () => {
  const health = await request(`${api}/health`);
  assert.equal(health.status, 200);
  assert.equal(health.json.siteName, 'MATINF');
  for (const [collection, count] of Object.entries({ programs: 6, courses: 34, staff: 6, documents: 1, announcements: 5, news: 3 })) {
    const response = await request(`${api}/content/${collection}?per_page=50`);
    assert.equal(response.status, 200);
    assert.equal(response.json.total, count, collection);
    assert.equal(response.json.items.length, count);
    for (const item of response.json.items) {
      assert.equal(item.type, collection);
      assert.ok(item.id > 0 && item.url.startsWith(base));
      assert.ok(!JSON.stringify(item).includes('_matinf_'));
    }
  }
});

test('professor can publish own posts but cannot edit others, academics, users, or settings', async () => {
  const result = await php(`
    $user = wp_insert_user(['user_login' => 'integration-professor-' . wp_generate_password(6, false), 'user_pass' => wp_generate_password(40), 'role' => 'matinf_professor']);
    $other = wp_insert_post(['post_title' => 'Other author fixture', 'post_status' => 'publish', 'post_author' => get_user_by('login', 'matinf-admin')->ID]);
    wp_set_current_user($user);
    $request = new WP_REST_Request('POST', '/wp/v2/posts');
    $request->set_body_params(['title' => 'Professor REST publication', 'status' => 'publish', 'categories' => [get_term_by('slug', 'obavjestenja', 'category')->term_id]]);
    $created = rest_do_request($request);
    $own = $created->get_data()['id'] ?? 0;
    $result = ['published' => $created->get_status(), 'own' => current_user_can('edit_post', $own), 'other' => current_user_can('edit_post', $other), 'academic' => current_user_can('edit_post', ${fixtures.course}), 'settings' => current_user_can('manage_options'), 'users' => current_user_can('create_users')];
    $request = new WP_REST_Request('POST', '/wp/v2/mf_program');
    $request->set_body_params(['title' => 'Forbidden academic record', 'status' => 'draft']);
    $result['academicRest'] = rest_do_request($request)->get_status();
    $result['visible'] = rest_do_request(new WP_REST_Request('GET', '/matinf/v1/content/announcements/' . $own))->get_status();
    wp_set_current_user(get_user_by('login', 'matinf-admin')->ID);
    wp_delete_post($own, true); wp_delete_post($other, true);
    require_once ABSPATH . 'wp-admin/includes/user.php'; wp_delete_user($user);
    echo wp_json_encode($result);
  `);
  assert.deepEqual(result, { published: 201, own: true, other: false, academic: false, settings: false, users: false, academicRest: 403, visible: 200 });
});

test('personal feed matches course and inherited year targets, excludes unrelated audiences, and deduplicates', async () => {
  const result = await php(`
    $course = ${fixtures.course};
    $program = (int) get_post_meta($course, '_matinf_programId', true);
    $year = (int) get_post_meta($course, '_matinf_year', true);
    $ids = [];
    foreach (['general' => [], 'course' => ['audienceCourseIds' => [$course]], 'year' => ['audienceYears' => [$program . ':' . $year]], 'overlap' => ['audienceCourseIds' => [$course], 'audienceYears' => [$program . ':' . $year]]] as $key => $fields) {
      $ids[$key] = wp_insert_post(['post_title' => 'Audience fixture ' . $key, 'post_status' => 'publish', 'post_category' => [get_term_by('slug', 'obavjestenja', 'category')->term_id]]);
      matinf_store_fields($ids[$key], matinf_validate_fields('post', $fields));
    }
    $unrelated = get_posts(['post_type' => 'mf_course', 'post_status' => 'publish', 'numberposts' => 1, 'meta_query' => [['key' => '_matinf_programId', 'value' => $program, 'compare' => '!=', 'type' => 'NUMERIC']]])[0]->ID;
    $ids['unrelated'] = wp_insert_post(['post_title' => 'Audience fixture unrelated', 'post_status' => 'publish', 'post_category' => [get_term_by('slug', 'novosti', 'category')->term_id]]);
    matinf_store_fields($ids['unrelated'], matinf_validate_fields('post', ['audienceCourseIds' => [$unrelated]]));
    $fetch = function ($params) { $r = new WP_REST_Request('GET', '/matinf/v1/content/feed'); $r->set_query_params(array_merge(['following' => 'true', 'per_page' => 50], $params)); return rest_do_request($r)->get_data(); };
    $result = ['ids' => $ids, 'course' => array_column($fetch(['course_ids' => (string) $course])['items'], 'id'), 'year' => array_column($fetch(['program_years' => $program . ':' . $year])['items'], 'id'), 'general' => array_column($fetch([])['items'], 'id')];
    foreach ($ids as $id) wp_delete_post($id, true);
    echo wp_json_encode($result);
  `);
  for (const feed of [result.course, result.year]) {
    for (const key of ['general', 'course', 'year', 'overlap']) assert.ok(feed.includes(result.ids[key]), key);
    assert.ok(!feed.includes(result.ids.unrelated));
    assert.equal(feed.filter(id => id === result.ids.overlap).length, 1);
  }
  assert.ok(result.general.includes(result.ids.general));
  assert.ok(!result.general.includes(result.ids.course));
  for (const query of ['program_years=invalid', 'program_years=999999:1', 'course_ids=-1']) assert.equal((await request(`${api}/content/feed?following=true&${query}`)).status, 400);
});

test('pagination is bounded, deterministic, and rejects malformed input', async () => {
  const first = await request(`${api}/content/programs?per_page=2`);
  const second = await request(`${api}/content/programs?per_page=2&page=2`);
  assert.equal(first.json.totalPages, 3);
  assert.equal(first.json.items.length, 2);
  assert.ok(!first.json.items.some(a => second.json.items.some(b => a.id === b.id)));
  for (const query of ['per_page=51', 'per_page=0', 'page=0', 'page=abc', 'year=5', 'program_id=-1']) {
    assert.equal((await request(`${api}/content/courses?${query}`)).status, 400, query);
  }
  assert.deepEqual((await request(`${api}/content/programs?page=999`)).json.items, []);
});

test('draft, private, protected, and wrong-type detail requests return 404', async () => {
  for (const id of [fixtures.draft, fixtures.private, fixtures.publish, fixtures.course, 99999999]) {
    assert.equal((await request(`${api}/content/programs/${id}`)).status, 404);
  }
});

test('relationships are validated and unpublished staff never leak', async () => {
  const result = await php(`
    $course = ${fixtures.course};
    $program = get_post_meta($course, '_matinf_programId', true);
    $bad = matinf_validate_fields('mf_course', ['programId' => $program, 'year' => 99, 'semester' => 1]);
    $wrong = matinf_validate_fields('mf_course', ['programId' => $program, 'year' => 1, 'semester' => 1, 'staffIds' => [$program]]);
    $staff = get_post_meta($course, '_matinf_staffIds', true)[0];
    $before = count(matinf_content_item(get_post($course), 'courses', true)['relations']->staff);
    wp_update_post(['ID' => $staff, 'post_status' => 'draft']);
    $after = count(matinf_content_item(get_post($course), 'courses', true)['relations']->staff);
    wp_update_post(['ID' => $staff, 'post_status' => 'publish']);
    echo wp_json_encode(['badYear' => is_wp_error($bad), 'badType' => is_wp_error($wrong), 'before' => $before, 'after' => $after]);
  `);
  assert.deepEqual(result, { badYear: true, badType: true, before: 1, after: 0 });
  const list = await request(`${api}/content/courses?program_id=${fixtures.program}&year=1`);
  assert.ok(list.json.items.length > 0);
  assert.ok(list.json.items.every(item => item.meta.programId === fixtures.program && item.meta.year === 1));
});

test('HTML is sanitized and demo PDF is a real, reachable document', async () => {
  const detail = await request(`${api}/content/pages/${fixtures.unsafe}`);
  assert.equal(detail.status, 200);
  assert.match(detail.json.bodyHtml, /<strong>world<\/strong>/);
  assert.doesNotMatch(detail.json.bodyHtml, /<script|onerror|javascript:/i);
  const docs = await request(`${api}/content/documents`);
  const file = await fetch(docs.json.items[0].meta.fileUrl);
  assert.equal(file.status, 200);
  assert.match(await file.text(), /^%PDF-1.4/);
});

test('anonymous clients cannot create content or trigger administrative seeding', async () => {
  const write = await request('/wp-json/wp/v2/mf_program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Not allowed', status: 'publish' }) });
  assert.ok([401, 403].includes(write.status));
  const response = await fetch(`${base}/wp-admin/admin-post.php`, { method: 'POST', body: new URLSearchParams({ action: 'matinf_seed_demo' }), redirect: 'manual' });
  assert.ok([400, 401, 403].includes(response.status));
});

test('admin metadata updates require capability and nonce; invalid year keeps a draft', async () => {
  const result = await php(`
    $id = ${fixtures.course};
    $original = (int) get_post_meta($id, '_matinf_semester', true);
    $_POST = ['matinf_nonce' => 'bad', 'matinf' => ['programId' => get_post_meta($id, '_matinf_programId', true), 'year' => 1, 'semester' => $original === 1 ? 2 : 1]];
    wp_set_current_user(0);
    do_action('save_post', $id, get_post($id));
    $anonymous = (int) get_post_meta($id, '_matinf_semester', true) === $original;
    wp_set_current_user(get_user_by('login', 'matinf-admin')->ID);
    do_action('save_post', $id, get_post($id));
    $bad_nonce = (int) get_post_meta($id, '_matinf_semester', true) === $original;
    $_POST['matinf_nonce'] = wp_create_nonce('matinf_save_fields');
    $_POST['matinf']['staffIds'] = get_post_meta($id, '_matinf_staffIds', true);
    $_POST['matinf']['documentIds'] = get_post_meta($id, '_matinf_documentIds', true);
    do_action('save_post', $id, get_post($id));
    $valid = (int) get_post_meta($id, '_matinf_semester', true) !== $original;
    $_POST['matinf']['year'] = 99;
    do_action('save_post', $id, get_post($id));
    $invalid_draft = get_post_status($id) === 'draft';
    $_POST = [];
    update_post_meta($id, '_matinf_semester', $original);
    wp_update_post(['ID' => $id, 'post_status' => 'publish']);
    echo wp_json_encode(compact('anonymous', 'bad_nonce', 'valid', 'invalid_draft'));
  `);
  assert.deepEqual(result, { anonymous: true, bad_nonce: true, valid: true, invalid_draft: true });
});

test('demo seeding is idempotent and preserves administrator edits', async () => {
  const result = await php(`
    $id = ${fixtures.program};
    $original = get_the_title($id);
    wp_update_post(['ID' => $id, 'post_title' => 'Administrator edit']);
    matinf_seed_demo();
    $preserved = get_the_title($id) === 'Administrator edit';
    wp_update_post(['ID' => $id, 'post_title' => $original]);
    echo wp_json_encode(['preserved' => $preserved, 'count' => (int) wp_count_posts('mf_program')->publish]);
  `);
  assert.equal(result.preserved, true);
  assert.equal(result.count, 7); // Six public programs plus the password-protected fixture.
});

test('authenticated REST publishing cannot bypass required academic metadata', async () => {
  const statuses = await php(`
    wp_set_current_user(get_user_by('login', 'matinf-admin')->ID);
    $statuses = [];
    foreach (['mf_program', 'mf_course', 'mf_document'] as $type) {
      $request = new WP_REST_Request('POST', '/wp/v2/' . $type);
      $request->set_body_params(['title' => 'Invalid incomplete record', 'status' => 'publish']);
      $statuses[] = rest_do_request($request)->get_status();
    }
    echo wp_json_encode($statuses);
  `);
  assert.deepEqual(statuses, [400, 400, 400]);
});
