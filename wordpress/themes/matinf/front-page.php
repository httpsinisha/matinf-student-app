<?php
get_header();
$program_url = get_post_type_archive_link('mf_program');
$schedule = get_page_by_path('raspored');
$schedule_url = $schedule && $schedule->post_status === 'publish' ? get_permalink($schedule) : $program_url;
$stories = get_page_by_path('studentske-price');
?>
<section class="college-hero" aria-labelledby="hero-title">
    <div class="hero-copy">
        <p class="eyebrow"><span class="small-line"></span> MATEMATIKA. INFORMATIKA. BUDUĆNOST.</p>
        <h1 id="hero-title">Znanje koje<br>otvara <em>nove<br>mogućnosti.</em></h1>
        <p class="hero-intro">Mjesto susreta ideja, ljudi i znanja. Pronađite svoj studijski put i sve važne informacije za svoj akademski dan.</p>
        <div class="actions"><a class="button" href="<?php echo esc_url($program_url); ?>">Istražite studije <span aria-hidden="true">↗</span></a><a class="button secondary" href="<?php echo esc_url($schedule_url); ?>">Pogledajte raspored <span aria-hidden="true">→</span></a></div>
        <div class="hero-levels"><span>Vaš put kroz studije</span><a href="<?php echo esc_url($program_url . '#undergraduate'); ?>">Osnovne</a><a href="<?php echo esc_url($program_url . '#master'); ?>">Master</a><a href="<?php echo esc_url($program_url . '#doctoral'); ?>">Doktorske</a></div>
    </div>
    <div class="hero-visual">
        <div class="hero-photo"><img src="<?php echo esc_url(get_template_directory_uri() . '/assets/students.jpg'); ?>" alt="Zajedničko učenje i rad na računaru" width="800" height="533" fetchpriority="high"><span class="photo-label">IDEJE RASTU KADA IH DIJELIMO.</span></div>
        <div class="hero-note"><span class="note-icon" aria-hidden="true">✦</span><div><strong>Vaša akademska zajednica</strong><span>Učimo. Povezujemo se. Napredujemo.</span></div></div>
        <span class="visual-orbit" aria-hidden="true"></span>
    </div>
</section>
<nav class="quick-access" aria-label="Brzi pristup">
<?php foreach ([['01','Obavještenja','Sve važno, na jednom mjestu.','#obavjestenja'],['02','Raspored','Isplanirajte svoj akademski dan.',$schedule_url],['03','Predmeti','Sadržaji, nastavnici i materijali.',get_post_type_archive_link('mf_course')],['04','Dokumenti','Brzo do potrebnih informacija.',get_post_type_archive_link('mf_document')]] as [$number,$title,$description,$url]) : ?>
    <a class="quick-item" href="<?php echo esc_url($url); ?>"><span class="quick-number"><?php echo esc_html($number); ?></span><div><strong><?php echo esc_html($title); ?></strong><span><?php echo esc_html($description); ?></span></div><span class="quick-arrow" aria-hidden="true">↗</span></a>
<?php endforeach; ?>
</nav>
<section class="home-section" id="obavjestenja">
    <div class="section-heading"><div><p class="eyebrow">BUDITE U TOKU</p><h2>Važno za vaš dan.</h2></div><?php $term=get_term_by('slug','obavjestenja','category'); if ($term) : ?><a class="section-link" href="<?php echo esc_url(get_category_link($term)); ?>">Sva obavještenja <span aria-hidden="true">→</span></a><?php endif; ?></div>
    <div class="announcement-list">
    <?php $notices=get_posts(['post_type'=>'post','post_status'=>'publish','has_password'=>false,'category_name'=>'obavjestenja','numberposts'=>4]);
    foreach ($notices as $notice) : $important=(bool)get_post_meta($notice->ID,'_matinf_important',true); ?>
        <article class="notice-row"><time class="date-block" datetime="<?php echo esc_attr(get_the_date('c',$notice)); ?>"><strong><?php echo esc_html(get_the_date('d',$notice)); ?></strong><span><?php echo esc_html(get_the_date('m. Y.',$notice)); ?></span></time><div class="notice-copy"><span class="tag<?php echo $important?' important':''; ?>"><?php echo $important?'Važno obavještenje':'Obavještenje'; ?></span><h3><a href="<?php echo esc_url(get_permalink($notice)); ?>"><?php echo esc_html(get_the_title($notice)); ?></a></h3></div><a class="notice-arrow" aria-label="<?php echo esc_attr('Otvori: '.get_the_title($notice)); ?>" href="<?php echo esc_url(get_permalink($notice)); ?>">↗</a></article>
    <?php endforeach; if (!$notices) : ?><p class="empty">Nova obavještenja biće prikazana ovdje.</p><?php endif; ?>
    </div>
