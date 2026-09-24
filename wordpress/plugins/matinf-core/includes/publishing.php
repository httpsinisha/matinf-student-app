<?php
defined('ABSPATH') || exit;

add_action('init', function () {
    if (get_option('matinf_roles_version') === '1') return;
    add_role('matinf_professor', 'Profesor', [
        'read' => true, 'edit_posts' => true, 'edit_published_posts' => true,
        'publish_posts' => true, 'delete_posts' => true, 'delete_published_posts' => true,
        'upload_files' => true,
    ]);
    $admin = get_role('administrator');
    if ($admin) foreach (['edit_matinf_academics', 'edit_others_matinf_academics', 'publish_matinf_academics', 'read_private_matinf_academics', 'delete_matinf_academics', 'delete_private_matinf_academics', 'delete_published_matinf_academics', 'delete_others_matinf_academics', 'edit_private_matinf_academics', 'edit_published_matinf_academics'] as $cap) $admin->add_cap($cap);
    update_option('matinf_roles_version', '1');
});

function matinf_validate_years($values) {
    if (!is_array($values) || count($values) > 50) return new WP_Error('matinf_years', 'Izaberite najviše 50 godina studija.', ['status' => 400]);
    $result = [];
    foreach ($values as $value) {
        if (!is_string($value) || !preg_match('/^([1-9][0-9]*):([1-4])$/', $value, $parts) || !matinf_is_public((int) $parts[1], 'mf_program') || (int) $parts[2] > (int) get_post_meta((int) $parts[1], '_matinf_durationYears', true)) return new WP_Error('matinf_year', 'Godina mora pripadati objavljenom studijskom programu.', ['status' => 400]);
        $result[] = $value;
    }
    return array_values(array_unique($result));
}

function matinf_validate_audience($input) {
    $years = matinf_validate_years($input['audienceYears'] ?? []);
    if (is_wp_error($years)) return $years;
    $courses = matinf_valid_ids($input['audienceCourseIds'] ?? [], 'mf_course');
    if (is_wp_error($courses)) return $courses;
    $everyone = !empty($input['everyone']);
    // Existing/general posts have no academic targets and remain general.
    if (!$years && !$courses) $everyone = true;
    return ['everyone' => $everyone, 'audienceYears' => $years, 'audienceCourseIds' => $courses];
}

function matinf_post_audience($id) {
    $years = get_post_meta($id, '_matinf_audienceYears', true);
    $courses = get_post_meta($id, '_matinf_audienceCourseIds', true);
    return [
        'everyone' => !metadata_exists('post', $id, '_matinf_everyone') || (bool) get_post_meta($id, '_matinf_everyone', true),
        'programYears' => is_array($years) ? array_values($years) : [],
        'courseIds' => is_array($courses) ? array_map('intval', $courses) : [],
    ];
}

add_action('updated_post_meta', 'matinf_index_audience', 10, 4);
add_action('added_post_meta', 'matinf_index_audience', 10, 4);
function matinf_index_audience($meta_id, $id, $key, $value) {
    if (!in_array($key, ['_matinf_everyone', '_matinf_audienceYears', '_matinf_audienceCourseIds'], true)) return;
    $audience = matinf_post_audience($id);
    delete_post_meta($id, '_matinf_target');
    if ($audience['everyone']) add_post_meta($id, '_matinf_target', 'everyone');
    foreach ($audience['programYears'] as $year) add_post_meta($id, '_matinf_target', 'year:' . $year);
    foreach ($audience['courseIds'] as $course) add_post_meta($id, '_matinf_target', 'course:' . $course);
}

