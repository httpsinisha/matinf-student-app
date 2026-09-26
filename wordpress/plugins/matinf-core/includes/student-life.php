<?php
defined('ABSPATH') || exit;

function matinf_staff_group($id) {
    $key = get_post_meta($id, '_matinf_sourceKey', true);
    if (in_array($key, ['staff-0', 'staff-1', 'staff-2'], true)) return 'Rukovodioci';
    return preg_match('/saradnik|asistent/iu', get_post_meta($id, '_matinf_academicTitle', true)) ? 'Saradnici' : 'Nastavnici';
}

function matinf_enrich_student_life() {
    $staff = get_posts(['post_type' => 'mf_staff', 'numberposts' => -1, 'post_status' => 'publish']);
    foreach ($staff as $person) {
        if (!get_post_meta($person->ID, '_matinf_email', true)) {
            $name = sanitize_title(remove_accents($person->post_title));
            update_post_meta($person->ID, '_matinf_email', str_replace('-', '.', $name) . '@example.org');
        }
    }
    $stories = [
        ['Ana Jovanović', 'Od prvog programa do razvoja aplikacija', 'Informatika', 'Na prvoj godini Ana je kroz zadatke iz programiranja naučila da veliki problem rastavi na male korake. Sa kolegama je zatim napravila aplikaciju za razmjenu bilježaka i raspoređivanje studentskih obaveza. Najviše joj je značilo zajedničko čitanje koda i razgovor o greškama.', 'Danas razvija mobilne aplikacije i novim studentima preporučuje da svoje projekte redovno dokumentuju. „Ne čekajte savršenu ideju. Napravite nešto malo što nekome olakšava dan.“'],
        ['Luka Kostić', 'Matematika koja otkriva obrasce u podacima', 'Opšti smjer matematike', 'Luka je interesovanje za vjerovatnoću povezao sa programiranjem. Za studentski projekat analizirao je potrošnju energije u izmišljenom skupu podataka, upoređivao modele i učio kako da rezultate objasni ljudima bez matematičkog predznanja.', 'Nastavio je školovanje u oblasti primijenjene matematike. „Dobar rezultat vrijedi više kada umijete jasno objasniti kako ste do njega došli.“ Njegov savjet je da se teorija redovno provjerava na konkretnim zadacima.'],
        ['Milica Đurić', 'Učionica u kojoj je dozvoljeno pogriješiti', 'Nastavni smjer matematike i informatike', 'Tokom nastavne prakse Milica je osmislila kratke interaktivne zadatke koji povezuju geometriju i programiranje. Učenici su radili u parovima, upoređivali različita rješenja i zajednički tražili greške.', 'Svoj profesionalni put usmjerila je ka nastavi i izradi digitalnih materijala. „Najljepši trenutak je kada učenik sam objasni ideju koju je do juče smatrao teškom.“ Budućim nastavnicima preporučuje strpljenje i razmjenu iskustava.'],
    ];
    $body = '<p>Upoznajte različite puteve nakon studija matematike i informatike: razvoj softvera, istraživanje i obrazovanje.</p>';
    foreach ($stories as [$name, $title, $program, $journey, $advice]) $body .= '<h2>' . esc_html($name) . '</h2><h3>' . esc_html($title) . '</h3><p><strong>' . esc_html($program) . '</strong></p><p>' . esc_html($journey) . '</p><p>' . esc_html($advice) . '</p>';
    if (!get_page_by_path('studentske-price')) wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_name' => 'studentske-price', 'post_title' => 'Uspješni studenti i njihove priče', 'post_content' => $body]);
    return count($staff);
}

