<?php get_header(); while (have_posts()) : the_post();
    $post = get_post();
    $type = function_exists('matinf_collection_for_post') ? matinf_collection_for_post($post) : 'pages';
    $item = function_exists('matinf_content_item') ? matinf_content_item($post, $type, true) : null;
    $relations = $item ? (array) $item['relations'] : [];
    $meta = $item ? (array) $item['meta'] : [];
?>
<header class="page-heading"><div class="breadcrumbs"><a href="<?php echo esc_url(home_url('/')); ?>">Početna</a> / <?php echo esc_html(get_the_title()); ?></div><h1><?php the_title(); ?></h1><?php if ($post->post_type === 'post') : ?><time class="date" datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('d. m. Y.')); ?></time><?php endif; ?></header>
<div class="detail"><article class="article">
    <?php if (has_post_thumbnail()) the_post_thumbnail('large'); ?>
    <?php if (post_password_required()) echo get_the_password_form(); elseif ($post->post_type === 'page' && $post->post_name === 'raspored') echo do_shortcode('[matinf_schedule]'); else echo $item ? $item['bodyHtml'] : wp_kses_post(apply_filters('the_content', $post->post_content)); ?>
    <?php if (!post_password_required() && !empty($meta['attachments'])) : ?><section class="card"><h2>Dokumenti uz objavu</h2><ul><?php foreach ($meta['attachments'] as $file) : ?><li><a href="<?php echo esc_url($file['url']); ?>"><?php echo esc_html($file['title']); ?> ↗</a></li><?php endforeach; ?></ul></section><?php endif; ?>
    <?php if ($type === 'documents' && !empty($meta['fileUrl'])) : ?><a class="button" href="<?php echo esc_url($meta['fileUrl']); ?>">Otvori dokument ↗</a><?php endif; ?>
    <?php if ($type === 'staff' && !empty($meta['email'])) : ?><a class="button" href="mailto:<?php echo esc_attr($meta['email']); ?>">Pošalji email</a><?php endif; ?>
    <?php if ($type === 'programs') : ?>
        <h2>Godine studija i predmeti</h2>
        <?php for ($year = 1; $year <= ($meta['durationYears'] ?? 0); $year++) :
            $courses = get_posts(['post_type' => 'mf_course', 'post_status' => 'publish', 'has_password' => false, 'numberposts' => 50, 'meta_query' => [['key' => '_matinf_programId', 'value' => $post->ID, 'type' => 'NUMERIC'], ['key' => '_matinf_year', 'value' => $year, 'type' => 'NUMERIC']], 'orderby' => 'title', 'order' => 'ASC']); ?>
            <section class="year-group"><h3><?php echo (int) $year; ?>. godina</h3><ul class="related"><?php foreach ($courses as $course) : ?><li><a href="<?php echo esc_url(get_permalink($course)); ?>"><?php echo esc_html($course->post_title); ?></a> · <?php echo (int) get_post_meta($course->ID, '_matinf_semester', true); ?>. semestar</li><?php endforeach; ?></ul><?php if (!$courses) : ?><p class="notice">Predmeti za ovu godinu još nisu objavljeni.</p><?php endif; ?></section>
        <?php endfor; ?>
    <?php endif; ?>
</article><aside class="sidebar">
    <?php if ($type === 'programs') : ?><section class="card"><h3>O studijama</h3><p><?php echo (int) ($meta['durationYears'] ?? 0); ?> god. · <?php echo (int) ($meta['ects'] ?? 0); ?> ECTS</p><span class="tag">Nezvanični prikaz kataloga</span></section><?php endif; ?>
    <?php if ($type === 'courses') : ?><section class="card"><h3>O predmetu</h3><p><?php echo (int) ($meta['year'] ?? 0); ?>. godina · <?php echo (int) ($meta['semester'] ?? 0); ?>. semestar</p><?php if (!empty($relations['program'])) : ?><a href="<?php echo esc_url($relations['program']['url']); ?>"><?php echo esc_html($relations['program']['title']); ?></a><?php endif; ?></section><?php endif; ?>
    <?php if ($type === 'staff') : ?><section class="card"><h3><?php echo esc_html($meta['academicTitle'] ?? 'Nastavno osoblje'); ?></h3><p>Izmišljeni demo profil</p></section><?php endif; ?>
    <?php matinf_theme_related('Nastavno osoblje', $relations['staff'] ?? []); matinf_theme_related('Dokumenti', $relations['documents'] ?? []); if ($type === 'staff') matinf_theme_related('Predmeti', $relations['courses'] ?? []); ?>
    <section class="card"><h3>Važne informacije</h3><p>Javni sadržaj dostupan je bez registracije.</p><a href="<?php echo esc_url(home_url('/')); ?>">Nazad na početnu →</a></section>
</aside></div>
<?php endwhile; get_footer(); ?>
