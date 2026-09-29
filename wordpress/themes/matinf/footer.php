</main>
<footer class="site-footer"><div class="wrap">
    <div class="footer-grid"><div class="footer-brand"><a class="brand" href="<?php echo esc_url(home_url('/')); ?>"><span class="brand-mark" aria-hidden="true"></span><span><strong>MATINF</strong><small>Matematika i informatika</small></span></a><p>Znanje povezuje ljude.<br>Važne informacije za vaš akademski dan, na jednom mjestu.</p></div>
    <div><h2>Studije i nastava</h2><?php foreach (['mf_program'=>'Studijski programi','mf_course'=>'Predmeti','mf_staff'=>'Nastavno osoblje','mf_document'=>'Dokumenti'] as $type=>$label) : ?><a href="<?php echo esc_url(get_post_type_archive_link($type)); ?>"><?php echo esc_html($label); ?></a><?php endforeach; ?></div>
    <div><h2>Budite u toku</h2><?php foreach (['obavjestenja'=>'Obavještenja','novosti'=>'Novosti'] as $slug=>$label) { $term=get_term_by('slug',$slug,'category'); if ($term) echo '<a href="'.esc_url(get_category_link($term)).'">'.esc_html($label).'</a>'; } foreach (['raspored'=>'Raspored nastave i ispita','studentske-price'=>'Studentske priče'] as $slug=>$label) { $page=get_page_by_path($slug); if ($page && $page->post_status==='publish') echo '<a href="'.esc_url(get_permalink($page)).'">'.esc_html($label).'</a>'; } ?></div>
    <div><h2>Povežimo se</h2><?php foreach (['kontakt'=>'Kontakt','o-aplikaciji'=>'O projektu'] as $slug=>$label) { $page=get_page_by_path($slug); if ($page && $page->post_status==='publish') echo '<a href="'.esc_url(get_permalink($page)).'">'.esc_html($label).'</a>'; } ?><a href="<?php echo esc_url(home_url('/prijava/')); ?>">Prijava za profesore</a><a href="https://matinf.pmf.unibl.org/">Zvanični sajt PMF-a ↗</a></div></div>
    <div class="footer-bottom"><p>© <?php echo esc_html(wp_date('Y')); ?> MATINF · Nezvanični studentski projekat</p><a href="#main">Nazad na vrh ↑</a></div>
</div></footer>
<?php wp_footer(); ?>
</body></html>