function matinf_feed_query($request) {
    $raw_years = (string) ($request['program_years'] ?? '');
    $raw_courses = (string) ($request['course_ids'] ?? '');
    if (strlen($raw_years) > 1500 || strlen($raw_courses) > 1500) return new WP_Error('matinf_targets', 'Previše izbora.', ['status' => 400]);
    $years = matinf_validate_years($raw_years === '' ? [] : explode(',', $raw_years));
    if (is_wp_error($years)) return $years;
    $courses = matinf_valid_ids($raw_courses === '' ? [] : explode(',', $raw_courses), 'mf_course');
    if (is_wp_error($courses)) return $courses;
    $keys = ['everyone'];
    foreach ($courses as $id) {
        $keys[] = 'course:' . $id;
        $keys[] = 'year:' . get_post_meta($id, '_matinf_programId', true) . ':' . get_post_meta($id, '_matinf_year', true);
    }
    foreach ($years as $year) {
        $keys[] = 'year:' . $year;
        [$program, $number] = explode(':', $year);
        // Only IDs are loaded; the public response remains normally paginated.
        $included = get_posts(['post_type' => 'mf_course', 'post_status' => 'publish', 'has_password' => false, 'numberposts' => -1, 'fields' => 'ids', 'meta_query' => [['key' => '_matinf_programId', 'value' => (int) $program, 'type' => 'NUMERIC'], ['key' => '_matinf_year', 'value' => (int) $number, 'type' => 'NUMERIC']]]);
        foreach ($included as $id) $keys[] = 'course:' . $id;
    }
    return ['relation' => 'OR', ['key' => '_matinf_target', 'value' => array_values(array_unique($keys)), 'compare' => 'IN'], ['key' => '_matinf_everyone', 'compare' => 'NOT EXISTS']];
}

function matinf_audience_box($post) {
    $audience = matinf_post_audience($post->ID);
    echo '<h3>Publika u Android aplikaciji</h3><p><label><input type="checkbox" name="matinf[everyone]" value="1" ' . checked($audience['everyone'], true, false) . '> Opšta objava za sve</label></p>';
    echo '<p><label for="mf-audienceYears"><strong>Program i godina studija</strong></label><br><select class="widefat" id="mf-audienceYears" name="matinf[audienceYears][]" multiple size="6">';
    foreach (get_posts(['post_type' => 'mf_program', 'post_status' => 'publish', 'has_password' => false, 'numberposts' => -1]) as $program) {
        for ($year = 1; $year <= (int) get_post_meta($program->ID, '_matinf_durationYears', true); $year++) {
            $value = $program->ID . ':' . $year;
            echo '<option value="' . esc_attr($value) . '" ' . selected(in_array($value, $audience['programYears'], true), true, false) . '>' . esc_html($program->post_title . ' · ' . $year . '. godina') . '</option>';
        }
    }
    echo '</select></p>';
    matinf_relation_select($post, 'audienceCourseIds', 'Pojedinačni predmeti', 'mf_course');
    echo '<p>Za ciljanu objavu isključite „Opšta objava za sve“. Pratilac godine vidi i objave njenih predmeta. Bez izabrane publike objava je opšta. Objavljeni sadržaj je javan; izbor određuje lični feed, ne pravo pristupa.</p>';
    if (get_post_meta($post->ID, '_matinf_push_seen', true) || $post->post_status === 'publish') {
        echo '<p>Push se šalje samo pri prvom objavljivanju. Izmjene ne šalju ponovo.</p>';
    } else {
        $send = metadata_exists('post', $post->ID, '_matinf_send_push') ? (bool) get_post_meta($post->ID, '_matinf_send_push', true) : true;
        echo '<p><label><input type="checkbox" name="matinf[sendPush]" value="1" ' . checked($send, true, false) . '> Pošalji push obavještenje izabranoj publici pri prvom objavljivanju</label></p>';
    }
}

// The account determines the role; selecting a label never grants privileges.
add_action('template_redirect', function () {
    global $wp;
    if ($wp->request !== 'prijava') return;
    status_header(200);
    nocache_headers();
    get_header();
    echo '<section class="page-heading"><p class="eyebrow">UREĐIVANJE SADRŽAJA</p><h1>Prijava za nastavnike</h1><p>Profesor objavljuje i uređuje svoje novosti i obavještenja. Administrator upravlja svim sadržajima, studijskim programima i korisničkim nalozima.</p></section><div class="card">';
    if (is_user_logged_in()) echo '<p>Prijavljeni ste kao ' . esc_html(wp_get_current_user()->display_name) . '.</p><a class="button" href="' . esc_url(admin_url()) . '">Otvori urednički panel</a> <a href="' . esc_url(wp_logout_url(home_url('/prijava/'))) . '">Odjava</a>';
    else {
        wp_login_form(['redirect' => admin_url(), 'label_username' => 'Korisničko ime ili email', 'label_password' => 'Lozinka', 'label_remember' => 'Zapamti me', 'label_log_in' => 'Prijavi se']);
        echo '<p><a href="' . esc_url(wp_lostpassword_url()) . '">Zaboravljena lozinka?</a></p><p>Profesorske naloge dodaje administrator. Studenti čitaju javne sadržaje bez prijave.</p>';
    }
    echo '</div>';
    get_footer();
    exit;
});
