<?php
defined('ABSPATH') || exit;

function matinf_can_edit_calendar() {
    return current_user_can('manage_options') || in_array('matinf_professor', wp_get_current_user()->roles, true);
}
function matinf_calendar_key($type, $pid, $year, $semester) {
    return $type . ':' . $pid . ':' . ($type === 'graduate' ? 4 : $year) . ':' . ($type === 'classes' ? $semester : 0);
}
function matinf_calendar_revision($key) {
    $all = get_option('matinf_calendar_overrides', []);
    return hash('sha256', wp_json_encode($all[$key] ?? null));
}
function matinf_calendar_classes($pid, $year, $semester) {
    $all = get_option('matinf_calendar_overrides', []);
    $key = matinf_calendar_key('classes', $pid, $year, $semester);
    if (array_key_exists($key, $all)) return $all[$key];
    return array_map(function ($row) {
        $row['id'] = 'class-' . $row['courseId'] . '-' . md5($row['kind']);
        $row['room'] = str_replace('Demo sala', 'Učionica', $row['room']);
        return $row;
    }, array_values(array_filter((array) get_option('matinf_schedule', []), fn($row) => $row['programId'] === $pid && $row['year'] === $year && $row['semester'] === $semester)));
}
function matinf_exam_rows($pid, $year, $graduate = false) {
    $all = get_option('matinf_calendar_overrides', []);
    $key = matinf_calendar_key($graduate ? 'graduate' : 'exams', $pid, $year, 0);
    $rows = array_key_exists($key, $all) ? $all[$key] : matinf_generated_exam_rows($pid, $year, $graduate);
    $result = [];
    foreach ($rows as $row) {
        if (!matinf_is_public($row['courseId'], 'mf_course') || (int) get_post_meta($row['courseId'], '_matinf_programId', true) !== $pid || (int) get_post_meta($row['courseId'], '_matinf_year', true) !== ($graduate ? 4 : $year)) continue;
        $row['id'] = $row['id'] ?? 'exam-' . $row['courseId'] . '-' . md5($row['period']);
        $row['course'] = matinf_summary($row['courseId']);
        $row['staff'] = isset($row['staffId']) ? matinf_summary($row['staffId']) : ($row['staff'] ?? null);
        $row['programId'] = $pid;
        $row['startsAt'] = (new DateTimeImmutable($row['date'] . ' ' . $row['start'], new DateTimeZone('Europe/Sarajevo')))->format(DATE_ATOM);
        $result[] = $row;
    }
    usort($result, fn($a, $b) => [$a['date'], $a['start'], $a['id']] <=> [$b['date'], $b['start'], $b['id']]);
    return $result;
}
function matinf_calendar_save($type, $pid, $year, $semester, $rows, $revision) {
    if (!matinf_can_edit_calendar()) return new WP_Error('forbidden', 'Nemate pravo uređivanja rasporeda.', ['status' => 403]);
    if (!in_array($type, ['classes','exams','graduate'], true) || !matinf_is_public($pid, 'mf_program') || $year < 1 || $year > (int) get_post_meta($pid, '_matinf_durationYears', true) || !in_array($semester, [1,2], true) || ($type === 'graduate' && (int) get_post_meta($pid, '_matinf_durationYears', true) < 4)) return new WP_Error('selection', 'Izaberite važeći program, godinu i vrstu rasporeda.', ['status' => 400]);
    if (!is_array($rows) || count($rows) > 80) return new WP_Error('rows', 'Najviše 80 termina u jednom rasporedu.', ['status' => 400]);
    $valid = []; $ids = [];
    foreach ($rows as $input) {
        if (!is_array($input)) return new WP_Error('row', 'Neispravan termin.', ['status' => 400]);
        $cid = filter_var($input['courseId'] ?? '', FILTER_VALIDATE_INT);
        $expected_year = $type === 'graduate' ? 4 : $year;
        if (!$cid || !matinf_is_public($cid, 'mf_course') || (int) get_post_meta($cid, '_matinf_programId', true) !== $pid || (int) get_post_meta($cid, '_matinf_year', true) !== $expected_year || ($type === 'classes' && (int) get_post_meta($cid, '_matinf_semester', true) !== $semester)) return new WP_Error('course', 'Predmet mora pripadati izabranom programu, godini i semestru nastave.', ['status' => 400]);
        $id = $input['id'] ?? '';
        if (!$id) $id = wp_generate_uuid4();
        if (!is_string($id) || !preg_match('/^[a-zA-Z0-9-]{1,100}$/', $id) || isset($ids[$id])) return new WP_Error('id', 'Ponovljen ili neispravan termin.', ['status' => 400]);
        $ids[$id] = true;
        $start = $input['start'] ?? ''; $end = $input['end'] ?? '';
        if (!is_string($start) || !is_string($end) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $start) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $end) || $start >= $end) return new WP_Error('time', 'Vrijeme završetka mora biti poslije početka, u formatu HH:MM.', ['status' => 400]);
        $room = sanitize_text_field($input['room'] ?? '');
        if (!$room || strlen($room) > 120) return new WP_Error('room', 'Unesite učionicu (najviše 120 znakova).', ['status' => 400]);
        $staff_id = absint($input['staffId'] ?? 0);
        if ($staff_id && !matinf_is_public($staff_id, 'mf_staff')) return new WP_Error('staff', 'Izaberite objavljen profil nastavnika.', ['status' => 400]);
        $row = ['id' => $id, 'courseId' => $cid, 'programId' => $pid, 'year' => $expected_year, 'semester' => $semester, 'start' => $start, 'end' => $end, 'room' => $room, 'staffId' => $staff_id];
        if ($type === 'classes') {
            $row['day'] = (int) ($input['day'] ?? 0); $row['kind'] = $input['kind'] ?? '';
            if ($row['day'] < 1 || $row['day'] > 5 || !in_array($row['kind'], ['Predavanje','Vježbe'], true)) return new WP_Error('day', 'Izaberite radni dan i vrstu nastave.', ['status' => 400]);
        } else {
            $date = $input['date'] ?? '';
            if (!is_string($date) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $parts) || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) return new WP_Error('date', 'Unesite važeći datum ispita.', ['status' => 400]);
            $row['date'] = $date; $row['period'] = sanitize_text_field($input['period'] ?? '');
            if (!$row['period'] || strlen($row['period']) > 120) return new WP_Error('period', 'Unesite naziv ispitnog roka.', ['status' => 400]);
        }
        foreach ($valid as $other) if (($row['date'] ?? $row['day']) === ($other['date'] ?? $other['day']) && $start < $other['end'] && $end > $other['start']) return new WP_Error('overlap', 'Dva termina izabranog rasporeda se preklapaju.', ['status' => 400]);
        $valid[] = $row;
    }
    $key = matinf_calendar_key($type, $pid, $year, $semester);
    $lock = (int) get_option('matinf_calendar_lock');
    if ($lock && $lock < time() - 60) delete_option('matinf_calendar_lock');
    if (!add_option('matinf_calendar_lock', time(), '', false)) return new WP_Error('busy', 'Drugo čuvanje je u toku. Pokušajte ponovo.', ['status' => 409]);
    try {
        if (!hash_equals(matinf_calendar_revision($key), (string) $revision)) return new WP_Error('conflict', 'Raspored je u međuvremenu promijenjen. Osvježite stranicu prije ponovnog uređivanja.', ['status' => 409]);
        $all = get_option('matinf_calendar_overrides', []); $all[$key] = $valid;
        update_option('matinf_calendar_overrides', $all, false);
        return ['revision' => matinf_calendar_revision($key), 'count' => count($valid), 'ids' => array_column($valid, 'id')];
    } finally { delete_option('matinf_calendar_lock'); }
}

