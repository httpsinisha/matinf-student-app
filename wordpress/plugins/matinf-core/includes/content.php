<?php
defined('ABSPATH') || exit;

function matinf_collections() {
    return ['programs' => 'mf_program', 'courses' => 'mf_course', 'staff' => 'mf_staff', 'documents' => 'mf_document', 'pages' => 'page', 'news' => 'post', 'announcements' => 'post'];
}

function matinf_register_content() {
    $types = [
        'mf_program' => ['Studijski programi', 'Studijski program', 'studije', 'dashicons-welcome-learn-more'],
        'mf_course' => ['Predmeti', 'Predmet', 'predmeti', 'dashicons-book'],
        'mf_staff' => ['Nastavno osoblje', 'Profil nastavnika', 'osoblje', 'dashicons-groups'],
        'mf_document' => ['Dokumenti', 'Dokument', 'dokumenti', 'dashicons-media-document'],
    ];
    foreach ($types as $type => [$plural, $singular, $slug, $icon]) {
        register_post_type($type, [
            'labels' => ['name' => $plural, 'singular_name' => $singular, 'add_new_item' => 'Dodaj: ' . $singular, 'edit_item' => 'Uredi: ' . $singular],
            'public' => true, 'show_in_rest' => true, 'has_archive' => true,
            'capability_type' => ['matinf_academic', 'matinf_academics'], 'map_meta_cap' => true,
            'rewrite' => ['slug' => $slug], 'menu_icon' => $icon,
            'supports' => ['title', 'editor', 'excerpt', 'thumbnail', 'revisions'],
        ]);
    }
}
add_action('init', 'matinf_register_content');

function matinf_is_public($id, $type = null) {
    $post = get_post((int) $id);
    return $post && $post->post_status === 'publish' && $post->post_password === '' && (!$type || $post->post_type === $type);
}

function matinf_valid_ids($ids, $type) {
    if (!is_array($ids) || count($ids) > 50) return new WP_Error('matinf_relations', 'Najviše 50 povezanih stavki.', ['status' => 400]);
    $result = [];
    foreach ($ids as $id) {
        if (filter_var($id, FILTER_VALIDATE_INT) === false || (int) $id <= 0 || !matinf_is_public((int) $id, $type)) return new WP_Error('matinf_relation', 'Povezana stavka mora biti javno objavljena i odgovarajućeg tipa.', ['status' => 400]);
        $result[] = (int) $id;
    }
    return array_values(array_unique($result));
}