</section>
<section class="home-section studies-section" id="studije">
    <div class="section-heading"><div><p class="eyebrow">PRONAĐITE SVOJ PUT</p><h2>Od radoznalosti<br>do novih znanja.</h2></div><p class="section-description">Matematika i informatika otvaraju prostor za istraživanje, stvaranje i prenošenje znanja. Istražite osnovne studije.</p></div>
    <div class="grid program-grid">
    <?php $programs=get_posts(['post_type'=>'mf_program','post_status'=>'publish','has_password'=>false,'numberposts'=>-1,'orderby'=>'ID','order'=>'ASC','meta_key'=>'_matinf_level','meta_value'=>'undergraduate']);
    foreach ($programs as $index=>$program) : ?>
        <article class="program-card tone-<?php echo (int)($index%3); ?>"><div class="program-art" aria-hidden="true"><span><?php echo ['∑','{ }','π'][$index%3]; ?></span><small>MATINF / STUDIJE</small></div><div class="program-copy"><span class="eyebrow">OSNOVNE STUDIJE</span><h3><a href="<?php echo esc_url(get_permalink($program)); ?>"><?php echo esc_html(get_the_title($program)); ?></a></h3><p><?php echo (int)get_post_meta($program->ID,'_matinf_durationYears',true); ?> godine <span>·</span> <?php echo (int)get_post_meta($program->ID,'_matinf_ects',true); ?> ECTS</p><a class="read-more" href="<?php echo esc_url(get_permalink($program)); ?>">Upoznajte program <span aria-hidden="true">→</span></a></div></article>
    <?php endforeach; if (!$programs) : ?><p class="empty">Studijski programi uskoro će biti dostupni.</p><?php endif; ?>
    </div>
    <div class="next-level"><p>Vaše obrazovanje se nastavlja.</p><a href="<?php echo esc_url($program_url . '#master'); ?>">Master studije ↗</a><a href="<?php echo esc_url($program_url . '#doctoral'); ?>">Doktorske studije ↗</a></div>
</section>
<section class="home-section" id="novosti">
    <div class="section-heading"><div><p class="eyebrow">IZ NAŠE ZAJEDNICE</p><h2>Novosti i dešavanja.</h2></div><?php $term=get_term_by('slug','novosti','category'); if ($term) : ?><a class="section-link" href="<?php echo esc_url(get_category_link($term)); ?>">Sve novosti <span aria-hidden="true">→</span></a><?php endif; ?></div>
    <div class="grid news-grid"><?php $news=get_posts(['post_type'=>'post','post_status'=>'publish','has_password'=>false,'category_name'=>'novosti','numberposts'=>3]); foreach ($news as $news_item) matinf_theme_card($news_item); ?></div>
    <?php if (!$news) : ?><p class="empty">Pratite nove priče i dešavanja iz naše zajednice.</p><?php endif; ?>
</section>
<?php if ($stories && $stories->post_status==='publish') : ?>
<section class="stories-band"><div class="story-symbol" aria-hidden="true">“<span>SVAKI PUT POČINJE<br>RADOZNALOŠĆU.</span></div><div><p class="eyebrow">LJUDI KOJI INSPIRIŠU</p><h2>Znanje dobija smisao<br>kroz vaše priče.</h2><p>Od prvih projekata do novih profesionalnih izazova. Upoznajte studentska iskustva i savjete za generacije koje dolaze.</p><a class="button" href="<?php echo esc_url(get_permalink($stories)); ?>">Upoznajte njihove priče <span aria-hidden="true">↗</span></a></div></section>
<?php endif; ?>
<section class="home-section community-section"><div><p class="eyebrow">TU SMO ZA VAŠA PITANJA</p><h2>Upoznajte ljude<br>iza znanja.</h2><p>Pronađite nastavnike i saradnike, njihove predmete i kontakt informacije. Povežite se sa svojom akademskom zajednicom.</p><a class="button secondary" href="<?php echo esc_url(get_post_type_archive_link('mf_staff')); ?>">Nastavno osoblje <span aria-hidden="true">→</span></a></div><div class="community-links"><?php foreach (['Rukovodioci'=>'Organizacija i razvoj studija','Nastavnici'=>'Znanje, iskustvo i podrška','Saradnici'=>'Zajedno kroz učenje i vježbe'] as $name=>$description) : ?><a href="<?php echo esc_url(get_post_type_archive_link('mf_staff') . '#' . sanitize_title($name)); ?>"><div><strong><?php echo esc_html($name); ?></strong><span><?php echo esc_html($description); ?></span></div><span aria-hidden="true">↗</span></a><?php endforeach; ?></div></section>
<?php get_footer(); ?>
