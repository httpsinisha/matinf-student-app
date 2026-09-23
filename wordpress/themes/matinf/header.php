<!doctype html>
<html lang="sr-Latn">
<head><meta charset="<?php bloginfo('charset'); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><?php wp_head(); ?></head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a href="#main" class="skip-link">Pređi na sadržaj</a>
<header class="site-header"><div class="wrap header-inner">
    <a class="brand" href="<?php echo esc_url(home_url('/')); ?>"><span class="brand-mark" aria-hidden="true"></span><span><strong>MATINF</strong><small>Matematika. Informatika. Budućnost.</small></span></a>
    <button class="menu-toggle" aria-controls="main-navigation" aria-expanded="false" aria-label="Otvori navigaciju">☰</button>
    <nav id="main-navigation" class="nav" aria-label="Glavna navigacija"><?php matinf_theme_navigation(); ?><a href="<?php echo esc_url(home_url('/prijava/')); ?>">Prijava</a></nav>
</div></header>
<div class="demo-bar">Nezvanična akademska demonstracija · Za studente i sve zainteresovane</div>
<main id="main" class="wrap">
