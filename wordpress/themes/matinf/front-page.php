<?php get_header(); ?>
<section class="hero">
    <div><div class="eyebrow">Matematika · Informatika · Budućnost</div><h1>Znanje<br>povezuje ljude.</h1><p>Obavještenja, studije, predmeti i ljudi. Važne informacije za vaš akademski dan, na jednom mjestu.</p><div class="actions"><a class="button" href="#obavjestenja">Najnovija obavještenja</a><a class="button secondary" href="<?php echo esc_url(get_post_type_archive_link('mf_program')); ?>">Istražite studije</a></div></div>
    <aside class="hero-card"><span class="tag">Dobro došli na MATINF</span><h2 style="margin-top:20px">Vaš sljedeći korak<br>počinje ovdje.</h2><p>Pronađite svoj program, upoznajte predmete i ostanite u toku sa novostima.</p><div class="stat"><b>3</b><span>nivoa studija<br>Osnovne · Master · Doktorske studije</span></div><div class="stat"><b>01</b><span>mjesto za važne informacije<br>Na sajtu i u Android aplikaciji</span></div></aside>
</section>
<?php foreach (['obavjestenja' => 'Najnovija obavještenja', 'novosti' => 'Novosti'] as $slug => $title) :
    $term = get_term_by('slug', $slug, 'category');
    $items = get_posts(['post_type' => 'post', 'post_status' => 'publish', 'has_password' => false, 'category_name' => $slug, 'numberposts' => 3]); ?>
    <section class="section" id="<?php echo esc_attr($slug); ?>"><div class="section-heading"><h2><?php echo esc_html($title); ?></h2><?php if ($term) : ?><a href="<?php echo esc_url(get_category_link($term)); ?>">Pogledaj sve →</a><?php endif; ?></div>
        <div class="grid"><?php foreach ($items as $item) matinf_theme_card($item); ?></div><?php if (!$items) : ?><p class="empty">Trenutno nema objava.</p><?php endif; ?>
    </section>
<?php endforeach; ?>
<section class="section"><div class="section-heading"><h2>Pronađite svoj put</h2><a href="<?php echo esc_url(get_post_type_archive_link('mf_program')); ?>">Svi programi →</a></div><div class="grid">
<?php foreach (get_posts(['post_type' => 'mf_program', 'post_status' => 'publish', 'has_password' => false, 'numberposts' => 6, 'orderby' => 'ID', 'order' => 'ASC']) as $item) matinf_theme_card($item); ?>
</div></section>
<?php $stories = get_page_by_path('studentske-price'); if ($stories && $stories->post_status === 'publish') : ?>
<section class="section"><div class="section-heading"><h2>Uspješni studenti</h2><a href="<?php echo esc_url(get_permalink($stories)); ?>">Pročitaj njihove priče →</a></div><div class="card"><h3>Tri puta, zajednička osnova</h3><p>Razvoj aplikacija, primijenjena matematika i nastava. Upoznajte iskustva studenata, njihove prve projekte i savjete za naredne generacije.</p><a class="button" href="<?php echo esc_url(get_permalink($stories)); ?>">Studentske priče</a></div></section>
<?php endif; get_footer(); ?>
