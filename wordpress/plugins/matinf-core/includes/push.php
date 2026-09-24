<?php
defined('ABSPATH') || exit;

function matinf_push_tables() {
    global $wpdb;
    return [$wpdb->prefix . 'matinf_devices', $wpdb->prefix . 'matinf_push_jobs'];
}

function matinf_push_install() {
    if (get_option('matinf_push_schema') === '1') return;
    global $wpdb;
    [$devices, $jobs] = matinf_push_tables();
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $charset = $wpdb->get_charset_collate();
    dbDelta("CREATE TABLE $devices (
        installation varchar(36) NOT NULL,
        secret_hash varchar(64) NOT NULL,
        token varchar(255) NOT NULL,
        token_hash varchar(64) NOT NULL,
        preferences longtext NOT NULL,
        enabled tinyint NOT NULL DEFAULT 1,
        updated_at bigint NOT NULL,
        PRIMARY KEY  (installation),
        UNIQUE KEY token_hash (token_hash)
    ) $charset;");
    dbDelta("CREATE TABLE $jobs (
        id bigint unsigned NOT NULL AUTO_INCREMENT,
        post_id bigint unsigned NOT NULL,
        installation varchar(36) NOT NULL,
        status varchar(24) NOT NULL DEFAULT 'pending',
        attempts int NOT NULL DEFAULT 0,
        due_at bigint NOT NULL,
        created_at bigint NOT NULL,
        ticket varchar(100) NOT NULL DEFAULT '',
        token_hash varchar(64) NOT NULL DEFAULT '',
        error_code varchar(80) NOT NULL DEFAULT '',
        PRIMARY KEY  (id),
        UNIQUE KEY publication_device (post_id,installation),
        KEY due (status,due_at)
    ) $charset;");
    // Installing push must never turn older posts into new notifications.
    $wpdb->query($wpdb->prepare("INSERT INTO $wpdb->postmeta (post_id,meta_key,meta_value) SELECT ID,%s,%s FROM $wpdb->posts p WHERE post_type='post' AND post_status='publish' AND NOT EXISTS (SELECT 1 FROM $wpdb->postmeta m WHERE m.post_id=p.ID AND m.meta_key=%s)", '_matinf_push_seen', (string) time(), '_matinf_push_seen'));
    update_option('matinf_push_schema', '1', false);
}
add_action('init', 'matinf_push_install', 5);

// Devices may only update their own registration using an installation secret.
// Neither tokens nor subscriptions have a public read endpoint.
add_action('rest_api_init', function () {
    register_rest_route('matinf/v1', '/push/installation/(?P<installation>[a-f0-9-]{36})', [
        'methods' => ['PUT', 'DELETE'], 'permission_callback' => '__return_true',
        'callback' => 'matinf_push_register',
    ]);
});
function matinf_push_register($request) {
    global $wpdb;
    [$devices] = matinf_push_tables();
    $id = $request['installation'];
    $secret = $request->get_header('x-matinf-installation-secret');
    if (!preg_match('/^[a-f0-9]{64}$/D', $secret)) return new WP_Error('matinf_device_auth', 'Nedostaje ključ instalacije.', ['status' => 401]);
    $hash = hash('sha256', $secret);
    $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM $devices WHERE installation=%s", $id));
    if ($existing && !hash_equals($existing->secret_hash, $hash)) return new WP_Error('matinf_device_auth', 'Pogrešan ključ instalacije.', ['status' => 403]);
    if ($request->get_method() === 'DELETE') {
        if ($existing) $wpdb->update($devices, ['enabled' => 0, 'updated_at' => time()], ['installation' => $id]);
        return new WP_REST_Response(['enabled' => false]);
    }
    $rate_key = 'mf_push_rate_' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'local');
    $count = (int) get_transient($rate_key);
    if ($count >= 30) return new WP_Error('matinf_device_rate', 'Pokušajte ponovo za minut.', ['status' => 429]);
    set_transient($rate_key, $count + 1, 60);
    $body = $request->get_json_params();
    if (!is_array($body) || strlen($request->get_body()) > 10000) return new WP_Error('matinf_device_body', 'Neispravna registracija.', ['status' => 400]);
    $token = $body['token'] ?? '';
    if (!is_string($token) || !preg_match('/^(ExponentPushToken|ExpoPushToken)\[[a-zA-Z0-9_-]{10,200}\]$/D', $token)) return new WP_Error('matinf_token', 'Neispravan push token.', ['status' => 400]);
    $years = matinf_validate_years($body['programYears'] ?? []);
    $courses = matinf_valid_ids($body['courseIds'] ?? [], 'mf_course');
    if (is_wp_error($years)) return $years;
    if (is_wp_error($courses)) return $courses;
    $token_hash = hash('sha256', $token);
    $owner = $wpdb->get_var($wpdb->prepare("SELECT installation FROM $devices WHERE token_hash=%s", $token_hash));
    if ($owner && $owner !== $id) return new WP_Error('matinf_token_owner', 'Token je već vezan za drugu instalaciju.', ['status' => 409]);
    $data = ['secret_hash' => $hash, 'token' => $token, 'token_hash' => $token_hash, 'preferences' => wp_json_encode(['programYears' => $years, 'courseIds' => $courses]), 'enabled' => 1, 'updated_at' => time()];
    $ok = $existing ? $wpdb->update($devices, $data, ['installation' => $id]) : $wpdb->insert($devices, array_merge($data, ['installation' => $id]));
    if ($ok === false) return new WP_Error('matinf_device_store', 'Registracija nije sačuvana.', ['status' => 503]);
    return new WP_REST_Response(['enabled' => true, 'deliveryEnabled' => (bool) get_option('matinf_push_enabled')]);
}

