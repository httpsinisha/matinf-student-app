<?php
defined('ABSPATH') || exit;

function matinf_collection_for_post($post) {
    if ($post->post_type === 'post') return has_category('obavjestenja', $post) ? 'announcements' : 'news';
    return array_search($post->post_type, matinf_collections(), true) ?: 'pages';
}

function matinf_summary($id) {
    if (!matinf_is_public($id)) return null;
    $post = get_post($id);
    return ['id' => $post->ID, 'title' => html_entity_decode(get_the_title($post), ENT_QUOTES, 'UTF-8'), 'url' => get_permalink($post), 'type' => matinf_collection_for_post($post)];
}

function matinf_related($id, $key, $type) {
    $ids = get_post_meta($id, '_matinf_' . $key, true);
    if (!is_array($ids)) return [];
    return array_values(array_filter(array_map(function ($related) use ($type) {
        return matinf_is_public($related, $type) ? matinf_summary($related) : null;
    }, array_slice($ids, 0, 50))));
}

function matinf_content_item($post, $collection, $detail = false) {
    $id = $post->ID;
    $read = fn ($key) => get_post_meta($id, '_matinf_' . $key, true);
    $meta = [];
    $relations = ['documents' => matinf_related($id, 'documentIds', 'mf_document')];
    if ($collection === 'programs') $meta = ['level' => $read('level'), 'durationYears' => (int) $read('durationYears'), 'ects' => (int) $read('ects')];
    if ($collection === 'courses') {
        $program = matinf_is_public($read('programId'), 'mf_program') ? (int) $read('programId') : null;
        $meta = ['programId' => $program, 'year' => (int) $read('year'), 'semester' => (int) $read('semester')];
        $relations['program'] = $program ? matinf_summary($program) : null;
        $relations['staff'] = matinf_related($id, 'staffIds', 'mf_staff');
    }
    if ($collection === 'staff') $meta = ['academicTitle' => $read('academicTitle'), 'email' => $read('email')];
    if ($collection === 'documents') $meta = ['fileUrl' => esc_url_raw($read('fileUrl'), ['https', 'http']), 'mimeType' => $read('mimeType')];
    if (in_array($collection, ['news', 'announcements'], true)) $meta = ['important' => (bool) $read('important'), 'audience' => matinf_post_audience($id), 'authorName' => get_the_author_meta('display_name', $post->post_author)];
    if (in_array($collection, ['news', 'announcements'], true)) {
        $meta['attachments'] = [];
        foreach ((array) $read('attachmentIds') as $file_id) {
            if (get_post_type($file_id) !== 'attachment' || get_post_status($file_id) === 'trash') continue;
            $url = wp_get_attachment_url($file_id);
            if ($url) $meta['attachments'][] = ['id' => (int) $file_id, 'title' => get_the_title($file_id), 'url' => esc_url_raw($url), 'mimeType' => get_post_mime_type($file_id)];
        }
    }
    if ($detail && in_array($collection, ['programs', 'staff'], true)) {
        $args = ['post_type' => 'mf_course', 'post_status' => 'publish', 'has_password' => false, 'posts_per_page' => 50, 'orderby' => 'title', 'order' => 'ASC'];
        if ($collection === 'programs') $args['meta_query'] = [['key' => '_matinf_programId', 'value' => $id, 'type' => 'NUMERIC']];
        else $args['meta_query'] = [['key' => '_matinf_staffId', 'value' => $id, 'type' => 'NUMERIC']];
        $relations['courses'] = array_map(fn ($course) => matinf_summary($course->ID), get_posts($args));
    }
    $image_id = get_post_thumbnail_id($id);
    $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'large') : false;
    return [
        'id' => $id, 'type' => $collection, 'slug' => $post->post_name,
        'title' => html_entity_decode(get_the_title($post), ENT_QUOTES, 'UTF-8'),
        'excerpt' => matinf_excerpt($post),
        'bodyHtml' => matinf_body_html($post), 'url' => get_permalink($post),
        'publishedAt' => get_post_time('Y-m-d\TH:i:s\Z', true, $post), 'updatedAt' => get_post_modified_time('Y-m-d\TH:i:s\Z', true, $post),
        'image' => $image_url ? ['url' => $image_url, 'alt' => get_post_meta($image_id, '_wp_attachment_image_alt', true)] : null,
        'meta' => (object) $meta, 'relations' => (object) $relations,
    ];
}

