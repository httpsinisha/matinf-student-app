<?php
defined('ABSPATH') || exit;

function matinf_schedule_result($request) {
    $pid = (int) $request['program_id']; $year = (int) $request['year']; $semester = (int) $request['semester'];
    if (!matinf_is_public($pid, 'mf_program') || $year < 1 || $year > (int) get_post_meta($pid, '_matinf_durationYears', true) || !in_array($semester, [1, 2], true)) return new WP_Error('matinf_schedule_selection', 'Izaberite važeći program i godinu.', ['status' => 400]);
    $items = [];
    foreach ((array) get_option('matinf_schedule', []) as $row) {
        if ($row['programId'] !== $pid || $row['year'] !== $year || $row['semester'] !== $semester || !matinf_is_public($row['courseId'], 'mf_course')) continue;
        $items[] = array_merge($row, ['course' => matinf_summary($row['courseId']), 'staff' => matinf_summary($row['staffId'])]);
    }
    usort($items, fn($a, $b) => [$a['day'], $a['start'], $a['courseId']] <=> [$b['day'], $b['start'], $b['courseId']]);
    return ['demo' => true, 'academicYear' => '2026/2027', 'timezone' => 'Europe/Sarajevo', 'note' => 'Izmišljeni raspored za demonstraciju. Izborni predmeti predstavljaju ogledni izbor. Praksa i završni rad se dogovaraju posebno. Za stvarne termine provjerite zvanični sajt.', 'program' => matinf_summary($pid), 'year' => $year, 'semester' => $semester, 'items' => $items];
}
add_action('rest_api_init', function () {
    register_rest_route('matinf/v1', '/schedule', ['methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => 'matinf_schedule_result', 'args' => [
        'program_id' => ['type' => 'integer', 'required' => true, 'minimum' => 1],
        'year' => ['type' => 'integer', 'required' => true, 'minimum' => 1, 'maximum' => 4],
        'semester' => ['type' => 'integer', 'default' => 1, 'minimum' => 1, 'maximum' => 2],
    ]]);
});

add_shortcode('matinf_schedule', function () {
    $groups = matinf_program_groups(); $programs = $groups['undergraduate']['items'];
    if (!$programs) return '<p>Raspored još nije dostupan.</p>';
    $pid = absint($_GET['program_id'] ?? $programs[0]->ID); $year = absint($_GET['year'] ?? 1); $semester = absint($_GET['semester'] ?? 1);
    $result = matinf_schedule_result(['program_id' => $pid, 'year' => $year, 'semester' => $semester]);
    ob_start();
    echo '<p><strong>Demonstracijski raspored 2026/2027 — izmišljeni termini</strong></p><form method="get"><label>Program <select name="program_id">';
    foreach ($programs as $program) echo '<option value="' . (int) $program->ID . '" ' . selected($pid, $program->ID, false) . '>' . esc_html($program->post_title) . '</option>';
    echo '</select></label> <label>Godina <select name="year">';
    for ($i = 1; $i <= 4; $i++) echo '<option value="' . $i . '" ' . selected($year, $i, false) . '>' . $i . '.</option>';
    echo '</select></label> <label>Semestar <select name="semester"><option value="1" ' . selected($semester, 1, false) . '>Zimski</option><option value="2" ' . selected($semester, 2, false) . '>Ljetni</option></select></label> <button class="button">Prikaži raspored</button></form>';
    if (is_wp_error($result)) echo '<p>' . esc_html($result->get_error_message()) . '</p>';
    else {
        echo '<p>' . esc_html($result['note']) . '</p>';
        foreach (['Ponedjeljak','Utorak','Srijeda','Četvrtak','Petak'] as $day => $name) {
            echo '<h3>' . esc_html($name) . '</h3><ul>';
            $rows = array_filter($result['items'], fn($row) => $row['day'] === $day + 1);
            foreach ($rows as $row) echo '<li><strong>' . esc_html($row['start'] . '–' . $row['end']) . '</strong> · <a href="' . esc_url($row['course']['url']) . '">' . esc_html($row['course']['title']) . '</a> · ' . esc_html($row['kind'] . ' · ' . $row['room'] . ' · ' . ($row['staff']['title'] ?? '')) . '</li>';
            if (!$rows) echo '<li>Nema planirane nastave.</li>';
            echo '</ul>';
        }
    }
    return ob_get_clean();
});
