<?php
defined('ABSPATH') || exit;

function matinf_contact_settings() {
    return array_merge(['enabled'=>false, 'sender'=>'', 'smtpHost'=>'', 'testMode'=>true, 'testTeacher'=>'', 'testStudent'=>''], (array) get_option('matinf_contact_settings', []));
}
function matinf_contact_error($message, $status = 400) { return new WP_Error('matinf_contact', $message, ['status'=>$status]); }
function matinf_contact_recipient($id, $settings) {
    if (!matinf_is_public($id, 'mf_staff')) return '';
    $email = $settings['testMode'] ? $settings['testTeacher'] : get_post_meta($id, '_matinf_email', true);
    return is_email($email) && !preg_match('/@(?:example\.(?:org|com|net)|[^@]+\.invalid)$/i', $email) ? $email : '';
}
function matinf_contact_config($request) {
    $settings = matinf_contact_settings();
    return new WP_REST_Response(['enabled'=>(bool) ($settings['enabled'] && is_email($settings['sender']) && matinf_contact_recipient((int)$request['staffId'], $settings)), 'testMode'=>(bool)$settings['testMode']], 200, ['Cache-Control'=>'no-store']);
}

// The SMTP configuration is scoped to these messages; it never alters other WP mail.
function matinf_contact_mail($to, $subject, $body, $reply_to = '') {
    $settings = matinf_contact_settings();
    $configure = function($mailer) use ($settings) {
        $mailer->setFrom($settings['sender'], 'MATINF', false);
        $mailer->Sender = $settings['sender'];
        if ($settings['smtpHost']) {
            $mailer->isSMTP(); $mailer->Host = $settings['smtpHost']; $mailer->Port = 587;
            $mailer->SMTPSecure = 'tls'; $mailer->SMTPAuth = false; $mailer->Timeout = 12;
        }
    };
    add_action('phpmailer_init', $configure);
    $previous_mailer = $GLOBALS['phpmailer'] ?? null;
    unset($GLOBALS['phpmailer']);
    try {
        $headers = ['Content-Type: text/plain; charset=UTF-8', 'From: MATINF <' . $settings['sender'] . '>'];
        if ($reply_to) $headers[] = 'Reply-To: ' . $reply_to;
        return wp_mail($to, $subject, $body, $headers);
    } finally {
        remove_action('phpmailer_init', $configure);
        if ($previous_mailer) $GLOBALS['phpmailer'] = $previous_mailer;
        else unset($GLOBALS['phpmailer']);
    }
}

function matinf_contact_limit($key, $limit, $seconds) {
    $key = 'matinf_contact_rate_' . hash_hmac('sha256', $key, wp_salt());
    $state = get_transient($key);
    if (!$state) $state = ['count'=>0, 'until'=>time()+$seconds];
    if ($state['count'] >= $limit) return false;
    $state['count']++;
    set_transient($key, $state, max(1, $state['until']-time()));
    return true;
}

function matinf_contact_request($request) {
    $settings = matinf_contact_settings();
    $staff = (int) $request['staffId']; $recipient = matinf_contact_recipient($staff, $settings);
    if (!$recipient) return matinf_contact_error('Slanje ovom profesoru trenutno nije dostupno.');
    $email = strtolower(trim($request['email']));
    if (!is_email($email) || preg_match('/[\r\n]/', $email)) return matinf_contact_error('Unesite ispravnu mejl adresu.');
    if ($settings['testMode'] && $settings['testStudent'] !== '' && strcasecmp($email, $settings['testStudent']) !== 0) return matinf_contact_error('Probno slanje je dostupno samo za studentsku adresu koju je administrator podesio.');
    $name = sanitize_text_field($request['name']); $subject = sanitize_text_field($request['subject']); $message = sanitize_textarea_field($request['message']);
    if (!$name || !$subject || !$message) return matinf_contact_error('Unesite ime, naslov i poruku.');
    // Calls are serialized by the endpoint lock, including these counters.
    if (!matinf_contact_limit('global', 100, HOUR_IN_SECONDS) || !matinf_contact_limit('ip:' . ($_SERVER['REMOTE_ADDR'] ?? ''), 15, HOUR_IN_SECONDS) || !matinf_contact_limit('email:' . $email, 5, HOUR_IN_SECONDS) || !matinf_contact_limit('cooldown:' . $email, 1, MINUTE_IN_SECONDS)) return matinf_contact_error('Previše zahtjeva. Sačekajte prije ponovnog slanja.', 429);
    $id = wp_generate_password(40, false, false); $code = (string) random_int(100000, 999999);
    $state = ['staff'=>$staff, 'recipient'=>$recipient, 'email'=>$email, 'name'=>$name, 'subject'=>$subject, 'message'=>$message,
        'hash'=>hash_hmac('sha256', $code, wp_salt()), 'attempts'=>0, 'expires'=>time()+10*MINUTE_IN_SECONDS, 'teacherSent'=>false, 'copySent'=>false];
    set_transient('matinf_contact_' . $id, $state, 10*MINUTE_IN_SECONDS);
    if (!matinf_contact_mail($email, 'MATINF — kod za potvrdu slanja', "Kod: $code\n\nUnesite ga u MATINF obrazac u narednih 10 minuta da potvrdite slanje poruke profesoru.\nAko niste tražili slanje, zanemarite ovaj mejl.")) {
        delete_transient('matinf_contact_' . $id);
        return matinf_contact_error('Kod nije predat mejl serveru. Pokušajte kasnije ili obavijestite administratora.', 502);
    }
    return ['requestId'=>$id, 'message'=>'Kod za potvrdu je poslat na vašu adresu. Provjerite i neželjenu poštu.'];
}