function matinf_content_list($request) {
    $collection = $request['collection'];
    $page = (int) ($request['page'] ?? 1);
    $per_page = (int) ($request['per_page'] ?? 20);
    $type = $collection === 'feed' ? 'post' : (matinf_collections()[$collection] ?? null);
    if (!$type) return new WP_Error('matinf_collection', 'Nepoznata zbirka.', ['status' => 404]);
    $args = ['post_type' => $type, 'post_status' => 'publish', 'has_password' => false, 'posts_per_page' => $per_page, 'paged' => $page];
    if ($type === 'post') $args['category_name'] = $collection === 'feed' ? 'novosti,obavjestenja' : ($collection === 'news' ? 'novosti' : 'obavjestenja');
    else { $args['orderby'] = 'title'; $args['order'] = 'ASC'; }
    if ($type === 'post' && !empty($request['following'])) {
        $filter = matinf_feed_query($request);
        if (is_wp_error($filter)) return $filter;
        $args['meta_query'] = $filter;
    }
    if ($collection === 'courses') {
        foreach (['program_id' => '_matinf_programId', 'year' => '_matinf_year'] as $param => $key) {
            if (isset($request[$param])) $args['meta_query'][] = ['key' => $key, 'value' => (int) $request[$param], 'type' => 'NUMERIC'];
        }
    }
    $query = new WP_Query($args);
    return ['items' => array_map(fn ($post) => matinf_content_item($post, $collection === 'feed' ? matinf_collection_for_post($post) : $collection), $query->posts), 'page' => $page, 'perPage' => $per_page, 'total' => (int) $query->found_posts, 'totalPages' => (int) $query->max_num_pages];
}

function matinf_content_detail($request) {
    $collection = $request['collection'];
    $type = matinf_collections()[$collection] ?? null;
    $id = (int) $request['id'];
    if (!$type || !matinf_is_public($id, $type) || ($type === 'post' && !has_category($collection === 'news' ? 'novosti' : 'obavjestenja', $id))) {
        return new WP_Error('matinf_not_found', 'Sadržaj nije dostupan.', ['status' => 404]);
    }
    return matinf_content_item(get_post($id), $collection, true);
}

add_action('rest_api_init', function () {
    register_rest_route('matinf/v1', '/health', ['methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => fn () => ['status' => 'ok', 'apiVersion' => 1, 'pluginVersion' => MATINF_VERSION, 'wordpressVersion' => get_bloginfo('version'), 'siteUrl' => home_url(), 'siteName' => get_bloginfo('name')]]);
    $collection_pattern = '(?P<collection>feed|news|announcements|programs|courses|staff|documents|pages)';
    register_rest_route('matinf/v1', '/content/' . $collection_pattern, [
        'methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => 'matinf_content_list',
        'args' => [
            'page' => ['type' => 'integer', 'minimum' => 1, 'default' => 1],
            'per_page' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50, 'default' => 20],
            'program_id' => ['type' => 'integer', 'minimum' => 1],
            'year' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 4],
            'following' => ['type' => 'boolean', 'default' => false],
            'program_years' => ['type' => 'string', 'maxLength' => 1500, 'default' => ''],
            'course_ids' => ['type' => 'string', 'maxLength' => 1500, 'default' => ''],
        ],
    ]);
    register_rest_route('matinf/v1', '/content/' . $collection_pattern . '/(?P<id>\d+)', ['methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => 'matinf_content_detail']);
    register_rest_route('matinf/v1', '/home', ['methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => function () {
        $result = [];
        foreach (['announcements' => 5, 'news' => 3] as $type => $count) $result[$type] = matinf_content_list(['collection' => $type, 'per_page' => $count])['items'];
        return $result;
    }]);
});
