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
test('calendar resource validation blocks cross-program bookings without writes or announcements', async () => {
  const result = await php(`
    wp_set_current_user(get_user_by('login', 'matinf-admin')->ID);
    $saved = get_option('matinf_calendar_overrides', []); $schedule = get_option('matinf_schedule', []);
    $created = []; $checks = [];
    $check = function($ok, $name) use (&$checks) { if (!$ok) throw new RuntimeException($name); $checks[] = $name; };
    $create = function($type, $title, $meta = []) use (&$created) {
      $id = wp_insert_post(['post_type'=>$type, 'post_status'=>'publish', 'post_title'=>$title]); $created[] = $id;
      foreach ($meta as $key=>$value) update_post_meta($id, '_matinf_' . $key, $value);
      return $id;
    };
    try {
      $a = $create('mf_program', 'Validation A', ['durationYears'=>4]);
      $b = $create('mf_program', 'Validation B', ['durationYears'=>4]);
      $teacher = $create('mf_staff', 'Validation Professor');
      $ca = $create('mf_course', 'Validation Course A', ['programId'=>$a,'year'=>4,'semester'=>1]);
      $cb = $create('mf_course', 'Validation Course B', ['programId'=>$b,'year'=>4,'semester'=>1,'staffIds'=>[$teacher]]);
      $overrides = $saved;
      foreach ([$a,$b] as $p) foreach (['classes','exams','graduate'] as $t) $overrides[matinf_calendar_key($t,$p,4,1)] = [];
      $row = ['id'=>'validation-a','courseId'=>$ca,'programId'=>$a,'year'=>4,'semester'=>1,'day'=>1,'kind'=>'Predavanje','start'=>'09:00','end'=>'11:00','room'=>'Validation Room','staffId'=>$teacher];
      $other = array_merge($row,['id'=>'validation-b','courseId'=>$cb,'programId'=>$b]);
      $key = matinf_calendar_key('classes',$a,4,1); $otherKey = matinf_calendar_key('classes',$b,4,1);
      $overrides[$otherKey] = [$other]; update_option('matinf_calendar_overrides',$overrides,false);
      $revision = matinf_calendar_revision($key); $posts = wp_count_posts('post');
      $error = matinf_calendar_save('classes',$a,4,1,[$row],$revision,true);
      $check(is_wp_error($error) && $error->get_error_code()==='resource_conflict', 'cross-program room/teacher blocked');
      $check(str_contains($error->get_error_message(),'Validation Course B') && str_contains($error->get_error_message(),'Validation Professor') && str_contains($error->get_error_message(),'09:00–11:00'), 'error identifies occupied event');
      $check(get_option('matinf_calendar_overrides')===$overrides && wp_count_posts('post')==$posts && !get_option('matinf_calendar_lock'), 'rejection writes nothing and releases lock');
      $check(is_wp_error(matinf_calendar_resource_conflict('classes',$a,4,1,[array_merge($row,['room'=>'Other room'])])), 'teacher alone conflicts');
      $check(is_wp_error(matinf_calendar_resource_conflict('classes',$a,4,1,[array_merge($row,['staffId'=>0,'room'=>'  VALIDATION   ROOM  '])])), 'normalized room alone conflicts');
      $check(matinf_calendar_room_key(' UČIONICA  101 ' )===matinf_calendar_room_key('učionica 101'), 'unicode room case');
      foreach ([['day'=>2],['start'=>'11:00','end'=>'12:00'],['start'=>'08:00','end'=>'09:00'],['room'=>'Free room','staffId'=>0]] as $change) {
        $check(matinf_calendar_resource_conflict('classes',$a,4,1,[array_merge($row,$change)])===null, 'independent slot ' . wp_json_encode($change));
      }
      $check(matinf_calendar_resource_conflict('classes',$a,4,2,[$row])===null, 'different semesters allowed');
      $overrides[$otherKey]=[]; update_option('matinf_calendar_overrides',$overrides,false);
      update_option('matinf_schedule',array_merge($schedule,[$other]),false);
      $check(matinf_calendar_resource_conflict('classes',$a,4,1,[$row])===null, 'empty override suppresses legacy calendar');
      unset($overrides[$otherKey]); update_option('matinf_calendar_overrides',$overrides,false);
      $check(is_wp_error(matinf_calendar_resource_conflict('classes',$a,4,1,[$row])), 'legacy calendar is validated');
      $overrides[$otherKey]=[]; update_option('matinf_calendar_overrides',$overrides,false);
      $save = matinf_calendar_save('classes',$a,4,1,[$row],$revision);
      $check(!is_wp_error($save), 'free slot saves');
      $again = matinf_calendar_save('classes',$a,4,1,[$row],$save['revision']);
      $check(!is_wp_error($again), 'own previous calendar excluded');
      $overrides = get_option('matinf_calendar_overrides');
      $exam = array_merge($row,['date'=>'2027-06-07','period'=>'Test']);
      $otherExam = array_merge($other,['date'=>'2027-06-07','period'=>'Test']);
      $graduateKey = matinf_calendar_key('graduate',$b,4,1);
      $overrides[$graduateKey]=[$otherExam]; update_option('matinf_calendar_overrides',$overrides,false);
      $check(is_wp_error(matinf_calendar_resource_conflict('exams',$a,4,1,[$exam])), 'regular versus graduate conflict');
      $check(matinf_calendar_resource_conflict('exams',$a,4,1,[array_merge($exam,['date'=>'2027-06-08'])])===null, 'different exam dates allowed');
      $overrides[$graduateKey]=[]; $overrides[matinf_calendar_key('exams',$b,4,1)]=[$otherExam]; update_option('matinf_calendar_overrides',$overrides,false);
      $check(is_wp_error(matinf_calendar_resource_conflict('graduate',$a,4,1,[$exam])), 'graduate versus regular conflict');
      $check(is_wp_error(matinf_calendar_resource_conflict('exams',$a,4,1,[$exam])), 'regular versus regular conflict');
      $overrides[matinf_calendar_key('exams',$a,4,1)]=[$exam]; update_option('matinf_calendar_overrides',$overrides,false);
      $check(is_wp_error(matinf_calendar_resource_conflict('graduate',$a,4,1,[$exam])), 'same cohort other exam calendar conflicts');
      unset($overrides[matinf_calendar_key('exams',$b,4,1)]); update_option('matinf_calendar_overrides',$overrides,false);
      $generated = matinf_generated_exam_rows($b,4)[0];
      $check(is_wp_error(matinf_calendar_resource_conflict('exams',$a,4,1,[array_merge($exam,['date'=>$generated['date'],'start'=>'10:00','end'=>'11:00','room'=>'Independent room'])])), 'generated exam teacher and default duration checked');
      $empty = matinf_calendar_save('classes',$a,4,1,[],matinf_calendar_revision($key));
      $check(!is_wp_error($empty) && matinf_calendar_classes($a,4,1)===[], 'deleting calendar frees resources');
      echo wp_json_encode($checks);
    } finally {
      update_option('matinf_calendar_overrides',$saved,false); update_option('matinf_schedule',$schedule,false);
      foreach (array_reverse($created) as $id) wp_delete_post($id,true);
    }
  `);
  assert.equal(result.length, 22, result.join('\n'));
});
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
test('graduate calendar only contains three fourth-year courses in two periods', async () => {
  const programs = await (await fetch(base + '/wp-json/matinf/v1/content/programs')).json();
  for (const program of programs.items) {
    const response = await fetch(`${base}/wp-json/matinf/v1/schedule?program_id=${program.id}&year=1&semester=1`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(data.exams.every(row => row.year === 1), 'Regular exams still respect selected year');
    const rows = data.graduateExams;
    if (program.meta.durationYears < 4) assert.deepEqual(rows, []);
    else {
      assert.equal(rows.length, 6);
      assert.ok(rows.every(row => row.year === 4));
      assert.equal(new Set(rows.map(row => row.courseId)).size, 3);
      assert.equal(new Set(rows.map(row => row.period)).size, 2);
      assert.equal(new Set(rows.map(row => row.date + row.start)).size, rows.length);
    }
  }
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

test('calendar edits validate audience, permissions, conflicts and publish stable exam IDs', async () => {
  const result = await php(`
    $saved = get_option('matinf_calendar_overrides', []);
    $user = wp_insert_user(['user_login'=>'calendar-prof-' . wp_generate_password(8,false), 'user_pass'=>wp_generate_password(40), 'role'=>'matinf_professor']);
    try {
      $course = get_posts(['post_type'=>'mf_course','numberposts'=>1,'meta_query'=>[['key'=>'_matinf_year','value'=>4]]])[0];
      $pid=(int)get_post_meta($course->ID,'_matinf_programId',true); $sem=(int)get_post_meta($course->ID,'_matinf_semester',true);
      $key=matinf_calendar_key('exams',$pid,4,$sem); $revision=matinf_calendar_revision($key);
      $row=['courseId'=>$course->ID,'start'=>'09:00','end'=>'11:00','room'=>'A1','date'=>'2027-01-15','period'=>'Test rok'];
      wp_set_current_user(0); $forbidden=matinf_calendar_save('exams',$pid,4,$sem,[$row],$revision)->get_error_code();
      wp_set_current_user($user); $save=matinf_calendar_save('exams',$pid,4,$sem,[$row],$revision);
      $read=matinf_exam_rows($pid,4); $id=$read[0]['id'];
      $stale=matinf_calendar_save('exams',$pid,4,$sem,[$row],$revision)->get_error_code();
      $badYear=matinf_calendar_save('exams',$pid,1,$sem,[$row],$save['revision'])->get_error_code();
      $badDate=matinf_calendar_save('exams',$pid,4,$sem,[array_merge($row,['date'=>'2027-02-30'])],$save['revision'])->get_error_code();
      $overlap=matinf_calendar_save('exams',$pid,4,$sem,[$row,$row],$save['revision'])->get_error_code();
      $row['id']=$id; $row['room']='B2'; $edited=matinf_calendar_save('exams',$pid,4,$sem,[$row],$save['revision']);
      $after=matinf_exam_rows($pid,4);
      $empty=matinf_calendar_save('exams',$pid,4,$sem,[],$edited['revision']);
      echo wp_json_encode(['forbidden'=>$forbidden,'save'=>$save['count'],'offset'=>$read[0]['startsAt'],'stale'=>$stale,'badYear'=>$badYear,'badDate'=>$badDate,'overlap'=>$overlap,'sameId'=>$after[0]['id']===$id,'room'=>$after[0]['room'],'empty'=>matinf_exam_rows($pid,4)]);
    } finally { update_option('matinf_calendar_overrides',$saved,false); wp_set_current_user(get_user_by('login','matinf-admin')->ID); require_once ABSPATH . 'wp-admin/includes/user.php'; wp_delete_user($user); }
  `);
  assert.deepEqual(result, { forbidden: 'forbidden', save: 1, offset: '2027-01-15T09:00:00+01:00', stale: 'conflict', badYear: 'course', badDate: 'date', overlap: 'overlap', sameId: true, room: 'B2', empty: [] });
});

test('staff update preserves all profile identities and replaces all requested names once', async () => {
  const result = await php(`
    delete_option('matinf_staff_names_version'); matinf_update_staff_names();
    $names=json_decode(file_get_contents(WP_PLUGIN_DIR . '/matinf-core/data/staff.json'),true); $actual=[];
    foreach($names as $i=>$name) { $p=get_posts(['post_type'=>'mf_staff','numberposts'=>1,'meta_key'=>'_matinf_sourceKey','meta_value'=>'staff-'.$i]); $actual[]=get_the_title($p[0]->ID); }
    echo wp_json_encode(['names'=>$actual===$names,'count'=>count($actual),'version'=>get_option('matinf_staff_names_version')]);
  `);
  assert.deepEqual(result, { names: true, count: 35, version: '2026-09-26' });
});
