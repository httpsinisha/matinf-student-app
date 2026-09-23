<?php
defined('ABSPATH') || exit;
add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', ['gallery', 'caption', 'style', 'script']);
    register_nav_menus(['primary' => 'Glavna navigacija']);
});
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('matinf', get_stylesheet_uri(), [], '0.1.0');
    wp_enqueue_script('matinf-navigation', get_template_directory_uri() . '/navigation.js', [], '0.1.0', true);
});

function matinf_theme_navigation() {
    $links = [home_url('/') => 'Početna'];
    foreach (['obavjestenja' => 'Obavještenja', 'novosti' => 'Novosti'] as $slug => $label) {
        $term = get_term_by('slug', $slug, 'category');
        if ($term) $links[get_category_link($term)] = $label;
    }
    foreach (['mf_program' => 'Studije', 'mf_course' => 'Predmeti', 'mf_staff' => 'Osoblje', 'mf_document' => 'Dokumenti'] as $type => $label) {
        $url = get_post_type_archive_link($type);
        if ($url) $links[$url] = $label;
    }
    $contact = get_page_by_path('kontakt');
    if ($contact && $contact->post_status === 'publish') $links[get_permalink($contact)] = 'Kontakt';
    foreach ($links as $url => $label) echo '<a href="' . esc_url($url) . '">' . esc_html($label) . '</a>';
}

function matinf_theme_card($post) {
    $collection = function_exists('matinf_collection_for_post') ? matinf_collection_for_post($post) : 'pages';
    $labels = ['announcements' => 'Obavještenje', 'news' => 'Novost', 'programs' => 'Studijski program', 'courses' => 'Predmet', 'staff' => 'Nastavno osoblje', 'documents' => 'Dokument', 'pages' => 'Informacije'];
    $important = (bool) get_post_meta($post->ID, '_matinf_important', true);
    echo '<article class="card">';
    if (has_post_thumbnail($post)) echo get_the_post_thumbnail($post, 'medium_large', ['class' => 'card-image', 'loading' => 'lazy']);
    echo '<div class="card-meta"><span class="tag' . ($important ? ' important' : '') . '">' . esc_html($important ? 'Važno' : $labels[$collection]) . '</span>';
    if (in_array($collection, ['news', 'announcements'], true)) echo '<time class="date" datetime="' . esc_attr(get_the_date('c', $post)) . '">' . esc_html(get_the_date('d. m. Y.', $post)) . '</time>';
    echo '</div><h3><a href="' . esc_url(get_permalink($post)) . '">' . esc_html(get_the_title($post)) . '</a></h3>';
    $excerpt = function_exists('matinf_excerpt') ? matinf_excerpt($post, 22) : get_the_excerpt($post);
    if ($collection === 'programs') $excerpt = get_post_meta($post->ID, '_matinf_durationYears', true) . ' god. · ' . get_post_meta($post->ID, '_matinf_ects', true) . ' ECTS';
    if ($collection === 'staff') $excerpt = get_post_meta($post->ID, '_matinf_academicTitle', true);
    if ($collection === 'courses') $excerpt = get_post_meta($post->ID, '_matinf_year', true) . '. godina · ' . get_post_meta($post->ID, '_matinf_semester', true) . '. semestar';
    echo '<p>' . esc_html($excerpt) . '</p><a class="read-more" href="' . esc_url(get_permalink($post)) . '">Pogledaj detalje <span aria-hidden="true">→</span></a></article>';
}

function matinf_theme_related($title, $items) {
    if (!$items) return;
    echo '<section class="card"><h3>' . esc_html($title) . '</h3><ul class="related">';
    foreach ($items as $item) echo '<li><a href="' . esc_url($item['url']) . '">' . esc_html($item['title']) . ' <span aria-hidden="true">→</span></a></li>';
    echo '</ul></section>';
}

add_action('pre_get_posts', function ($query) {
    if (is_admin() || !$query->is_main_query()) return;
    $query->set('has_password', false);
    if ($query->is_archive()) $query->set('posts_per_page', 12);
});
