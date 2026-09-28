<?php
defined('ABSPATH') || exit;

add_action('admin_menu', function() {
    add_management_page('MATINF mejl', 'MATINF mejl', 'manage_options', 'matinf-contact', function() {
        if (!current_user_can('manage_options')) return;
        $settings = matinf_contact_settings();
        echo '<div class="wrap"><h1>MATINF — poruke profesorima</h1><p>Probni režim preusmjerava poruke sa svih profila na jednu probnu adresu profesora. Ostavite probnu adresu studenta praznu da svaki student unese svoj mejl i potvrdi ga kodom. Ako unesete studentsku adresu, slanje je ograničeno samo na nju.</p>';
        if (isset($_GET['saved'])) echo '<div class="notice notice-success"><p>Podešavanja su sačuvana.</p></div>';
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="matinf_contact_settings">';
        wp_nonce_field('matinf_contact_settings');
        foreach (['enabled'=>'Uključi slanje poruka', 'testMode'=>'Probni režim (ista probna adresa za sve profesore)'] as $key=>$label) echo '<p><label><input type="checkbox" name="' . $key . '" value="1" ' . checked($settings[$key],true,false) . '> ' . esc_html($label) . '</label></p>';
        echo '<table class="form-table">';
        foreach (['sender'=>'Mejl pošiljaoca (postojeće sanduče)', 'smtpHost'=>'SMTP server na alwaysdata (port 587, TLS)', 'testTeacher'=>'Probna adresa profesora', 'testStudent'=>'Probna adresa studenta (opciono)'] as $key=>$label) {
            echo '<tr><th><label for="mf-' . $key . '">' . esc_html($label) . '</label></th><td><input class="regular-text" id="mf-' . $key . '" name="' . $key . '" type="' . ($key==='smtpHost'?'text':'email') . '" value="' . esc_attr($settings[$key]) . '"></td></tr>';
        }
        echo '</table><p>Na alwaysdata hosting serveru SMTP ne zahtijeva lozinku. Ovdje unesite smtp-NAZIVNALOGA.alwaysdata.net. Ako ostavite SMTP prazno, koristi se standardno WordPress slanje. Lozinka mejla se ne unosi u aplikaciju.</p><p>Student dobija šestocifreni kod koji važi 10 minuta. Tek potvrdom koda šalju se poruka profesoru i kopija studentu. Profesor odgovara direktno studentu.</p><p>Pri testiranju otvorite javni profil bilo kojeg profesora na sajtu. Provjerite oba sandučeta, uključujući neželjenu poštu. Prihvatanje poruke od servera nije potvrda prijema; detalje možete vidjeti u alwaysdata → Emails → History.</p>';
        submit_button('Sačuvaj podešavanja'); echo '</form></div>';
    });
});
add_action('admin_post_matinf_contact_settings', function() {
    if (!current_user_can('manage_options')) wp_die('Pristup nije dozvoljen.', '', ['response'=>403]);
    check_admin_referer('matinf_contact_settings');
    $settings = ['enabled'=>!empty($_POST['enabled']), 'testMode'=>!empty($_POST['testMode'])];
    foreach (['sender','testTeacher','testStudent'] as $key) {
        $value = trim(wp_unslash($_POST[$key] ?? ''));
        if ($value && (!is_email($value) || preg_match('/[\r\n]/', $value))) wp_die('Neispravna mejl adresa.', '', ['response'=>400]);
        $settings[$key] = $value;
    }
    $host = trim(wp_unslash($_POST['smtpHost'] ?? ''));
    // This passwordless transport is only intended for the hosting provider.
    if ($host && !preg_match('/^smtp-[a-z0-9-]+\.alwaysdata\.net$/i', $host)) wp_die('Unesite alwaysdata SMTP server u obliku smtp-nalog.alwaysdata.net.', '', ['response'=>400]);
    $settings['smtpHost'] = strtolower($host);
    if ($settings['enabled'] && (!$settings['sender'] || ($settings['testMode'] && !$settings['testTeacher']))) wp_die('Unesite pošiljaoca i probnu adresu profesora prije uključivanja.', '', ['response'=>400]);
    update_option('matinf_contact_settings', $settings, false);
    wp_safe_redirect(admin_url('tools.php?page=matinf-contact&saved=1')); exit;
});

add_action('wp_enqueue_scripts', function() {
    if (!is_singular('mf_staff')) return;
    wp_enqueue_script('matinf-contact', plugins_url('../assets/contact.js', __FILE__), [], MATINF_VERSION, true);
    wp_enqueue_style('matinf-contact', plugins_url('../assets/contact.css', __FILE__), [], MATINF_VERSION);
});
function matinf_contact_form($staff_id) {
    $settings = matinf_contact_settings();
    if (!$settings['enabled'] || !is_email($settings['sender']) || !matinf_contact_recipient($staff_id, $settings)) return;
    echo '<details class="mf-contact"><summary class="button">Pošalji mejl profesoru</summary><form data-matinf-contact data-staff="' . (int)$staff_id . '" data-api="' . esc_url(rest_url('matinf/v1/contact/')) . '"><h2>Poruka profesoru</h2>';
    if ($settings['testMode']) echo '<p>Probni režim: poruka ide na zajedničku probnu adresu profesora. Vašu adresu potvrđujete kodom iz mejla.</p>';
    echo '<p>Prije slanja potvrdite svoju mejl adresu kodom. Profesor dobija poruku, a vi kopiju. Vaše ime i adresa biće dostupni primaocu.</p><fieldset data-message-fields>';
    foreach (['name'=>['Vaše ime','text',100], 'email'=>['Vaš mejl','email',254], 'subject'=>['Naslov','text',150]] as $key=>$field) echo '<label>' . esc_html($field[0]) . '<input name="' . $key . '" type="' . $field[1] . '" maxlength="' . $field[2] . '" required></label>';
    echo '<label>Poruka<textarea name="message" rows="6" maxlength="5000" required></textarea></label></fieldset><fieldset data-code-fields hidden disabled><label>Kod iz mejla<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label></fieldset><p role="status" aria-live="polite" data-status></p><button class="button" type="submit">Nastavi — pošalji kod</button> <button class="button secondary" type="button" data-edit hidden>Izmijeni poruku / novi kod</button></form></details>';
}
