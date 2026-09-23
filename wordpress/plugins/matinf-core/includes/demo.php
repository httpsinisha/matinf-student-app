<?php
defined('ABSPATH') || exit;

function matinf_demo_post($slug, $type, $title, $body, $fields = [], $category = null) {
    $existing = get_page_by_path($slug, OBJECT, $type);
    if ($existing) return $existing->ID; // Seed is additive, never overwrites edits.
    $data = ['post_type' => $type, 'post_status' => 'publish', 'post_name' => $slug, 'post_title' => $title, 'post_content' => $body];
    if ($category) {
        $term = get_term_by('slug', $category, 'category');
        if ($term) $data['post_category'] = [$term->term_id];
    }
    $id = wp_insert_post($data, true);
    if (is_wp_error($id)) throw new RuntimeException($id->get_error_message());
    if ($fields) {
        $valid = matinf_validate_fields($type, $fields);
        if (is_wp_error($valid)) throw new RuntimeException($valid->get_error_message());
        matinf_store_fields($id, $valid);
    }
    return $id;
}

function matinf_demo_pdf() {
    $uploads = wp_upload_dir();
    $path = $uploads['basedir'] . '/matinf-demo-plan.pdf';
    $existing = get_posts(['post_type' => 'attachment', 'post_status' => 'inherit', 'meta_key' => '_matinf_demo_file', 'meta_value' => 'curriculum', 'numberposts' => 1]);
    if ($existing && file_exists($path)) return wp_get_attachment_url($existing[0]->ID);
    $stream = "BT /F1 22 Tf 60 760 Td (MATINF - demo study plan) Tj 0 -40 Td /F1 12 Tf (Fictional academic demonstration. Not an official curriculum.) Tj 0 -24 Td (Sample subjects: Introduction to Programming, Linear Algebra.) Tj ET";
    $objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        '<< /Length ' . strlen($stream) . ">>\nstream\n" . $stream . "\nendstream",
    ];
    $pdf = "%PDF-1.4\n";
    $offsets = [0];
    foreach ($objects as $i => $object) { $offsets[] = strlen($pdf); $pdf .= ($i + 1) . " 0 obj\n" . $object . "\nendobj\n"; }
    $xref = strlen($pdf);
    $pdf .= "xref\n0 6\n0000000000 65535 f \n";
    foreach (array_slice($offsets, 1) as $offset) $pdf .= sprintf("%010d 00000 n \n", $offset);
    $pdf .= "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" . $xref . "\n%%EOF\n";
    wp_mkdir_p($uploads['basedir']);
    if (file_put_contents($path, $pdf) === false) throw new RuntimeException('Demo dokument nije sačuvan.');
    $id = wp_insert_attachment(['post_title' => 'MATINF — primjer nastavnog plana', 'post_mime_type' => 'application/pdf', 'post_status' => 'inherit'], $path);
    update_post_meta($id, '_matinf_demo_file', 'curriculum');
    return wp_get_attachment_url($id);
}

