<?php
defined('ABSPATH') || exit;

function matinf_calendar_room_key($room) {
    // Preserve building/room identifiers; ignore case and repeated whitespace.
    return strtolower(remove_accents(trim(preg_replace('/\s+/u', ' ', (string) $room))));
}

function matinf_calendar_resource_conflict($type, $pid, $year, $semester, $rows) {
    if (!$rows) return null;
    $edited_key = matinf_calendar_key($type, $pid, $year, $semester);
    $programs = get_posts(['post_type' => 'mf_program', 'post_status' => 'publish', 'has_password' => false, 'numberposts' => -1, 'orderby' => 'ID', 'order' => 'ASC']);
    foreach ($programs as $program) {
        $duration = (int) get_post_meta($program->ID, '_matinf_durationYears', true);
        for ($other_year = 1; $other_year <= $duration; $other_year++) {
            $types = $type === 'classes' ? ['classes'] : ($other_year === 4 ? ['exams', 'graduate'] : ['exams']);
            foreach ($types as $other_type) {
                // Weekly classes have no date bounds. Compare within the same
                // semester; regular and graduate exams share one date pool.
                if (matinf_calendar_key($other_type, $program->ID, $other_year, $semester) === $edited_key) continue;
                $others = $other_type === 'classes'
                    ? matinf_calendar_classes($program->ID, $other_year, $semester)
                    : matinf_exam_rows($program->ID, $other_year, $other_type === 'graduate');
                foreach ($others as $other) {
                    if (!matinf_is_public($other['courseId'], 'mf_course')) continue;
                    $other_end = $other['end'] ?? date('H:i', strtotime($other['start'] . ' +2 hours'));
                    $other_staff = (int) ($other['staffId'] ?? ($other['staff']['id'] ?? 0));
                    $other_room = matinf_calendar_room_key($other['room'] ?? '');
                    foreach ($rows as $index => $row) {
                        $same_day = $type === 'classes' ? (int) $row['day'] === (int) $other['day'] : $row['date'] === $other['date'];
                        if (!$same_day || $row['start'] >= $other_end || $row['end'] <= $other['start']) continue;
                        $resources = [];
                        if ($other_room !== '' && matinf_calendar_room_key($row['room']) === $other_room) $resources[] = 'učionica „' . $other['room'] . '“';
                        if ($other_staff && (int) $row['staffId'] === $other_staff) $resources[] = 'nastavnik „' . get_the_title($other_staff) . '“';
                        if (!$resources) continue;
                        $days = [1 => 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak'];
                        $when = $type === 'classes' ? ($days[(int) $other['day']] . ', ' . ($semester === 1 ? 'zimski' : 'ljetni') . ' semestar') : date('d.m.Y.', strtotime($other['date']));
                        $labels = ['classes' => 'nastava', 'exams' => 'ispiti', 'graduate' => 'apsolventski rokovi'];
                        return new WP_Error('resource_conflict', sprintf(
                            'Raspored nije sačuvan. Termin %d (%s): %s već ima termin za predmet „%s“ — %s, %d. godina, %s, %s, %s–%s. Promijenite vrijeme, učionicu ili nastavnika.',
                            $index + 1, get_the_title($row['courseId']), implode(' i ', $resources), get_the_title($other['courseId']), $program->post_title, $other_year, $labels[$other_type], $when, $other['start'], $other_end
                        ), ['status' => 409]);
                    }
                }
            }
        }
    }
    return null;
}
