<?php
defined('ABSPATH') || exit;

// Classic metadata forms keep related fields in one validated save operation.
add_filter('use_block_editor_for_post_type', function ($enabled, $type) {
    return in_array($type, ['mf_program', 'mf_course', 'mf_staff', 'mf_document', 'post'], true) ? false : $enabled;
}, 10, 2);

add_action('add_meta_boxes', function () {
    foreach (['mf_program', 'mf_course', 'mf_staff', 'mf_document', 'post'] as $type) add_meta_box('matinf-details', 'MATINF podaci', 'matinf_meta_box', $type, 'normal', 'high');
});

function matinf_input($post, $key, $label, $type = 'text') {
    $value = get_post_meta($post->ID, '_matinf_' . $key, true);
    echo '<p><label for="mf-' . esc_attr($key) . '"><strong>' . esc_html($label) . '</strong></label><br>';
    echo '<input class="widefat" id="mf-' . esc_attr($key) . '" type="' . esc_attr($type) . '" name="matinf[' . esc_attr($key) . ']" value="' . esc_attr($value) . '"></p>';
}

function matinf_relation_select($post, $key, $label, $type, $multiple = true) {
    $current = get_post_meta($post->ID, '_matinf_' . $key, true);
    $current = $multiple ? (is_array($current) ? $current : []) : [(int) $current];
    $items = get_posts(['post_type' => $type, 'post_status' => 'publish', 'has_password' => false, 'numberposts' => 200, 'orderby' => 'title', 'order' => 'ASC']);
    echo '<p><label for="mf-' . esc_attr($key) . '"><strong>' . esc_html($label) . '</strong></label><br>';
    echo '<select class="widefat" id="mf-' . esc_attr($key) . '" name="matinf[' . esc_attr($key) . ']' . ($multiple ? '[]' : '') . '" ' . ($multiple ? 'multiple size="5"' : '') . '>';
    if (!$multiple) echo '<option value="">— Izaberite —</option>';
    foreach ($items as $item) {
        $title = $item->post_title;
        if ($type === 'mf_course') $title .= ' — ' . get_the_title((int) get_post_meta($item->ID, '_matinf_programId', true)) . ' · ' . get_post_meta($item->ID, '_matinf_year', true) . '. godina';
        echo '<option value="' . esc_attr($item->ID) . '" ' . selected(in_array($item->ID, $current, true), true, false) . '>' . esc_html($title) . '</option>';
    }
    echo '</select>' . ($multiple ? '<small>Ctrl/Cmd + klik za izbor više stavki. Prikazuju se javno objavljene stavke.</small>' : '') . '</p>';
}

function matinf_meta_box($post) {
    wp_nonce_field('matinf_save_fields', 'matinf_nonce');
    if ($post->post_type === 'mf_program') {
        $level = get_post_meta($post->ID, '_matinf_level', true);
        echo '<p><label for="mf-level"><strong>Nivo studija</strong></label><br><select id="mf-level" name="matinf[level]">';
        foreach (['undergraduate' => 'Osnovne studije — 4 godine', 'master' => 'Master studije — 1 godina', 'doctoral' => 'Doktorske studije — 3 godine'] as $key => $label) echo '<option value="' . esc_attr($key) . '" ' . selected($level, $key, false) . '>' . esc_html($label) . '</option>';
        echo '</select></p>';
        matinf_input($post, 'ects', 'ECTS bodovi (0 ako nije navedeno)', 'number');
    }
    if ($post->post_type === 'mf_course') {
        matinf_relation_select($post, 'programId', 'Studijski program', 'mf_program', false);
        matinf_input($post, 'year', 'Godina u okviru programa', 'number');
        matinf_input($post, 'semester', 'Semestar u okviru godine (1 ili 2)', 'number');
        matinf_relation_select($post, 'staffIds', 'Nastavno osoblje', 'mf_staff');
    }
    if ($post->post_type === 'mf_staff') {
        matinf_input($post, 'academicTitle', 'Akademsko zvanje');
        matinf_input($post, 'email', 'Javna poslovna email adresa', 'email');
    }
    if ($post->post_type === 'mf_document') {
        matinf_input($post, 'fileUrl', 'URL dokumenta iz Medija ili HTTPS link', 'url');
        matinf_input($post, 'mimeType', 'MIME tip (npr. application/pdf)');
        echo '<p>Otpremite datoteku u <a href="' . esc_url(admin_url('media-new.php')) . '">Medije</a>, pa kopirajte URL ovdje.</p>';
    }
    if ($post->post_type === 'post') {
        matinf_audience_box($post);
        echo '<p><label><input type="checkbox" name="matinf[important]" value="1" ' . checked((bool) get_post_meta($post->ID, '_matinf_important', true), true, false) . '> Važno obavještenje</label></p>';
        echo '<p>Izaberite kategoriju <strong>Novosti</strong> ili <strong>Obavještenja</strong> da objava bude dostupna aplikaciji.</p>';
    }
    if (in_array($post->post_type, ['mf_program', 'mf_course', 'post'], true)) matinf_relation_select($post, 'documentIds', 'Povezani dokumenti', 'mf_document');
}

