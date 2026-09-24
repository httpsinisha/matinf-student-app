<?php
defined('ABSPATH') || exit;

add_action('admin_menu', function () {
    add_management_page('MATINF push', 'MATINF push', 'manage_options', 'matinf-push', 'matinf_push_admin_page');
});
function matinf_push_admin_page() {
    if (!current_user_can('manage_options')) return;
    global $wpdb;
    [$devices, $jobs] = matinf_push_tables();
    echo '<div class="wrap"><h1>MATINF push obavještenja</h1><p>Nova objava se šalje pratiocima izabrane publike ako urednik označi slanje pri prvom objavljivanju. Izmjene postojeće objave ne šalju ponovo.</p>';
    echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="matinf_push_settings">';
    wp_nonce_field('matinf_push_settings');
    echo '<label><input type="checkbox" name="enabled" value="1" ' . checked((bool) get_option('matinf_push_enabled'), true, false) . '> Uključi push dostavu</label>';
    submit_button('Sačuvaj'); echo '</form>';
    echo '<h2>Status</h2><p>Aktivne instalacije: <strong>' . (int) $wpdb->get_var("SELECT COUNT(*) FROM $devices WHERE enabled=1") . '</strong></p>';
    $last = (int) get_option('matinf_push_last_tick');
    echo '<p>Posljednja obrada reda: ' . ($last ? esc_html(wp_date('d.m.Y. H:i:s', $last)) : 'Još nije pokrenuta') . '</p>';
    $labels = ['pending' => 'Čeka slanje', 'receipt' => 'Expo primio; čeka potvrdu', 'accepted' => 'FCM/APNs prihvatio', 'failed' => 'Greška', 'cancelled' => 'Otkazano'];
    foreach ($wpdb->get_results("SELECT status,COUNT(*) AS total FROM $jobs GROUP BY status") as $row) echo '<p>' . esc_html($labels[$row->status] ?? $row->status) . ': ' . (int) $row->total . '</p>';
    echo '<p>Prihvatanje od FCM/APNs nije potvrda da je uređaj prikazao poruku. Istorija se čuva 30 dana, neaktivne instalacije 90 dana.</p>';
    echo '<h2>Veza s Expo servisom</h2><form method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="matinf_push_probe">';
    wp_nonce_field('matinf_push_probe'); submit_button('Provjeri HTTPS vezu', 'secondary'); echo '</form>';
    $probe = get_option('matinf_push_probe_result');
    if ($probe) echo '<p>' . esc_html($probe) . '</p>';
    echo '<h2>Redovno pokretanje</h2><p>U alwaysdata dodajte zakazani zadatak svake minute:</p><pre>' . esc_html('curl --fail --silent --show-error --max-time 50 ' . escapeshellarg(site_url('/wp-cron.php?doing_wp_cron')) . ' > /dev/null') . '</pre><p>Bez zakazanog zadatka slanje može čekati sljedeću posjetu sajtu.</p>';
    echo '<h2>Posljednje greške</h2><ul>';
    foreach ($wpdb->get_results("SELECT post_id,error_code FROM $jobs WHERE status='failed' ORDER BY id DESC LIMIT 10") as $row) echo '<li>Objava ' . (int) $row->post_id . ': ' . esc_html($row->error_code) . '</li>';
    echo '</ul></div>';
}
add_action('admin_post_matinf_push_settings', function () {
    if (!current_user_can('manage_options')) wp_die('Pristup nije dozvoljen.', '', ['response' => 403]);
    check_admin_referer('matinf_push_settings');
    update_option('matinf_push_enabled', !empty($_POST['enabled']), false);
    if (empty($_POST['enabled'])) wp_clear_scheduled_hook('matinf_push_tick');
    wp_safe_redirect(admin_url('tools.php?page=matinf-push')); exit;
});
add_action('admin_post_matinf_push_probe', function () {
    if (!current_user_can('manage_options')) wp_die('Pristup nije dozvoljen.', '', ['response' => 403]);
    check_admin_referer('matinf_push_probe');
    // Empty receipt request checks outbound HTTPS without sending a notification.
    $result = matinf_push_http('getReceipts', ['ids' => []]);
    update_option('matinf_push_probe_result', wp_date('d.m.Y. H:i:s') . ' — ' . (isset($result['error']) ? $result['error'] : 'Expo HTTPS veza radi.'), false);
    wp_safe_redirect(admin_url('tools.php?page=matinf-push')); exit;
});
