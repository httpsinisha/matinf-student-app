<?php
defined('ABSPATH') || exit;

function matinf_program_groups() {
    $groups = ['undergraduate' => ['label' => 'Osnovne studije', 'items' => []], 'master' => ['label' => 'Master studije', 'items' => []], 'doctoral' => ['label' => 'Doktorske studije', 'items' => []]];
    foreach (get_posts(['post_type' => 'mf_program', 'post_status' => 'publish', 'has_password' => false, 'numberposts' => -1, 'orderby' => 'title', 'order' => 'ASC']) as $program) {
        $level = get_post_meta($program->ID, '_matinf_level', true);
        if (isset($groups[$level])) $groups[$level]['items'][] = $program;
    }
    return $groups;
}

function matinf_audience_choices($audience) {
    echo '<h4>Programi, godine i pojedinačni predmeti</h4><p>Označite više stavki bez Ctrl tipke. Dovoljno je da student prati bilo koju izabranu godinu ili predmet.</p>';
    foreach (matinf_program_groups() as $group) {
        echo '<h4>' . esc_html($group['label']) . '</h4>';
        foreach ($group['items'] as $program) {
            $courses = get_posts(['post_type' => 'mf_course', 'post_status' => 'publish', 'has_password' => false, 'numberposts' => -1, 'orderby' => 'title', 'order' => 'ASC', 'meta_key' => '_matinf_programId', 'meta_value' => $program->ID]);
            $count = count(array_filter($audience['programYears'], fn($id) => str_starts_with($id, $program->ID . ':'))) + count(array_intersect(array_column($courses, 'ID'), $audience['courseIds']));
            echo '<details class="mf-audience-program" style="border:1px solid #ccd0d4;padding:12px;margin:8px 0"' . ($count ? ' open' : '') . '><summary><strong>' . esc_html($program->post_title) . '</strong> <span class="mf-choice-count">(' . (int) $count . ' označeno)</span></summary>';
            for ($year = 1; $year <= (int) get_post_meta($program->ID, '_matinf_durationYears', true); $year++) {
                $value = $program->ID . ':' . $year;
                echo '<p><label><input type="checkbox" name="matinf[audienceYears][]" value="' . esc_attr($value) . '" ' . checked(in_array($value, $audience['programYears'], true), true, false) . '> <strong>' . (int) $year . '. godina — cijela godina</strong></label></p>';
                foreach ($courses as $course) if ((int) get_post_meta($course->ID, '_matinf_year', true) === $year) {
                    echo '<label style="display:block;margin:7px 0 7px 22px"><input type="checkbox" name="matinf[audienceCourseIds][]" value="' . (int) $course->ID . '" ' . checked(in_array($course->ID, $audience['courseIds'], true), true, false) . '> ' . esc_html($course->post_title) . '</label>';
                }
            }
            echo '</details>';
        }
    }
}

function matinf_attachments_box($post) {
    echo '<h3>Dokumenti uz objavu</h3><p>Učitajte dokument sa računara ili odaberite svoju datoteku iz Medija. Student će je moći otvoriti iz objave.</p><div id="mf-attachments">';
    foreach ((array) get_post_meta($post->ID, '_matinf_attachmentIds', true) as $id) {
        if (!$id || get_post_type($id) !== 'attachment') continue;
        echo '<p><input type="hidden" name="matinf[attachmentIds][]" value="' . (int) $id . '"><span>' . esc_html(get_the_title($id)) . '</span> <button type="button" class="button mf-remove-file">Ukloni iz objave</button></p>';
    }
    echo '</div><button type="button" class="button" id="mf-upload-files">Učitaj / dodaj dokumente</button>';
    // Preserve existing links explicitly; never preselect a random catalog document.
    foreach ((array) get_post_meta($post->ID, '_matinf_documentIds', true) as $id) if (matinf_is_public($id, 'mf_document')) {
        echo '<p><label><input type="checkbox" name="matinf[documentIds][]" value="' . (int) $id . '" checked> Postojeći dokument: ' . esc_html(get_the_title($id)) . '</label></p>';
    }
}

add_action('admin_enqueue_scripts', function ($hook) {
    if (!in_array($hook, ['post.php', 'post-new.php'], true) || get_current_screen()->post_type !== 'post') return;
    wp_enqueue_media();
    wp_enqueue_script('matinf-editor', plugins_url('../assets/editor.js', __FILE__), ['media-editor'], MATINF_VERSION, true);
});

add_filter('ajax_query_attachments_args', function ($query) {
    if (!current_user_can('edit_others_posts')) $query['author'] = get_current_user_id();
    return $query;
});