function matinf_push_matches($post_id, $preferences) {
    $request = new WP_REST_Request();
    $request['program_years'] = implode(',', $preferences['programYears'] ?? []);
    $request['course_ids'] = implode(',', $preferences['courseIds'] ?? []);
    $query = matinf_feed_query($request);
    if (is_wp_error($query)) return false;
    return (bool) get_posts(['post_type' => 'post', 'post_status' => 'publish', 'has_password' => false, 'include' => [$post_id], 'fields' => 'ids', 'meta_query' => $query]);
}

// Store the editor's choice with the existing authenticated metadata form.
add_action('save_post_post', function ($id) {
    if (wp_is_post_revision($id) || wp_is_post_autosave($id) || !current_user_can('edit_post', $id) || !isset($_POST['matinf_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['matinf_nonce'])), 'matinf_save_fields')) return;
    update_post_meta($id, '_matinf_send_push', !empty($_POST['matinf']['sendPush']));
});
add_action('transition_post_status', function ($new, $old, $post) {
    if ($new !== 'publish' || $old === 'publish' || $post->post_type !== 'post') return;
    // Shutdown observes the final validated metadata/categories, including REST saves.
    add_action('shutdown', function () use ($post) { matinf_push_first_publication($post->ID); });
}, 10, 3);
function matinf_push_first_publication($id) {
    if (!matinf_is_public($id, 'post') || get_post_meta($id, '_matinf_push_seen', true)) return;
    add_post_meta($id, '_matinf_push_seen', time(), true);
    if (get_option('matinf_push_enabled') && get_post_meta($id, '_matinf_send_push', true) && has_category(['novosti', 'obavjestenja'], $id)) {
        wp_schedule_single_event(time() + 1, 'matinf_push_enqueue', [$id]);
    }
}
add_action('matinf_push_enqueue', 'matinf_push_enqueue');
function matinf_push_enqueue($id) {
    if (!get_option('matinf_push_enabled') || !matinf_is_public($id, 'post') || !has_category(['novosti', 'obavjestenja'], $id)) return;
    global $wpdb;
    [$devices, $jobs] = matinf_push_tables();
    foreach ($wpdb->get_results($wpdb->prepare("SELECT * FROM $devices WHERE enabled=1 AND updated_at>%d", time() - 90 * DAY_IN_SECONDS)) as $device) {
        if (!matinf_push_matches($id, json_decode($device->preferences, true) ?: [])) continue;
        $wpdb->query($wpdb->prepare("INSERT IGNORE INTO $jobs (post_id,installation,due_at,created_at) VALUES (%d,%s,%d,%d)", $id, $device->installation, time(), time()));
    }
}

add_filter('cron_schedules', function ($schedules) { $schedules['matinf_minute'] = ['interval' => 60, 'display' => 'MATINF: svake minute']; return $schedules; });
add_action('init', function () {
    if (get_option('matinf_push_enabled') && !wp_next_scheduled('matinf_push_tick')) wp_schedule_event(time() + 60, 'matinf_minute', 'matinf_push_tick');
});
add_action('matinf_push_tick', 'matinf_push_tick');
function matinf_push_http($path, $payload) {
    $headers = ['Content-Type' => 'application/json', 'Accept' => 'application/json'];
    // Optional Expo enhanced-security access token stays on the server only.
    if (defined('MATINF_EXPO_ACCESS_TOKEN') && MATINF_EXPO_ACCESS_TOKEN) $headers['Authorization'] = 'Bearer ' . MATINF_EXPO_ACCESS_TOKEN;
    $response = wp_remote_post('https://exp.host/--/api/v2/push/' . $path, ['timeout' => 15, 'headers' => $headers, 'body' => wp_json_encode($payload)]);
    if (is_wp_error($response)) return ['retry' => true, 'error' => 'NetworkError'];
    $code = wp_remote_retrieve_response_code($response);
    if ($code !== 200) return ['retry' => $code === 429 || $code >= 500, 'error' => 'HTTP_' . $code];
    $data = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($data) || !isset($data['data']) || !is_array($data['data'])) return ['retry' => true, 'error' => 'InvalidResponse'];
    return ['data' => $data['data']];
}
function matinf_push_fail($job, $code, $retry) {
    global $wpdb;
    [, $jobs] = matinf_push_tables();
    $attempts = (int) $job->attempts + 1;
    $wpdb->update($jobs, ['status' => $retry && $attempts < 5 ? 'pending' : 'failed', 'attempts' => $attempts, 'due_at' => time() + min(3600, 60 * (2 ** $attempts)), 'error_code' => substr($code, 0, 80)], ['id' => $job->id]);
}
function matinf_push_unregister_token($job) {
    global $wpdb;
    [$devices] = matinf_push_tables();
    // A receipt for an old token must not disable a newly rotated token.
    $wpdb->update($devices, ['enabled' => 0], ['installation' => $job->installation, 'token_hash' => $job->token_hash]);
}
function matinf_push_tick() {
    if (!get_option('matinf_push_enabled')) return;
    global $wpdb;
    [$devices, $jobs] = matinf_push_tables();
    // add_option is an atomic unique-key lock across overlapping cron requests.
    $lock = (int) get_option('matinf_push_lock');
    if ($lock && $lock < time() - 180) delete_option('matinf_push_lock');
    if (!add_option('matinf_push_lock', time(), '', false)) return;
    try {
        update_option('matinf_push_last_tick', time(), false);
        $pending = $wpdb->get_results($wpdb->prepare("SELECT * FROM $jobs WHERE status='pending' AND due_at<=%d ORDER BY id LIMIT 25", time()));
        $batch = []; $active = [];
        foreach ($pending as $job) {
            $device = $wpdb->get_row($wpdb->prepare("SELECT * FROM $devices WHERE installation=%s AND enabled=1 AND updated_at>%d", $job->installation, time() - 90 * DAY_IN_SECONDS));
            if (!$device || !matinf_is_public($job->post_id, 'post') || !has_category(['novosti', 'obavjestenja'], $job->post_id) || !matinf_push_matches($job->post_id, json_decode($device->preferences, true) ?: [])) {
                $wpdb->update($jobs, ['status' => 'cancelled'], ['id' => $job->id]); continue;
            }
            $post = get_post($job->post_id);
            $job->token_hash = $device->token_hash;
            $batch[] = ['to' => $device->token, 'title' => wp_html_excerpt(html_entity_decode(wp_strip_all_tags($post->post_title), ENT_QUOTES, 'UTF-8'), 100, '…'),
                'body' => wp_html_excerpt(wp_strip_all_tags(strip_shortcodes($post->post_excerpt ?: $post->post_content)), 200, '…'),
                'sound' => 'default', 'channelId' => 'academic', 'priority' => 'high', 'ttl' => 86400,
                'data' => ['version' => 1, 'siteUrl' => untrailingslashit(home_url()), 'collection' => has_category('obavjestenja', $post) ? 'announcements' : 'news', 'id' => (int) $job->post_id]];
            $active[] = $job;
        }
        if ($batch) {
            $result = matinf_push_http('send', $batch);
            foreach ($active as $index => $job) {
                if (isset($result['error'])) { matinf_push_fail($job, $result['error'], $result['retry']); continue; }
                $ticket = $result['data'][$index] ?? [];
                if (($ticket['status'] ?? '') === 'ok' && !empty($ticket['id'])) {
                    $wpdb->update($jobs, ['status' => 'receipt', 'ticket' => sanitize_text_field($ticket['id']), 'token_hash' => $job->token_hash, 'due_at' => time() + 15 * MINUTE_IN_SECONDS, 'attempts' => (int) $job->attempts + 1], ['id' => $job->id]);
                } else {
                    $code = $ticket['details']['error'] ?? 'InvalidTicket';
                    if ($code === 'DeviceNotRegistered') matinf_push_unregister_token($job);
                    matinf_push_fail($job, $code, in_array($code, ['MessageRateExceeded', 'InvalidTicket'], true));
                }
            }
        }
        $receipts = $wpdb->get_results($wpdb->prepare("SELECT * FROM $jobs WHERE status='receipt' AND due_at<=%d ORDER BY id LIMIT 100", time()));
        if ($receipts) {
            $result = matinf_push_http('getReceipts', ['ids' => array_column($receipts, 'ticket')]);
            foreach ($receipts as $job) {
                $receipt = $result['data'][$job->ticket] ?? null;
                if (!$receipt) {
                    $wpdb->update($jobs, ['status' => (int) $job->created_at < time() - DAY_IN_SECONDS ? 'failed' : 'receipt', 'due_at' => time() + 15 * MINUTE_IN_SECONDS, 'error_code' => $result['error'] ?? 'ReceiptPending'], ['id' => $job->id]);
                    continue;
                }
                $code = $receipt['details']['error'] ?? '';
                if ($code === 'DeviceNotRegistered') matinf_push_unregister_token($job);
                if ($code === 'MessageRateExceeded') { matinf_push_fail($job, $code, true); continue; }
                $wpdb->update($jobs, ['status' => ($receipt['status'] ?? '') === 'ok' ? 'accepted' : 'failed', 'error_code' => substr($code, 0, 80)], ['id' => $job->id]);
            }
        }
        $wpdb->query($wpdb->prepare("DELETE FROM $jobs WHERE created_at<%d", time() - 30 * DAY_IN_SECONDS));
        $wpdb->query($wpdb->prepare("DELETE FROM $devices WHERE updated_at<%d", time() - 90 * DAY_IN_SECONDS));
    } finally { delete_option('matinf_push_lock'); }
}
