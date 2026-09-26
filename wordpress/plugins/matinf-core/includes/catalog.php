<?php
defined('ABSPATH') || exit;
class Matinf_Catalog_Batch_Complete extends RuntimeException {}

function matinf_catalog_data() {
    return json_decode(file_get_contents(__DIR__ . '/../data/catalog.json'), true, 512, JSON_THROW_ON_ERROR);
}

function matinf_catalog_upsert($key, $type, $title, $body, $fields, $existing_id = 0) {
    $found = get_posts(['post_type' => $type, 'post_status' => ['publish', 'draft'], 'numberposts' => 1, 'meta_key' => '_matinf_sourceKey', 'meta_value' => $key]);
    if ($found) return $found[0]->ID; // Resume a partial import without overwriting completed records.
    if (isset($GLOBALS['matinf_catalog_budget'])) {
        if ($GLOBALS['matinf_catalog_budget'] <= 0) throw new Matinf_Catalog_Batch_Complete();
        $GLOBALS['matinf_catalog_budget']--;
    }
    $id = $found ? $found[0]->ID : $existing_id;
    $data = ['post_type' => $type, 'post_status' => 'publish', 'post_title' => $title, 'post_content' => $body];
    if ($id) $data['ID'] = $id;
    $id = wp_insert_post($data, true);
    if (is_wp_error($id)) throw new RuntimeException($id->get_error_message());
    $valid = matinf_validate_fields($type, $fields);
    if (is_wp_error($valid)) throw new RuntimeException($valid->get_error_message());
    matinf_store_fields($id, $valid);
    update_post_meta($id, '_matinf_sourceKey', $key);
    return $id;
}

function matinf_import_catalog($archive = true, $batch_limit = 0) {
    $lock = (int) get_option('matinf_catalog_lock');
    if ($lock && $lock < time() - 1800) delete_option('matinf_catalog_lock');
    if (!add_option('matinf_catalog_lock', time(), '', false)) throw new RuntimeException('Uvoz je već pokrenut. Sačekajte završetak.');
    if ($batch_limit) $GLOBALS['matinf_catalog_budget'] = $batch_limit;
    try { return matinf_import_catalog_records($archive); }
    catch (Matinf_Catalog_Batch_Complete $error) { return ['pending' => true]; }
    finally { unset($GLOBALS['matinf_catalog_budget']); delete_option('matinf_catalog_lock'); }
}