function matinf_calendar_form_row($index, $row, $courses, $staff, $type) {
    $prefix = 'rows[' . $index . ']';
    echo '<tr><td><input type="hidden" name="' . esc_attr($prefix . '[id]') . '" value="' . esc_attr($row['id'] ?? '') . '"><select required aria-label="Predmet" name="' . esc_attr($prefix . '[courseId]') . '"><option value="">Izaberite predmet</option>';
    foreach ($courses as $course) echo '<option value="' . $course->ID . '" ' . selected($row['courseId'] ?? '', $course->ID, false) . '>' . esc_html($course->post_title) . '</option>';
    echo '</select><br><select aria-label="Nastavnik" name="' . esc_attr($prefix . '[staffId]') . '"><option value="0">Bez nastavnika</option>';
    foreach ($staff as $person) echo '<option value="' . $person->ID . '" ' . selected($row['staffId'] ?? ($row['staff']['id'] ?? 0), $person->ID, false) . '>' . esc_html($person->post_title) . '</option>';
    echo '</select></td><td>';
    if ($type === 'classes') {
        echo '<select aria-label="Dan" name="' . esc_attr($prefix . '[day]') . '">';
        foreach (['Ponedjeljak','Utorak','Srijeda','Četvrtak','Petak'] as $day => $name) echo '<option value="' . ($day + 1) . '" ' . selected($row['day'] ?? 1, $day + 1, false) . '>' . esc_html($name) . '</option>';
        echo '</select><br><select aria-label="Vrsta nastave" name="' . esc_attr($prefix . '[kind]') . '">';
        foreach (['Predavanje','Vježbe'] as $kind) echo '<option ' . selected($row['kind'] ?? '', $kind, false) . '>' . esc_html($kind) . '</option>';
        echo '</select>';
    } else {
        echo '<input aria-label="Datum" type="date" required name="' . esc_attr($prefix . '[date]') . '" value="' . esc_attr($row['date'] ?? '') . '"><br><input aria-label="Ispitni rok" placeholder="Naziv roka" required name="' . esc_attr($prefix . '[period]') . '" value="' . esc_attr($row['period'] ?? '') . '">';
    }
    echo '</td><td><input aria-label="Početak" type="time" required name="' . esc_attr($prefix . '[start]') . '" value="' . esc_attr($row['start'] ?? '09:00') . '"> – <input aria-label="Završetak" type="time" required name="' . esc_attr($prefix . '[end]') . '" value="' . esc_attr($row['end'] ?? date('H:i', strtotime(($row['start'] ?? '09:00') . ' +2 hours'))) . '"></td><td><input aria-label="Učionica" required name="' . esc_attr($prefix . '[room]') . '" value="' . esc_attr($row['room'] ?? '') . '"></td><td><button type="button" class="button mf-remove-event">Ukloni</button></td></tr>';
}
add_action('admin_menu', function () {
    if (!matinf_can_edit_calendar()) return;
    add_menu_page('MATINF raspored', 'Raspored', 'publish_posts', 'matinf-calendar', function () {
        if (!matinf_can_edit_calendar()) wp_die('Pristup nije dozvoljen.');
        $programs = get_posts(['post_type' => 'mf_program', 'post_status' => 'publish', 'numberposts' => -1, 'orderby' => 'title', 'order' => 'ASC']);
        if (!$programs) { echo '<div class="wrap"><h1>Prvo dodajte studijske programe.</h1></div>'; return; }
        $pid = absint($_GET['program_id'] ?? $programs[0]->ID); $year = absint($_GET['study_year'] ?? 1); $semester = absint($_GET['semester'] ?? 1);
        $type = sanitize_key($_GET['calendar_type'] ?? 'classes'); if (!in_array($type, ['classes','exams','graduate'], true)) $type = 'classes';
        echo '<div class="wrap"><h1>Raspored nastave i ispita</h1><p>Izaberite program i godinu. Dodajte, izmijenite ili uklonite termine, zatim sačuvajte. Aplikacija dobija izmjene pri osvježavanju rasporeda.</p><form method="get"><input type="hidden" name="page" value="matinf-calendar"><select aria-label="Program" name="program_id">';
        foreach (matinf_program_groups() as $group) {
            if (!$group['items']) continue;
            echo '<optgroup label="' . esc_attr($group['label']) . '">';
            foreach ($group['items'] as $program) echo '<option value="' . $program->ID . '" ' . selected($pid, $program->ID, false) . '>' . esc_html($program->post_title) . '</option>';
            echo '</optgroup>';
        }
        echo '</select> <select aria-label="Godina" name="study_year">';
        for ($i=1; $i<=4; $i++) echo '<option value="' . $i . '" ' . selected($year, $i, false) . '>' . $i . '. godina</option>';
        echo '</select> <select aria-label="Semestar" name="semester"><option value="1" ' . selected($semester, 1, false) . '>Zimski</option><option value="2" ' . selected($semester, 2, false) . '>Ljetni</option></select> <select aria-label="Raspored" name="calendar_type">';
        foreach (['classes'=>'Nastava','exams'=>'Ispiti','graduate'=>'Apsolventski rokovi (4. godina)'] as $value=>$label) echo '<option value="' . $value . '" ' . selected($type, $value, false) . '>' . esc_html($label) . '</option>';
        echo '</select> <button class="button">Prikaži</button></form><hr>';
        if ($type === 'graduate') $year = 4;
        if (!matinf_is_public($pid, 'mf_program') || $year < 1 || $year > (int) get_post_meta($pid, '_matinf_durationYears', true)) { echo '<p>Za ovaj program izaberite važeću godinu.</p></div>'; return; }
        $courses_args = ['post_type'=>'mf_course','post_status'=>'publish','has_password'=>false,'numberposts'=>-1,'orderby'=>'title','order'=>'ASC','meta_query'=>[['key'=>'_matinf_programId','value'=>$pid],['key'=>'_matinf_year','value'=>$year]]];
        if ($type === 'classes') $courses_args['meta_query'][] = ['key'=>'_matinf_semester','value'=>$semester];
        $courses = get_posts($courses_args); $staff = get_posts(['post_type'=>'mf_staff','post_status'=>'publish','has_password'=>false,'numberposts'=>-1,'orderby'=>'title','order'=>'ASC']);
        $rows = $type === 'classes' ? matinf_calendar_classes($pid, $year, $semester) : matinf_exam_rows($pid, $year, $type === 'graduate');
        echo '<form id="matinf-calendar-form" method="post" action="' . esc_url(admin_url('admin-ajax.php')) . '"><input type="hidden" name="action" value="matinf_calendar_save">';
        wp_nonce_field('matinf_calendar_save');
        foreach (['program_id'=>$pid,'study_year'=>$year,'semester'=>$semester,'calendar_type'=>$type,'revision'=>matinf_calendar_revision(matinf_calendar_key($type,$pid,$year,$semester))] as $name=>$value) echo '<input type="hidden" name="' . esc_attr($name) . '" value="' . esc_attr($value) . '">';
        echo '<div style="overflow:auto"><table class="widefat striped"><thead><tr><th>Predmet i nastavnik</th><th>Dan / datum i rok</th><th>Vrijeme</th><th>Učionica</th><th></th></tr></thead><tbody id="matinf-calendar-rows">';
        foreach ($rows as $index=>$row) matinf_calendar_form_row($index, $row, $courses, $staff, $type);
        echo '</tbody></table></div><p><button type="button" id="matinf-add-event" class="button">Dodaj termin</button></p><template id="matinf-event-template">'; matinf_calendar_form_row('__INDEX__', [], $courses, $staff, $type); echo '</template>';
        submit_button('Sačuvaj raspored'); echo '<p id="matinf-calendar-status" role="status"></p></form></div>';
    }, 'dashicons-calendar-alt', 26);
});
add_action('admin_enqueue_scripts', function ($hook) { if ($hook === 'toplevel_page_matinf-calendar') wp_enqueue_script('matinf-calendar', plugins_url('../assets/calendar-editor.js', __FILE__), [], MATINF_VERSION, true); });
add_action('wp_ajax_matinf_calendar_save', function () {
    if (!matinf_can_edit_calendar()) wp_send_json_error(['message'=>'Nemate pravo uređivanja.'], 403);
    check_ajax_referer('matinf_calendar_save', '_wpnonce');
    $result = matinf_calendar_save(sanitize_key($_POST['calendar_type'] ?? ''), absint($_POST['program_id'] ?? 0), absint($_POST['study_year'] ?? 0), absint($_POST['semester'] ?? 0), wp_unslash($_POST['rows'] ?? []), sanitize_text_field(wp_unslash($_POST['revision'] ?? '')));
    if (is_wp_error($result)) wp_send_json_error(['message'=>$result->get_error_message()], $result->get_error_data()['status'] ?? 400);
    wp_send_json_success($result);
});
