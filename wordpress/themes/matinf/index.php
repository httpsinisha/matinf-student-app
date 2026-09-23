<?php get_header(); ?>
<header class="page-heading"><div class="breadcrumbs"><a href="<?php echo esc_url(home_url('/')); ?>">Početna</a> / Informacije</div><h1><?php echo esc_html(is_category() ? single_cat_title('', false) : (is_post_type_archive() ? post_type_archive_title('', false) : 'Novosti')); ?></h1></header>
<?php if (have_posts()) : ?><div class="grid"><?php while (have_posts()) : the_post(); matinf_theme_card(get_post()); endwhile; ?></div><nav class="pagination" aria-label="Stranice rezultata"><?php echo paginate_links(['prev_text' => '← Prethodna', 'next_text' => 'Sljedeća →']); ?></nav>
<?php else : ?><p class="empty">Trenutno nema sadržaja u ovoj sekciji.</p><?php endif; ?>
<?php get_footer(); ?>