function matinf_contact_confirm($request) {
    $key = 'matinf_contact_' . $request['requestId']; $state = get_transient($key);
    if (!$state || $state['expires'] <= time()) return matinf_contact_error('Zahtjev je istekao. Vratite se na obrazac i zatražite novi kod.');
    if ($state['attempts'] >= 5) return matinf_contact_error('Previše pogrešnih kodova. Zatražite novi kod.', 429);
    if (!hash_equals($state['hash'], hash_hmac('sha256', $request['code'], wp_salt()))) {
        $state['attempts']++; set_transient($key, $state, max(1,$state['expires']-time()));
        return matinf_contact_error('Kod nije ispravan.');
    }
    $settings = matinf_contact_settings();
    if (matinf_contact_recipient($state['staff'], $settings) !== $state['recipient'] || ($settings['testMode'] && $settings['testStudent'] !== '' && strcasecmp($state['email'], $settings['testStudent']) !== 0)) return matinf_contact_error('Podešavanja primaoca su promijenjena. Zatražite novi kod.');
    if ($state['teacherSent'] && $state['copySent']) return ['sent'=>true, 'message'=>'Poruka i kopija su već predati mejl serveru. Nisu poslati ponovo.'];
    $body = 'Profesor: ' . html_entity_decode(get_the_title($state['staff']), ENT_QUOTES, 'UTF-8') . "\nStudent: " . $state['name'] . "\nMejl studenta: " . $state['email'] . "\n\n" . ($state['message'] ?? '');
    if ($settings['testMode']) $body = "PROBNO SLANJE — poruka je preusmjerena na probnu adresu.\n\n" . $body;
    if (!$state['teacherSent']) {
        if (!matinf_contact_mail($state['recipient'], 'MATINF — ' . $state['subject'], $body, $state['email'])) return matinf_contact_error('Poruka nije predata mejl serveru. Pokušajte ponovo istim kodom.', 502);
        $state['teacherSent'] = true; set_transient($key, $state, max(1,$state['expires']-time()));
    }
    if (!$state['copySent']) {
        if (!matinf_contact_mail($state['email'], 'MATINF — Kopija: ' . $state['subject'], "Kopija vaše poruke profesoru.\n\n" . $body, $state['recipient'])) return matinf_contact_error('Poruka profesoru je predata serveru, ali vaša kopija nije. Ponovite istim kodom da pošaljete samo kopiju.', 502);
        $state['copySent'] = true;
        // Keep only a short-lived receipt for safe retries; discard message content.
        unset($state['message'], $state['subject'], $state['name']);
        set_transient($key, $state, max(1,$state['expires']-time()));
    }
    return ['sent'=>true, 'message'=>'Poruka profesoru i vaša kopija predati su mejl serveru. Provjerite prijem i neželjenu poštu.'];
}

function matinf_contact_dispatch($request) {
    $settings = matinf_contact_settings();
    if (!$settings['enabled'] || !is_email($settings['sender'])) return matinf_contact_error('Slanje mejlova još nije podešeno.', 503);
    $stamp = (int) get_option('matinf_contact_lock');
    if ($stamp && $stamp < time()-120) delete_option('matinf_contact_lock');
    if (!add_option('matinf_contact_lock', time(), '', false)) return matinf_contact_error('Slanje je u toku. Pokušajte ponovo za nekoliko sekundi.', 429);
    try {
        $result = $request->get_route() === '/matinf/v1/contact/request' ? matinf_contact_request($request) : matinf_contact_confirm($request);
        return is_wp_error($result) ? $result : new WP_REST_Response($result, 200, ['Cache-Control'=>'no-store']);
    } finally { delete_option('matinf_contact_lock'); }
}
add_action('rest_api_init', function() {
    register_rest_route('matinf/v1', '/contact/config', ['methods'=>'GET','permission_callback'=>'__return_true','callback'=>'matinf_contact_config','args'=>['staffId'=>['required'=>true,'type'=>'integer','minimum'=>1]]]);
    $text = fn($max) => ['required'=>true,'type'=>'string','minLength'=>1,'maxLength'=>$max];
    register_rest_route('matinf/v1', '/contact/request', ['methods'=>'POST','permission_callback'=>'__return_true','callback'=>'matinf_contact_dispatch','args'=>[
        'staffId'=>['required'=>true,'type'=>'integer','minimum'=>1], 'name'=>$text(100), 'email'=>$text(254), 'subject'=>$text(150), 'message'=>$text(5000),
    ]]);
    register_rest_route('matinf/v1', '/contact/confirm', ['methods'=>'POST','permission_callback'=>'__return_true','callback'=>'matinf_contact_dispatch','args'=>[
        'requestId'=>array_merge($text(40),['pattern'=>'^[a-zA-Z0-9]{40}$']), 'code'=>array_merge($text(6),['pattern'=>'^[0-9]{6}$']),
    ]]);
});