function matinf_import_catalog_records($archive = true) {
    $catalog = matinf_catalog_data();
    if (get_option('matinf_catalog_version') === $catalog['version']) return get_option('matinf_catalog_result');
    $existing = get_posts(['post_type' => ['mf_program', 'mf_course', 'mf_staff'], 'post_status' => ['publish', 'draft'], 'numberposts' => -1]);
    // A restorable snapshot of academic content only, before the first import.
    if (!get_option('matinf_catalog_backup')) {
        $backup = [];
        foreach ($existing as $post) $backup[] = ['post' => (array) $post, 'meta' => get_post_meta($post->ID)];
        update_option('matinf_catalog_backup', $backup, false);
    }
    $names = json_decode(file_get_contents(__DIR__ . '/../data/staff.json'), true);
    $staff = [];
    foreach ($names as $index => $name) {
        $role = $index < 4 ? 'Redovni profesor' : ($index < 6 ? 'Vanredni profesor' : ($index < 12 ? 'Docent' : ($index < 15 ? 'Gostujući nastavnik' : ($index < 20 ? 'Nastavnik sa drugog studijskog programa / fakulteta' : ($index < 28 ? 'Saradnik u nastavi' : ($index < 31 ? 'Stručni saradnik' : 'Profesor u penziji'))))));
        $staff[] = matinf_catalog_upsert('staff-' . $index, 'mf_staff', $name, '<p>Demonstracijski profil sa izmišljenim imenom i prezimenom. Organizacija osoblja prati javni pregled fakulteta. Raspodjela nastave u demonstracijskom rasporedu je izmišljena.</p><p><a href="https://matinf.pmf.unibl.org/">Izvor strukture osoblja: MATINF PMF Banja Luka</a></p>', ['academicTitle' => $role, 'email' => '']);
    }
    $used = $staff; $schedule = []; $program_ids = []; $course_count = 0;
    foreach ($catalog['programs'] as $program_index => $program) {
        $match = 0;
        foreach ($existing as $post) if ($post->post_type === 'mf_program' && $post->post_title === $program['name']) { $match = $post->ID; break; }
        $body = '<p>Trajanje: ' . $program['years'] . ' godine. Ukupno ' . $program['ects'] . ' ECTS bodova.</p><p>Nastavni plan preuzet iz javnog kataloga fakulteta, provjeren 25.09.2026. Predmeti su raspoređeni prema godini i semestru; izborni predmeti prikazuju sve ponuđene opcije.</p><p><a href="' . esc_url($program['sourceUrl']) . '">Zvanični nastavni plan i informacije o studiju</a></p>';
        if ($program['level'] === 'doctoral') $body .= '<p>Doktorski studij je fleksibilan: izborni predmeti i seminari, istraživački rad i disertacija. Smještaj predmeta u prvu godinu je orijentacioni prijedlog zvanične stranice; individualni plan se dogovara s mentorom.</p>';
        $pid = matinf_catalog_upsert('program-' . $program['key'], 'mf_program', $program['name'], $body, ['level' => $program['level'], 'ects' => $program['ects']], $match);
        update_post_meta($pid, '_matinf_sourceUrl', $program['sourceUrl']);
        $program_ids[] = $pid; $used[] = $pid;
        $clocks = [];
        foreach ($program['courses'] as $course_index => $course) {
            $match = 0;
            foreach ($existing as $post) if ($post->post_type === 'mf_course' && $post->post_title === $course['name'] && (int) get_post_meta($post->ID, '_matinf_programId', true) === $pid && (int) get_post_meta($post->ID, '_matinf_year', true) === $course['year'] && (int) get_post_meta($post->ID, '_matinf_semester', true) === $course['semester']) { $match = $post->ID; break; }
            $cohort = $program_index * 4 + $course['year'] - 1;
            // Distinct teaching pairs for each undergraduate cohort avoid clashes
            // between simultaneous schedules. This assignment is explicitly fictional.
            $teacher = $staff[($cohort * 2) % 28]; $assistant = $staff[($cohort * 2 + 1) % 28];
            $body = '<p>' . (int) $course['year'] . '. godina · ' . (int) $course['semester'] . '. semestar u godini · ' . (int) $course['ects'] . ' ECTS.</p>';
            if ($course['lectures'] !== null) $body .= '<p>Sedmični fond časova: ' . (int) $course['lectures'] . ' predavanja + ' . (int) $course['exercises'] . ' vježbi.</p>';
            $body .= '<p>' . ($course['electiveGroup'] ? 'Izborni predmet: ' . esc_html($course['electiveGroup']) . '. Biraju se opcije prema pravilima zvaničnog plana.' : 'Obavezna stavka nastavnog plana.') . '</p><p><a href="' . esc_url($program['sourceUrl']) . '">Izvor podataka: zvanični nastavni plan</a></p>';
            if ($course['syllabusUrl']) $body .= '<p><a href="' . esc_url($course['syllabusUrl']) . '">Otvori zvanični silabus predmeta</a></p>';
            $body .= '<p>Imena osoblja i termini rasporeda u ovoj aplikaciji su demonstracijski.</p>';
            $cid = matinf_catalog_upsert('course-' . $program['key'] . '-' . $course['year'] . '-' . $course['semester'] . '-' . md5($course['name']), 'mf_course', $course['name'], $body, ['programId' => $pid, 'year' => $course['year'], 'semester' => $course['semester'], 'staffIds' => [$teacher, $assistant]], $match);
            foreach (['ects','lectures','exercises','electiveGroup','syllabusUrl'] as $field) update_post_meta($cid, '_matinf_' . $field, $course[$field]);
            update_post_meta($cid, '_matinf_sourceUrl', $program['sourceUrl']);
            $used[] = $cid; $course_count++;
            if ($program['level'] !== 'undergraduate' || !$course['demoSelected'] || preg_match('/rad$|praksa$/iu', $course['name'])) continue;
            $group = $course['year'] . ':' . $course['semester'];
            if (!isset($clocks[$group])) $clocks[$group] = ['day' => 1, 'minute' => 8 * 60];
            foreach (['lectures' => 'Predavanje', 'exercises' => 'Vježbe'] as $field => $kind) {
                $hours = (int) $course[$field]; if (!$hours) continue;
                $duration = $hours * 45;
                if ($clocks[$group]['minute'] + $duration > 17 * 60) { $clocks[$group]['day']++; $clocks[$group]['minute'] = 8 * 60; }
                $start = $clocks[$group]['minute']; $end = $start + $duration;
                if ($clocks[$group]['day'] > 5) throw new RuntimeException('Raspored prelazi pet radnih dana.');
                $schedule[] = ['courseId' => $cid, 'programId' => $pid, 'year' => $course['year'], 'semester' => $course['semester'], 'day' => $clocks[$group]['day'], 'start' => sprintf('%02d:%02d', intdiv($start, 60), $start % 60), 'end' => sprintf('%02d:%02d', intdiv($end, 60), $end % 60), 'kind' => $kind, 'room' => 'Demo sala ' . (101 + $cohort), 'staffId' => $field === 'lectures' ? $teacher : $assistant];
                $clocks[$group]['minute'] = $end + 15;
            }
        }
    }
    $archived = 0;
    foreach ($existing as $post) {
        if (in_array($post->ID, $used, true) || !in_array($post->post_type, ['mf_course', 'mf_staff'], true)) continue;
        if (!str_contains($post->post_content, 'Nezvanični demo sadržaj.')) continue;
        update_post_meta($post->ID, '_matinf_legacy', true);
        if ($archive) { wp_update_post(['ID' => $post->ID, 'post_status' => 'draft']); $archived++; }
    }
    update_option('matinf_schedule', $schedule, false);
    $schedule_page = get_page_by_path('raspored');
    if (!$schedule_page) wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_name' => 'raspored', 'post_title' => 'Raspored nastave', 'post_content' => '[matinf_schedule]']);
    $result = ['programs' => count($program_ids), 'courses' => $course_count, 'staff' => count($staff), 'events' => count($schedule), 'archived' => $archived];
    update_option('matinf_catalog_result', $result, false);
    update_option('matinf_catalog_version', $catalog['version']);
    return $result;
}

