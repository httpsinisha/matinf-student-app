<?php
get_header();
while(have_posts()) : the_post();
    if(post_password_required()) { matinf_theme_heading(get_the_title()); echo get_the_password_form(); continue; }
    $post=get_post();
    $type=matinf_collection_for_post($post);
    $item=matinf_content_item($post,$type,true);
    $meta=(array)$item['meta']; $relations=(array)$item['relations'];
    if($post->post_type==='page' && in_array($post->post_name,['studentske-price','raspored'],true)) {
        get_template_part('templates/'.$post->post_name,null,['post'=>$post,'item'=>$item]);
    } else get_template_part('templates/detail',null,['post'=>$post,'item'=>$item,'meta'=>$meta,'relations'=>$relations,'type'=>$type]);
endwhile;
get_footer();
