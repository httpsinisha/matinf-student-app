<?php
/**
 * Plugin Name: MATINF Core
 * Description: Academic content, validated relationships and the public MATINF mobile API.
 * Version: 0.6.1
 * Requires at least: 6.8
 * Requires PHP: 8.2
 * License: GPL-2.0-or-later
 * Text Domain: matinf
 */
defined('ABSPATH') || exit;
define('MATINF_VERSION', '0.6.1');
require_once __DIR__ . '/includes/editor.php';
require_once __DIR__ . '/includes/content.php';
require_once __DIR__ . '/includes/publishing.php';
require_once __DIR__ . '/includes/push.php';
require_once __DIR__ . '/includes/push-admin.php';
require_once __DIR__ . '/includes/rest.php';
require_once __DIR__ . '/includes/admin.php';
require_once __DIR__ . '/includes/demo.php';
require_once __DIR__ . '/includes/catalog.php';
require_once __DIR__ . '/includes/schedule.php';

register_activation_hook(__FILE__, function () {
    matinf_register_content();
    foreach (['novosti' => 'Novosti', 'obavjestenja' => 'Obavještenja'] as $slug => $name) {
        if (!get_term_by('slug', $slug, 'category')) wp_insert_term($name, 'category', ['slug' => $slug]);
    }
    flush_rewrite_rules();
});
register_deactivation_hook(__FILE__, 'flush_rewrite_rules');

require_once __DIR__ . '/includes/student-life.php';

require_once __DIR__ . '/includes/staff-update.php';

require_once __DIR__ . '/includes/calendar-editor.php';
require_once __DIR__ . '/includes/calendar-validation.php';
require_once __DIR__ . '/includes/contact.php';
require_once __DIR__ . '/includes/contact-admin.php';
require_once __DIR__ . '/includes/calendar-notifications.php';