add_action('admin_menu', function () {
    add_management_page('MATINF katalog', 'MATINF katalog', 'manage_options', 'matinf-catalog', function () {
        $data = matinf_catalog_data();
        echo '<div class="wrap"><h1>Zvanični katalog i demonstracijski raspored</h1><p>Izvor: matinf.pmf.unibl.org, provjeren 25.09.2026. Uvoz: 6 programa, 174 predmeta i izbornih opcija, 35 profila sa izmišljenim imenima. Fokus rasporeda: osnovne studije.</p><p>Programi zadržavaju postojeće ID-ove ako se naziv poklapa. Postojeće objave se ne mijenjaju. Jednaki predmeti se povezuju prema programu, nazivu, godini i semestru. Arhivirani ogledni predmeti više nisu ponuđeni za praćenje; godine ostaju sačuvane, pojedinačne predmete treba ponovo provjeriti.</p><p>Raspored i raspodjela nastavnika su izmišljeni. Izborni termini koriste demonstracijski izbor opcija, ne sve alternative istovremeno. Praksa i završni rad nemaju sedmični termin.</p>';
        if (get_option('matinf_catalog_version')) echo '<div class="notice notice-success inline"><p>Uvoz završen: ' . esc_html(wp_json_encode(get_option('matinf_catalog_result'))) . '</p></div>';
        else {
            echo '<form id="matinf-catalog-import" method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="matinf_import_catalog">';
            wp_nonce_field('matinf_import_catalog');
            echo '<p><label><input type="checkbox" name="archive" value="1" checked> Arhiviraj stare ogledne predmete i profile koji nisu dio novog kataloga</label></p>';
            submit_button('Uvezi katalog i napravi demo raspored'); echo '<p id="matinf-import-status" role="status"></p></form>';
        }
        echo '<p>Prije uvoza pravi se interna kopija akademskih zapisa. Za potpunu rezervnu kopiju koristite izvoz / backup sajta.</p>';
        if (get_option('matinf_catalog_backup')) echo '<p><a class="button" href="' . esc_url(wp_nonce_url(admin_url('admin-post.php?action=matinf_catalog_backup'), 'matinf_catalog_backup')) . '">Preuzmi kopiju akademskih zapisa (JSON)</a></p>';
        foreach ($data['programs'] as $program) echo '<p><a href="' . esc_url($program['sourceUrl']) . '">' . esc_html($program['name']) . ' — zvanični izvor</a></p>';
        echo '</div>';
    });
});
add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook === 'tools_page_matinf-catalog') wp_enqueue_script('matinf-catalog-import', plugins_url('../assets/catalog-import.js', __FILE__), [], MATINF_VERSION, true);
});
add_action('wp_ajax_matinf_import_catalog_step', function () {
    if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Pristup nije dozvoljen.'], 403);
    check_ajax_referer('matinf_import_catalog', '_wpnonce');
    try { wp_send_json_success(matinf_import_catalog(!empty($_POST['archive']), 12)); }
    catch (Throwable $error) { wp_send_json_error(['message' => 'Uvoz nije završen. Sačekajte i pokušajte ponovo; završeni zapisi su sačuvani.'], 500); }
});
add_action('admin_post_matinf_catalog_backup', function () {
    if (!current_user_can('manage_options')) wp_die('Pristup nije dozvoljen.', '', ['response' => 403]);
    check_admin_referer('matinf_catalog_backup');
    nocache_headers(); header('Content-Type: application/json; charset=utf-8'); header('Content-Disposition: attachment; filename="matinf-academic-backup.json"');
    echo wp_json_encode(get_option('matinf_catalog_backup', []), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE); exit;
});
add_action('admin_post_matinf_import_catalog', function () {
    if (!current_user_can('manage_options')) wp_die('Pristup nije dozvoljen.', '', ['response' => 403]);
    check_admin_referer('matinf_import_catalog');
    matinf_import_catalog(!empty($_POST['archive']));
    wp_safe_redirect(admin_url('tools.php?page=matinf-catalog')); exit;
});
