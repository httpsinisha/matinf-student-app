<?php
defined('ABSPATH') || exit;
function matinf_update_staff_names() {
    if (get_option('matinf_staff_names_version') === '2026-09-26') return;
    $names = json_decode(file_get_contents(__DIR__ . '/../data/staff.json'), true);
    $updated = 0;
    foreach ($names as $index => $name) {
        $people = get_posts(['post_type' => 'mf_staff', 'post_status' => ['publish','draft'], 'numberposts' => 1, 'meta_key' => '_matinf_sourceKey', 'meta_value' => 'staff-' . $index]);
        if (!$people) continue;
        $id = $people[0]->ID;
        wp_update_post(['ID' => $id, 'post_title' => $name]);
        $email = get_post_meta($id, '_matinf_email', true);
        if (!$email || str_ends_with($email, '@example.org')) update_post_meta($id, '_matinf_email', str_replace('-', '.', sanitize_title(remove_accents($name))) . '@example.org');
        $updated++;
    }
    if ($updated === count($names)) update_option('matinf_staff_names_version', '2026-09-26');
}
add_action('admin_init', function () { if (current_user_can('manage_options')) matinf_update_staff_names(); });
