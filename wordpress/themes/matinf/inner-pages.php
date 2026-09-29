<?php
defined('ABSPATH') || exit;

function matinf_theme_int($key, $default = 0) { return isset($_GET[$key]) && is_scalar($_GET[$key]) ? absint($_GET[$key]) : $default; }
function matinf_theme_heading($title, $description = '', $eyebrow = 'MATINF') {
    echo '<header class="inner-heading"><div class="breadcrumbs"><a href="'.esc_url(home_url('/')).'">Početna</a><span>/</span>'.esc_html($title).'</div><p class="eyebrow">'.esc_html($eyebrow).'</p><h1>'.esc_html($title).'</h1>';
    if ($description) echo '<p class="inner-description">'.esc_html($description).'</p>';
    echo '</header>';
}
function matinf_theme_initials($name) {
    return implode('', array_map(fn($part)=>mb_substr($part,0,1),array_slice(preg_split('/\s+/u',trim($name)),0,2)));
}
function matinf_theme_visual($post, $class = '') {
    echo '<div class="editorial-visual '.esc_attr($class).'">';
    if (has_post_thumbnail($post)) echo get_the_post_thumbnail($post,'large',['loading'=>'lazy']);
    else echo '<span class="visual-glyph" aria-hidden="true">'.(['∑','{ }','π'][$post->ID%3]).'</span><span class="visual-caption">MATINF / IDEJE I ZNANJE</span>';
    echo '</div>';
}
function matinf_theme_person($person) {
    $title=get_post_meta($person->ID,'_matinf_academicTitle',true); $email=get_post_meta($person->ID,'_matinf_email',true);
    echo '<article class="person-card"><a class="person-portrait tone-'.($person->ID%3).'" aria-label="'.esc_attr('Profil: '.$person->post_title).'" href="'.esc_url(get_permalink($person)).'">';
    if(has_post_thumbnail($person)) echo get_the_post_thumbnail($person,'medium_large',['loading'=>'lazy']);
    else echo '<span aria-hidden="true">'.esc_html(matinf_theme_initials($person->post_title)).'</span>';
    echo '</a><div class="person-info"><span class="eyebrow">'.esc_html(matinf_staff_group($person->ID)).'</span><h3><a href="'.esc_url(get_permalink($person)).'">'.esc_html($person->post_title).'</a></h3><p>'.esc_html($title).'</p>';
    if($email) echo '<a class="person-email" href="mailto:'.esc_attr($email).'">'.esc_html($email).'</a>';
    echo '<a class="outline-link" href="'.esc_url(get_permalink($person)).'">Profil i kontakt <span aria-hidden="true">↗</span></a></div></article>';
}
function matinf_theme_post_card($post) {
    echo '<article class="editorial-card"><a aria-label="'.esc_attr(get_the_title($post)).'" href="'.esc_url(get_permalink($post)).'">'; matinf_theme_visual($post); echo '</a><div class="editorial-copy"><time class="date" datetime="'.esc_attr(get_the_date('c',$post)).'">'.esc_html(get_the_date('d. m. Y.',$post)).'</time><h2><a href="'.esc_url(get_permalink($post)).'">'.esc_html(get_the_title($post)).'</a></h2><p>'.esc_html(matinf_excerpt($post,22)).'</p><a class="read-more" href="'.esc_url(get_permalink($post)).'">Pročitajte više →</a></div></article>';
}
function matinf_theme_downloads($files) {
    if(!$files) return;
    echo '<section class="download-section"><h2>Dokumenti uz objavu</h2>';
    foreach($files as $file) echo '<a class="download-row" href="'.esc_url($file['url']).'"><span class="file-symbol" aria-hidden="true">↓</span><span><strong>'.esc_html($file['title']).'</strong><small>Otvori dokument</small></span><span aria-hidden="true">↗</span></a>';
    echo '</section>';
}
function matinf_theme_pagination() {
    echo '<nav class="pagination" aria-label="Stranice rezultata">'.paginate_links(['prev_text'=>'← Prethodna','next_text'=>'Sljedeća →']).'</nav>';
}
add_action('pre_get_posts',function($query){
    if(is_admin() || !$query->is_main_query() || !$query->is_post_type_archive('mf_course')) return;
    $meta=[];
    foreach(['program_id'=>'_matinf_programId','study_year'=>'_matinf_year','semester'=>'_matinf_semester'] as $key=>$field) if($value=matinf_theme_int($key)) $meta[]=['key'=>$field,'value'=>$value,'type'=>'NUMERIC'];
    if($meta) $query->set('meta_query',$meta);
    $query->set('orderby','title'); $query->set('order','ASC');
});
add_action('template_redirect',function(){
    global $wp;
    if($wp->request!=='prijava') return;
    status_header(200); nocache_headers(); get_header();
    get_template_part('templates/login'); get_footer(); exit;
},1);
