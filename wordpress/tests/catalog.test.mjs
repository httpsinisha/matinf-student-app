import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { startWordPress } from '../scripts/runtime.mjs';
let site;
const base = 'http://127.0.0.1:9412';
async function php(code) {
  const result = await site.playground.run({ code: `<?php require '/wordpress/wp-load.php'; ${code}` });
  assert.equal(result.exitCode, 0, result.errors);
  return JSON.parse(result.text);
}
before(async () => { site = await startWordPress({ port: 9412, storage: '.catalog-test-runtime' }); }, { timeout: 240000 });
after(async () => { if (site) await site[Symbol.asyncDispose](); });
test('catalog import preserves program IDs, imports exact facts, archives demo records and is idempotent', async () => {
  const result = await php(`
    $before = get_posts(['post_type' => 'mf_program', 'numberposts' => -1, 'fields' => 'ids']);
    $result = matinf_import_catalog(true); $again = matinf_import_catalog(true);
    $after = get_posts(['post_type' => 'mf_program', 'numberposts' => -1, 'fields' => 'ids']);
    $course = get_posts(['post_type' => 'mf_course', 'numberposts' => 1, 'meta_key' => '_matinf_sourceKey', 'meta_value' => 'course-informatika-1-1-' . md5('Osnovi programiranja 1')])[0];
    echo wp_json_encode(['result' => $result, 'again' => $again, 'before' => $before, 'after' => $after, 'ects' => get_post_meta($course->ID, '_matinf_ects', true), 'lectures' => get_post_meta($course->ID, '_matinf_lectures', true), 'exercises' => get_post_meta($course->ID, '_matinf_exercises', true), 'total' => wp_count_posts('mf_course')->publish]);
  `);
  assert.deepEqual(result.before.sort(), result.after.sort());
  assert.deepEqual(result.again, result.result);
  assert.equal(result.result.courses, 174);
  assert.equal(Number(result.total), 174);
  assert.equal(Number(result.ects), 8);
  assert.equal(Number(result.lectures), 3);
  assert.equal(Number(result.exercises), 2);
});
test('bounded import pauses before writes and resumes existing records without duplication', async () => {
  const result = await php(`
    $key = 'batch-fixture-' . wp_generate_password(8, false);
    $GLOBALS['matinf_catalog_budget'] = 0; $paused = false; $id = 0;
    try {
      try { matinf_catalog_upsert($key, 'mf_staff', 'Batch fixture', '', ['academicTitle' => 'Demo', 'email' => '']); } catch (Matinf_Catalog_Batch_Complete $e) { $paused = true; }
      $GLOBALS['matinf_catalog_budget'] = 1;
      $id = matinf_catalog_upsert($key, 'mf_staff', 'Batch fixture', '', ['academicTitle' => 'Demo', 'email' => '']);
      $again = matinf_catalog_upsert($key, 'mf_staff', 'Do not overwrite', '', ['academicTitle' => 'Demo', 'email' => '']);
      echo wp_json_encode(['paused' => $paused, 'same' => $id === $again, 'title' => get_the_title($id), 'budget' => $GLOBALS['matinf_catalog_budget']]);
    } finally { unset($GLOBALS['matinf_catalog_budget']); if ($id) wp_delete_post($id, true); }
  `);
  assert.deepEqual(result, { paused: true, same: true, title: 'Batch fixture', budget: 0 });
});
test('timetable API covers every undergraduate year and semester without cohort overlaps', async () => {
  const programs = await (await fetch(base + '/wp-json/matinf/v1/content/programs')).json();
  for (const program of programs.items.filter(p => p.meta.level === 'undergraduate')) {
    for (let year = 1; year <= 4; year++) for (let semester = 1; semester <= 2; semester++) {
      const response = await fetch(`${base}/wp-json/matinf/v1/schedule?program_id=${program.id}&year=${year}&semester=${semester}`);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.demo, true); assert.ok(data.items.length > 0);
      let previous;
      for (const row of data.items) {
        assert.equal(row.programId, program.id); assert.equal(row.year, year); assert.equal(row.semester, semester);
        assert.ok(row.course.id > 0 && row.start < row.end && row.day >= 1 && row.day <= 5);
        if (previous?.day === row.day) assert.ok(previous.end <= row.start, 'No overlapping cohort events');
        previous = row;
      }
    }
  }
  assert.equal((await fetch(base + '/wp-json/matinf/v1/schedule?program_id=999999&year=1')).status, 400);
  assert.equal((await fetch(base + '/wp-json/matinf/v1/schedule?program_id=1&year=0')).status, 400);
});
test('publishing supports grouped multiple audiences and only editable media attachments', async () => {
  const result = await php(`
    $admin = get_user_by('login', 'matinf-admin'); wp_set_current_user($admin->ID);
    $user = wp_insert_user(['user_login' => 'catalog-prof-' . wp_generate_password(6, false), 'user_pass' => wp_generate_password(40), 'role' => 'matinf_professor']);
    $programs = get_posts(['post_type' => 'mf_program', 'numberposts' => -1]);
    $courses = get_posts(['post_type' => 'mf_course', 'numberposts' => 2]);
    $own = wp_insert_attachment(['post_title' => 'Upload fixture', 'post_author' => $user, 'post_mime_type' => 'application/pdf', 'guid' => home_url('/wp-content/uploads/fixture.pdf')]);
    $other = wp_insert_attachment(['post_title' => 'Other upload', 'post_author' => $admin->ID, 'post_mime_type' => 'application/pdf', 'guid' => home_url('/wp-content/uploads/other.pdf')]);
    $post = wp_insert_post(['post_title' => 'Attachment fixture', 'post_status' => 'publish', 'post_author' => $user]);
    try {
      wp_set_current_user($user);
      $input = ['everyone' => false, 'audienceYears' => [$programs[0]->ID . ':1', $programs[1]->ID . ':1'], 'audienceCourseIds' => array_column($courses, 'ID'), 'attachmentIds' => [$own]];
      $valid = matinf_validate_fields('post', $input); if (is_wp_error($valid)) throw new RuntimeException($valid->get_error_message());
      matinf_store_fields($post, $valid);
      ob_start(); matinf_audience_box(get_post($post)); $html = ob_get_clean();
      $input['attachmentIds'] = [$other]; $denied = matinf_validate_fields('post', $input);
      $item = matinf_content_item(get_post($post), 'news', true);
      echo wp_json_encode(['years' => $item['meta']->audience['programYears'], 'courses' => $item['meta']->audience['courseIds'], 'files' => $item['meta']->attachments, 'denied' => is_wp_error($denied), 'html' => $html]);
    } finally { wp_set_current_user($admin->ID); wp_delete_post($post, true); wp_delete_attachment($own, true); wp_delete_attachment($other, true); require_once ABSPATH . 'wp-admin/includes/user.php'; wp_delete_user($user); }
  `);
  assert.equal(result.years.length, 2); assert.equal(result.courses.length, 2); assert.equal(result.files.length, 1); assert.equal(result.denied, true);
  assert.match(result.html, /type="checkbox" name="matinf\[audienceYears\]\[\]"/);
  assert.ok(result.html.indexOf('Osnovne studije') < result.html.indexOf('Master studije'));
  assert.ok(result.html.indexOf('Master studije') < result.html.indexOf('Doktorske studije'));
});
