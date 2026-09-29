<?php
$item=$args['item']; $body=$item['bodyHtml'];
$parts=preg_split('/(?=<h2\b)/iu',$body); $intro=array_shift($parts); $stories=[];
foreach($parts as $part) {
    if(!preg_match('/^<h2\b[^>]*>(.*?)<\/h2>/isu',$part,$match)) continue;
    $name=html_entity_decode(wp_strip_all_tags($match[1]),ENT_QUOTES,'UTF-8');
    $content=substr($part,strlen($match[0]));
    $stories[]=['name'=>$name,'content'=>$content];
}
matinf_theme_heading('Priče koje inspirišu.','Studentska iskustva, prvi projekti i ideje koje prerastaju u nove prilike.','STUDENTSKE PRIČE');
?>
<section class="student-intro"><div class="student-photo"><img src="<?php echo esc_url(get_template_directory_uri().'/assets/students.jpg'); ?>" width="800" height="533" alt="Zajednički rad i razmjena ideja"><span>ZNANJE RASTE KROZ ISKUSTVO.</span></div><div><p class="eyebrow">UČENJE JE TEK POČETAK</p><h2>Različiti putevi.<br>Zajednička radoznalost.</h2><div class="prose"><?php echo $intro; ?></div><?php if($stories) : ?><a class="button secondary" href="#price">Upoznajte njihove priče ↓</a><?php endif; ?></div></section>
<?php if($stories) : ?><section class="story-index" aria-label="Izaberite studentsku priču"><?php foreach($stories as $i=>$story) : ?><a href="#prica-<?php echo $i+1; ?>"><span class="story-index-number">0<?php echo $i+1; ?></span><strong><?php echo esc_html($story['name']); ?></strong><span aria-hidden="true">↗</span></a><?php endforeach; ?></section>
<div id="price"><?php foreach($stories as $i=>$story) : ?><section class="student-story" id="prica-<?php echo $i+1; ?>"><aside class="student-identity tone-<?php echo $i%3; ?>"><span class="story-monogram" aria-hidden="true"><?php echo esc_html(matinf_theme_initials($story['name'])); ?></span><p class="eyebrow">STUDENTSKA PRIČA / 0<?php echo $i+1; ?></p><h2><?php echo esc_html($story['name']); ?></h2><span class="story-quote" aria-hidden="true">“</span></aside><article class="student-story-body prose"><?php echo $story['content']; ?></article></section><?php endforeach; ?></div>
<?php elseif(!$intro) : ?><p class="empty">Studentske priče uskoro će biti dostupne.</p><?php endif; ?>
<section class="journey-banner"><div><p class="eyebrow">VAŠA PRIČA POČINJE OVDJE</p><h2>Pronađite oblast koja vas pokreće.</h2></div><a class="button" href="<?php echo esc_url(get_post_type_archive_link('mf_program')); ?>">Istražite studije ↗</a></section>