function matinf_validate_fields($type, $input) {
    if (!is_array($input)) return new WP_Error('matinf_fields', 'Neispravni podaci.', ['status' => 400]);
    $output = [];
    if ($type === 'mf_program') {
        $durations = ['undergraduate' => 4, 'master' => 1, 'doctoral' => 3];
        $level = sanitize_key($input['level'] ?? '');
        if (!isset($durations[$level])) return new WP_Error('matinf_level', 'Izaberite nivo studija.', ['status' => 400]);
        $ects = filter_var($input['ects'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 300]]);
        if ($ects === false) return new WP_Error('matinf_ects', 'ECTS mora biti između 0 i 300.', ['status' => 400]);
        $output = ['level' => $level, 'durationYears' => $durations[$level], 'ects' => $ects];
    }
    if ($type === 'mf_course') {
        $program = filter_var($input['programId'] ?? null, FILTER_VALIDATE_INT);
        $year = filter_var($input['year'] ?? null, FILTER_VALIDATE_INT);
        $semester = filter_var($input['semester'] ?? null, FILTER_VALIDATE_INT);
        $duration = (int) get_post_meta((int) $program, '_matinf_durationYears', true);
        if (!$program || !matinf_is_public($program, 'mf_program') || !$year || $year > $duration || $year < 1 || !in_array($semester, [1, 2], true)) {
            return new WP_Error('matinf_course', 'Izaberite objavljen program, važeću godinu i semestar 1 ili 2.', ['status' => 400]);
        }
        $staff = matinf_valid_ids($input['staffIds'] ?? [], 'mf_staff');
        if (is_wp_error($staff)) return $staff;
        $output = ['programId' => $program, 'year' => $year, 'semester' => $semester, 'staffIds' => $staff];
    }
    if ($type === 'mf_staff') {
        $email = trim((string) ($input['email'] ?? ''));
        if ($email !== '' && !is_email($email)) return new WP_Error('matinf_email', 'Unesite važeću javnu email adresu.', ['status' => 400]);
        $output = ['academicTitle' => sanitize_text_field($input['academicTitle'] ?? ''), 'email' => sanitize_email($email)];
    }
    if ($type === 'mf_document') {
        $url = esc_url_raw($input['fileUrl'] ?? '', ['https', 'http']);
        // Local development uploads may use HTTP; external documents must use HTTPS.
        $local_uploads = wp_get_upload_dir()['baseurl'] . '/';
        if (!$url || (!str_starts_with($url, 'https://') && !str_starts_with($url, $local_uploads))) return new WP_Error('matinf_url', 'Izaberite dokument iz Medija ili unesite HTTPS URL.', ['status' => 400]);
        $output = ['fileUrl' => $url, 'mimeType' => sanitize_mime_type($input['mimeType'] ?? 'application/pdf')];
    }
    if ($type === 'post') {
        $ids = $input['attachmentIds'] ?? [];
        if (!is_array($ids) || count($ids) > 20) return new WP_Error('matinf_files', 'Najviše 20 dokumenata uz objavu.', ['status' => 400]);
        $output['attachmentIds'] = [];
        foreach ($ids as $id) {
            if (filter_var($id, FILTER_VALIDATE_INT) === false || (int) $id <= 0) return new WP_Error('matinf_file', 'Neispravan identifikator datoteke.', ['status' => 400]);
            $attachment = get_post((int) $id);
            if (!$attachment || $attachment->post_type !== 'attachment' || $attachment->post_status === 'trash' || !current_user_can('edit_post', $attachment->ID) || !wp_get_attachment_url($attachment->ID)) return new WP_Error('matinf_file', 'Odaberite svoju učitanu datoteku iz Medija.', ['status' => 400]);
            $output['attachmentIds'][] = $attachment->ID;
        }
        $output['attachmentIds'] = array_values(array_unique($output['attachmentIds']));
        $output['important'] = !empty($input['important']);
        $audience = matinf_validate_audience($input);
        if (is_wp_error($audience)) return $audience;
        $output = array_merge($output, $audience);
    }
    if (in_array($type, ['mf_program', 'mf_course', 'post'], true)) {
        $documents = matinf_valid_ids($input['documentIds'] ?? [], 'mf_document');
        if (is_wp_error($documents)) return $documents;
        $output['documentIds'] = $documents;
    }
    return $output;
}

function matinf_store_fields($id, $fields) {
    foreach ($fields as $key => $value) update_post_meta($id, '_matinf_' . $key, $value);
    if (isset($fields['staffIds'])) {
        delete_post_meta($id, '_matinf_staffId');
        foreach ($fields['staffIds'] as $staff_id) add_post_meta($id, '_matinf_staffId', (int) $staff_id);
    }
}

function matinf_body_html($post) {
    $allowed = [
        'p' => [], 'br' => [], 'strong' => [], 'b' => [], 'em' => [], 'i' => [],
        'ul' => [], 'ol' => ['start' => true], 'li' => [], 'h2' => [], 'h3' => [], 'h4' => [], 'blockquote' => [],
        'a' => ['href' => true, 'title' => true], 'img' => ['src' => true, 'alt' => true, 'width' => true, 'height' => true],
    ];
    return wp_kses(apply_filters('the_content', $post->post_content), $allowed, ['http', 'https', 'mailto', 'tel']);
}

function matinf_excerpt($post, $words = 32) {
    if ($post->post_excerpt !== '') return html_entity_decode(wp_strip_all_tags($post->post_excerpt), ENT_QUOTES, 'UTF-8');
    $body = preg_replace('/<p><strong>Nezvanični demo sadržaj\.<\/strong>.*?<\/p>/us', '', $post->post_content);
    $body = preg_replace('/<\/(p|li|h[1-6])>/i', ' ', $body);
    return html_entity_decode(wp_trim_words(wp_strip_all_tags($body), $words), ENT_QUOTES, 'UTF-8');
}
