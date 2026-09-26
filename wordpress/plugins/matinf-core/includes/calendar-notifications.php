<?php
defined('ABSPATH') || exit;

function matinf_calendar_event_values($row, $type) {
    return [
        'courseId' => (int) $row['courseId'],
        'day' => $type === 'classes' ? (int) $row['day'] : 0,
        'date' => $type === 'classes' ? '' : (string) $row['date'],
        'start' => (string) $row['start'],
        'end' => (string) ($row['end'] ?? date('H:i', strtotime($row['start'] . ' +2 hours'))),
        'room' => trim((string) $row['room']),
        'label' => (string) ($type === 'classes' ? $row['kind'] : $row['period']),
    ];
}

function matinf_calendar_changes($type, $before, $after) {
    $old = array_column($before, null, 'id');
    $new = array_column($after, null, 'id');
    $today = (new DateTimeImmutable('now', new DateTimeZone('Europe/Sarajevo')))->format('Y-m-d');
    $changes = [];
    foreach (array_unique(array_merge(array_keys($old), array_keys($new))) as $id) {
        $previous = isset($old[$id]) ? matinf_calendar_event_values($old[$id], $type) : null;
        $next = isset($new[$id]) ? matinf_calendar_event_values($new[$id], $type) : null;
        if ($previous === $next) continue;
        // Corrections to exclusively past exam dates do not notify students.
        if ($type !== 'classes' && (!$previous || $previous['date'] < $today) && (!$next || $next['date'] < $today)) continue;
        $changes[] = ['before' => $previous, 'after' => $next];
    }
    return $changes;
}

function matinf_calendar_event_text($row) {
    $days = [1 => 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak'];
    $when = $row['date'] ? implode('.', array_reverse(explode('-', $row['date']))) . '.' : ($days[$row['day']] ?? '');
    return $when . ' · ' . $row['start'] . '–' . $row['end'] . ' · ' . $row['room'] . ' · ' . $row['label'];
}

function matinf_calendar_change_draft($type, $pid, $year, $semester, $changes) {
    if (!$changes) return 0;
    $category = get_term_by('slug', 'obavjestenja', 'category');
    if (!$category) return new WP_Error('calendar_category', 'Nedostaje kategorija Obavještenja. Raspored nije sačuvan.', ['status' => 500]);
    $courses = [];
    $program = get_the_title($pid);
    $heading = ['classes' => 'Promjena rasporeda nastave', 'exams' => 'Promjena ispitnih termina', 'graduate' => 'Promjena apsolventskih termina'][$type];
    $body = '<p><strong>' . esc_html($program . ' · ' . $year . '. godina') . '</strong></p>';
    $summaries = [];
    foreach ($changes as $change) {
        $old = $change['before']; $new = $change['after'];
        foreach ([$old, $new] as $row) if ($row) $courses[] = $row['courseId'];
        $title = get_the_title(($new ?? $old)['courseId']);
        $state = !$new ? 'Otkazan termin' : (!$old ? 'Dodat termin' : 'Promijenjen termin');
        $body .= '<h3>' . esc_html($state . ': ' . $title) . '</h3>';
        if ($old) $body .= '<p><strong>Ranije:</strong> ' . esc_html(get_the_title($old['courseId']) . ' · ' . matinf_calendar_event_text($old)) . '</p>';
        $body .= $new ? '<p><strong>Novi termin:</strong> ' . esc_html(matinf_calendar_event_text($new)) . '</p>' : '<p>Prethodno objavljeni termin je otkazan.</p>';
        $summaries[] = $state . ': ' . $title . '. ' . ($new ? matinf_calendar_event_text($new) : 'Prethodni termin: ' . matinf_calendar_event_text($old));
    }
    $courses = array_values(array_unique($courses));
    $url = add_query_arg(['program_id' => $pid, 'study_year' => $year, 'semester' => $semester], home_url('/raspored/'));
    $body .= '<p><a href="' . esc_url($url) . '">Pogledajte ažurirani raspored</a></p>';
    $title = count($courses) === 1 ? 'Promjena termina: ' . get_the_title($courses[0]) : $heading . ' · ' . $program . ' · ' . $year . '. godina';
    // One publication per save; following a year already includes its course targets.
    return wp_insert_post([
        'post_type' => 'post', 'post_status' => 'draft', 'post_author' => get_current_user_id(),
        'post_title' => $title, 'post_content' => $body, 'post_excerpt' => implode(' ', $summaries),
        'post_category' => [(int) $category->term_id],
        'meta_input' => ['_matinf_everyone' => false, '_matinf_audienceYears' => [], '_matinf_audienceCourseIds' => $courses,
            '_matinf_important' => true, '_matinf_noticeKind' => 'schedule', '_matinf_send_push' => true, '_matinf_calendar_generated' => true],
    ], true);
}