add_action('admin_menu', function () {
    add_management_page('MATINF studentski sadržaj', 'MATINF studentski sadržaj', 'manage_options', 'matinf-student-life', function () {
        echo '<div class="wrap"><h1>Kontakti i studentske priče</h1><p>Dopunite prazne kontakte osoblja i napravite stranicu sa tri studentske priče. Postojeći mejlovi i već napravljena stranica se ne mijenjaju. Adrese na example.org služe za prezentaciju i ne primaju poštu; zamijenite ih stvarnim kontaktima u profilima osoblja.</p><form method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="matinf_student_life">';
        wp_nonce_field('matinf_student_life'); submit_button('Dopuni kontakte i studentske priče');
        echo '</form><p>Priče uređujete kroz Stranice → Uspješni studenti i njihove priče.</p></div>';
    });
});
add_action('admin_post_matinf_student_life', function () {
    if (!current_user_can('manage_options')) wp_die('Pristup nije dozvoljen.', '', ['response' => 403]);
    check_admin_referer('matinf_student_life'); matinf_enrich_student_life();
    wp_safe_redirect(admin_url('tools.php?page=matinf-student-life')); exit;
});

function matinf_generated_exam_rows($pid, $year, $graduate = false) {
    $args = ['post_type' => 'mf_course', 'post_status' => 'publish', 'has_password' => false, 'numberposts' => -1, 'orderby' => 'title', 'order' => 'ASC', 'meta_query' => [['key' => '_matinf_programId', 'value' => $pid, 'type' => 'NUMERIC']]];
    $courses = get_posts($args); $rows = [];
    if ($graduate) $courses = array_slice(array_values(array_filter($courses, fn($course) => (int) get_post_meta($course->ID, '_matinf_year', true) === 4 && !preg_match('/rad$|praksa$/iu', $course->post_title))), 0, 3);
    $periods = $graduate ? ['Oktobarski apsolventski' => '2026-10-05', 'Novembarski apsolventski' => '2026-11-02'] : ['Januarsko-februarski' => '2027-01-18', 'Junsko-julski' => '2027-06-07', 'Septembarski' => '2027-09-01'];
    foreach ($periods as $period => $date) foreach ($courses as $index => $course) {
        if (!$graduate && (int) get_post_meta($course->ID, '_matinf_year', true) !== $year) continue;
        if (preg_match('/rad$|praksa$/iu', $course->post_title)) continue;
        // Three sittings per weekday, unique within this program's calendar.
        $day = new DateTimeImmutable($date, new DateTimeZone('Europe/Sarajevo'));
        $day = $day->modify('+' . intdiv($index, 3) . ' weekdays');
        $teachers = matinf_related($course->ID, 'staffIds', 'mf_staff');
        $rows[] = ['course' => matinf_summary($course->ID), 'courseId' => $course->ID, 'year' => (int) get_post_meta($course->ID, '_matinf_year', true), 'period' => $period, 'date' => $day->format('Y-m-d'), 'start' => sprintf('%02d:00', 9 + ($index % 3) * 3), 'room' => 'Učionica ' . (101 + ($pid % 20)), 'staff' => $teachers[0] ?? null];
    }
    return $rows;
}

function matinf_exam_table($title, $rows) {
    echo '<h2>' . esc_html($title) . '</h2><div class="table-scroll"><table class="schedule-table"><thead><tr><th scope="col">Rok</th><th scope="col">Predmet</th><th scope="col">Godina</th><th scope="col">Datum / vrijeme</th><th scope="col">Učionica</th></tr></thead><tbody>';
    foreach ($rows as $row) echo '<tr><td>' . esc_html($row['period']) . '</td><td><a href="' . esc_url($row['course']['url']) . '">' . esc_html($row['course']['title']) . '</a></td><td>' . (int) $row['year'] . '.</td><td>' . esc_html(implode('.', array_reverse(explode('-', $row['date']))) . '. · ' . $row['start']) . '</td><td>' . esc_html($row['room']) . '</td></tr>';
    if (!$rows) echo '<tr><td colspan="5">Nema objavljenih predmeta za ovaj izbor.</td></tr>';
    echo '</tbody></table></div>';
}