function matinf_seed_demo() {
    $demo = '<p><strong>Nezvanični demo sadržaj.</strong> Ovaj primjer služi za demonstraciju aplikacije i nije zvanična akademska informacija.</p>';
    $source = '<p>Organizacija studija prati dogovoreni plan projekta. Za zvanične informacije posjetite <a href="https://matinf.pmf.unibl.org/">Matematiku i informatiku PMF-a Univerziteta u Banjoj Luci</a>.</p>';
    $doc = matinf_demo_post('primjer-nastavnog-plana', 'mf_document', 'Primjer nastavnog plana (PDF)', $demo . '<p>Primjer dokumenta za provjeru preuzimanja i otvaranja PDF datoteke.</p>', ['fileUrl' => matinf_demo_pdf(), 'mimeType' => 'application/pdf']);
    $staff = [];
    foreach ([['mila-demo', 'Mila Primjer', 'Vanredni profesor'], ['nikola-demo', 'Nikola Uzorak', 'Docent'], ['ana-demo', 'Ana Primjer', 'Asistent'], ['marko-demo', 'Marko Primjer', 'Redovni profesor'], ['jelena-demo', 'Jelena Uzorak', 'Docent'], ['petar-demo', 'Petar Primjer', 'Viši asistent']] as [$slug, $name, $title]) {
        $staff[] = matinf_demo_post($slug, 'mf_staff', $name, $demo . '<p>Izmišljeni profil nastavnika. Oblasti interesovanja: matematika, informatika i razvoj nastavnih materijala.</p>', ['academicTitle' => $title, 'email' => $slug . '@example.org']);
    }
    $programs = [
        ['matematika-informatika', 'Diplomirani matematičar i informatičar', 'undergraduate', 240, ['Matematička analiza 1', 'Uvod u programiranje']],
        ['informatika', 'Diplomirani informatičar', 'undergraduate', 240, ['Uvod u programiranje', 'Diskretna matematika']],
        ['profesor-matematike-informatike', 'Diplomirani profesor matematike i informatike', 'undergraduate', 240, ['Matematička analiza 1', 'Uvod u pedagogiju']],
        ['matematicka-analiza', 'Matematička analiza i primjene', 'master', 60, ['Funkcionalna analiza', 'Primijenjena matematika']],
        ['algebra-geometrija', 'Algebra i geometrija', 'master', 60, ['Apstraktna algebra', 'Diferencijalna geometrija']],
        ['doktorske-studije', 'Doktor matematičkih nauka', 'doctoral', 180, ['Istraživački seminar', 'Metodologija naučnog rada']],
    ];
    $course_ids = [];
    foreach ($programs as $index => [$slug, $name, $level, $ects, $subjects]) {
        $id = matinf_demo_post($slug, 'mf_program', $name, $demo . '<h2>O programu</h2><p>Predstavljamo organizaciju studija i primjere nastavnih predmeta. Nastavni plan i sadržaj predmeta u ovoj demonstraciji su ilustrativni.</p>' . $source, ['level' => $level, 'ects' => $ects, 'documentIds' => [$doc]]);
        foreach ($subjects as $i => $subject) {
            $course_ids[] = matinf_demo_post($slug . '-predmet-' . ($i + 1), 'mf_course', $subject, $demo . '<h2>O predmetu</h2><p>Upoznavanje sa osnovnim pojmovima i praktičnim primjerima.</p><h3>Način rada</h3><ul><li>Predavanja i vježbe</li><li>Samostalni zadaci</li><li>Konsultacije sa nastavnikom</li></ul>', ['programId' => $id, 'year' => 1, 'semester' => $i + 1, 'staffIds' => [$staff[$index % count($staff)]], 'documentIds' => [$doc]]);
        }
        $duration = $level === 'undergraduate' ? 4 : ($level === 'doctoral' ? 3 : 1);
        $advanced = [2 => ['Linearna algebra', 'Algoritmi i strukture podataka'], 3 => ['Baze podataka', 'Numeričke metode'], 4 => ['Softversko inženjerstvo', 'Završni projekat']];
        for ($year = 2; $year <= $duration; $year++) {
            foreach ($advanced[$year] as $semester => $subject) {
                if ($level === 'doctoral') $subject = $semester === 0 ? 'Istraživački rad ' . $year : 'Doktorski seminar ' . $year;
                $course_ids[] = matinf_demo_post($slug . '-godina-' . $year . '-predmet-' . ($semester + 1), 'mf_course', $subject,
                    $demo . '<h2>Cilj predmeta</h2><p>Razvijanje razumijevanja ključnih pojmova i njihove primjene kroz vođene primjere, individualni rad i diskusiju.</p><h3>Ishodi učenja</h3><ul><li>Objasniti osnovne teorijske koncepte.</li><li>Primijeniti odgovarajuće metode pri rješavanju zadataka.</li><li>Predstaviti rezultate samostalnog projekta.</li></ul><h3>Organizacija nastave</h3><p>Predavanja, praktične vježbe i konsultacije. Prikazani plan služi isključivo demonstraciji.</p><h3>Materijali i provjera znanja</h3><p>Nastavni materijali nalaze se u odjeljku Dokumenti. Primjer ocjenjivanja: kontinuirani zadaci, projektni rad i završni razgovor.</p>',
                    ['programId' => $id, 'year' => $year, 'semester' => $semester + 1, 'staffIds' => [$staff[$index % count($staff)]], 'documentIds' => [$doc]]);
            }
        }
    }
    matinf_demo_post('promjena-termina-predavanja', 'post', 'Promjena termina predavanja', $demo . '<p>Predavanje iz uvoda u programiranje u ovom primjeru pomjereno je na četvrtak.</p><h2>Novi termin</h2><ul><li>Četvrtak, 14:00–16:00</li><li>Sala 21</li></ul><p>Molimo studente da na vrijeme planiraju svoje obaveze.</p>', ['important' => true, 'documentIds' => [$doc]], 'obavjestenja');
    matinf_demo_post('ispitni-rokovi', 'post', 'Obavještenje o ispitnim rokovima', $demo . '<p>Raspored ispitnih rokova predstavlja primjer studentskog obavještenja. Za važeće termine provjerite zvanični sajt.</p>', ['important' => true], 'obavjestenja');
    matinf_demo_post('konsultacije', 'post', 'Termini konsultacija za studente', $demo . '<p>Nastavnici su dostupni za pitanja o gradivu i praktičnim zadacima. Ovo je izmišljena objava za provjeru prikaza.</p>', ['important' => false], 'obavjestenja');
    matinf_demo_post('racunarski-laboratorij', 'post', 'Otvoren novi računarski laboratorij', $demo . '<p>Primjer novosti o prostoru za studentske projekte, vježbe i timski rad.</p><p>Ova objava demonstrira prikaz novosti u aplikaciji i na sajtu.</p>', [], 'novosti');
    matinf_demo_post('studentska-radionica', 'post', 'Studentska radionica programiranja', $demo . '<p>U ovoj demonstraciji studenti zajedno rješavaju zadatke i razmjenjuju iskustva o programiranju.</p>', [], 'novosti');
    $first_program = (int) get_post_meta($course_ids[0], '_matinf_programId', true);
    matinf_demo_post('materijali-analiza-prva-godina', 'post', 'Novi materijali za Matematičku analizu 1', $demo . '<h2>Materijali za naredne vježbe</h2><p>Pripremite zadatke o nizovima i graničnim vrijednostima. Na početku vježbi razgovaraćemo o postupku rješavanja i najčešćim greškama.</p><ul><li>Pročitajte uvodne bilješke.</li><li>Samostalno pokušajte riješiti zadatke.</li><li>Pripremite pitanja za konsultacije.</li></ul><p>Ovaj primjer je namijenjen pratiocima predmeta i njegove godine studija.</p>', ['audienceCourseIds' => [$course_ids[0]], 'documentIds' => [$doc], 'important' => false], 'obavjestenja');
    matinf_demo_post('sastanak-druga-godina', 'post', 'Informativni sastanak za drugu godinu', $demo . '<p>Primjer obavještenja za drugu godinu studijskog programa matematike i informatike.</p><h2>Teme sastanka</h2><ul><li>Organizacija semestra</li><li>Izbor projekata</li><li>Konsultacije i nastavna podrška</li></ul>', ['audienceYears' => [$first_program . ':2'], 'important' => true], 'obavjestenja');
    matinf_demo_post('projekti-studentske-zajednice', 'post', 'Predstavite svoj studentski projekat', $demo . '<h2>Od ideje do rješenja</h2><p>Akademska zajednica povezuje studente zainteresovane za matematiku i informatiku. Ova ilustrativna objava predstavlja način dijeljenja ideja i rezultata.</p><h3>Kako pripremiti predstavljanje</h3><ol><li>Opišite problem koji rješavate.</li><li>Predstavite korišćene metode.</li><li>Prikažite rezultate i naredne korake.</li></ol>', [], 'novosti');
    matinf_demo_post('kontakt', 'page', 'Kontakt', $demo . '<p>Kontakt podaci za demonstraciju: <a href="mailto:matinf-demo@example.org">matinf-demo@example.org</a>.</p><p>Ova adresa služi kao primjer i nije stvarni kontakt fakulteta.</p>' . $source);
    matinf_demo_post('o-aplikaciji', 'page', 'O aplikaciji', '<p>MATINF je nezvanična akademska demonstracija WordPress sajta i Android aplikacije.</p><p>Matematika. Informatika. Budućnost.</p><p>Javni sadržaj možete čitati bez naloga. Ako uključite obavještenja, aplikacija će sačuvati izbor programa i predmeta za ovaj uređaj. Praćenje možete isključiti u podešavanjima.</p>' . $source);
    return ['programs' => 6, 'courses' => count($course_ids), 'staff' => count($staff)];
}
