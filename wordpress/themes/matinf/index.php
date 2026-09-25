<?php get_header(); ?>
<header class="page-heading"><div class="breadcrumbs"><a href="<?php echo esc_url(home_url('/')); ?>">Početna</a> / Informacije</div><h1><?php echo esc_html(is_category() ? single_cat_title('', false) : (is_post_type_archive() ? post_type_archive_title('', false) : 'Novosti')); ?></h1></header>
<?php if (is_post_type_archive('mf_staff') && function_exists('matinf_staff_group')) :
$people = get_posts(['post_type' => 'mf_staff', 'post_status' => 'publish', 'has_password' => false, 'numberposts' => -1, 'orderby' => 'title', 'order' => 'ASC']);
foreach (['Rukovodioci', 'Nastavnici', 'Saradnici'] as $group) : ?>
<section class="staff-group"><h2><?php echo esc_html($group); ?></h2><div class="grid"><?php foreach ($people as $person) if (matinf_staff_group($person->ID) === $group) matinf_theme_card($person); ?></div></section>
<?php endforeach; else : ?>
<?php if (have_posts()) : ?><div class="grid"><?php while (have_posts()) : the_post(); matinf_theme_card(get_post()); endwhile; ?></div><nav class="pagination" aria-label="Stranice rezultata"><?php echo paginate_links(['prev_text' => '← Prethodna', 'next_text' => 'Sljedeća →']); ?></nav>
<?php else : ?><p class="empty">Trenutno nema sadržaja u ovoj sekciji.</p><?php endif; ?>
<?php endif; get_footer(); ?>
