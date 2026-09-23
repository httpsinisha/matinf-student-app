</main>
<footer class="site-footer"><div class="wrap footer-inner">
    <div class="brand"><span class="brand-mark" aria-hidden="true"></span><span><strong>MATINF</strong><small>Znanje danas. Bolje društvo sutra.</small></span></div>
    <p>Nezvanična demo aplikacija i sajt.<br>Za zvanične informacije: <a href="https://matinf.pmf.unibl.org/">PMF · Matematika i informatika</a></p>
    <?php $about = get_page_by_path('o-aplikaciji'); if ($about) : ?><a href="<?php echo esc_url(get_permalink($about)); ?>">O projektu</a><?php endif; ?>
</div></footer>
<?php wp_footer(); ?>
</body></html>