add_action('save_post', function ($id, $post) {
    if (wp_is_post_revision($id) || wp_is_post_autosave($id) || !isset($_POST['matinf_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['matinf_nonce'])), 'matinf_save_fields') || !current_user_can('edit_post', $id)) return;
    $data = isset($_POST['matinf']) && is_array($_POST['matinf']) ? wp_unslash($_POST['matinf']) : [];
    $fields = matinf_validate_fields($post->post_type, $data);
    if (is_wp_error($fields)) {
        set_transient('matinf_error_' . get_current_user_id(), $fields->get_error_message(), 60);
        // Never publish an academically invalid record. Keep existing metadata
        // intact and save the content as a draft so the editor can correct it.
        if ($post->post_status === 'publish') wp_update_post(['ID' => $id, 'post_status' => 'draft'], false, false);
        return;
    }
    matinf_store_fields($id, $fields);
}, 10, 2);

add_action('admin_notices', function () {
    $key = 'matinf_error_' . get_current_user_id();
    $message = get_transient($key);
    if ($message) { delete_transient($key); echo '<div class="notice notice-error"><p>' . esc_html($message . ' Sadržaj nije objavljen. Ispravite podatke i sačuvajte ponovo.') . '</p></div>'; }
});

add_action('admin_menu', function () {
    add_management_page('MATINF demo', 'MATINF demo', 'manage_options', 'matinf-demo', function () {
        if (!current_user_can('manage_options')) return;
        echo '<div class="wrap"><h1>MATINF demo sadržaj</h1><p>Dodaje primjere svih šest programa, predmeta, osoblja, dokumenata i objava. Postojeći sadržaj se ne mijenja.</p>';
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="matinf_seed_demo">';
        wp_nonce_field('matinf_seed_demo');
        submit_button('Dodaj demo sadržaj');
        echo '</form><p>Javni API: <a href="' . esc_url(rest_url('matinf/v1/health')) . '">provjera dostupnosti</a></p></div>';
    });
});
add_action('admin_post_matinf_seed_demo', function () {
    if (!current_user_can('manage_options')) wp_die('Pristup nije dozvoljen.', '', ['response' => 403]);
    check_admin_referer('matinf_seed_demo');
    matinf_seed_demo();
    wp_safe_redirect(admin_url('tools.php?page=matinf-demo'));
    exit;
});

// Native REST routes are useful for draft editing, but may not publish a new
// academic record without the required, validated metadata from its edit form.
foreach (['mf_program', 'mf_course', 'mf_staff', 'mf_document'] as $type) {
    add_filter('rest_pre_insert_' . $type, function ($prepared, $request) use ($type) {
        $id = (int) ($request['id'] ?? 0);
        $status = $prepared->post_status ?? ($id ? get_post_status($id) : 'draft');
        if ($status !== 'publish') return $prepared;
        $fields = [];
        foreach (['level', 'ects', 'programId', 'year', 'semester', 'staffIds', 'documentIds', 'academicTitle', 'email', 'fileUrl', 'mimeType'] as $key) {
            if ($id && metadata_exists('post', $id, '_matinf_' . $key)) $fields[$key] = get_post_meta($id, '_matinf_' . $key, true);
        }
        $valid = matinf_validate_fields($type, $fields);
        return is_wp_error($valid) ? $valid : $prepared;
    }, 10, 2);
}
