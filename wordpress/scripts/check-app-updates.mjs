import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export async function checkAppUpdates(site, browser, context, program, output) {
  async function php(code) { const r = await site.playground.run({ code: `<?php require '/wordpress/wp-load.php'; ${code}` }); assert.equal(r.exitCode, 0, r.errors); return JSON.parse(r.text); }
  const base = 'http://127.0.0.1:9412';
  const saved = await php(`echo wp_json_encode(get_option('matinf_calendar_overrides', []));`);
  const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const app = await context.newPage(); app.setDefaultTimeout(30000);
  let posts = [];
  try {
    await admin.goto(base + '/wp-login.php');
    await admin.locator('#user_login').fill(site.credentials.username);
    await admin.locator('#user_pass').fill(site.credentials.password);
    await Promise.all([admin.waitForURL('**/wp-admin/**'), admin.locator('#wp-submit').click()]);
    const editor = `${base}/wp-admin/admin.php?page=matinf-calendar&program_id=${program.id}&study_year=1&semester=1&calendar_type=exams`;
    await admin.goto(editor);
    const row = admin.locator('#matinf-calendar-rows tr').first();
    await row.getByRole('textbox', { name: 'Učionica', exact: true }).fill('Kabinet 321');
    await admin.getByRole('button', { name: 'Sačuvaj raspored', exact: true }).click();
    await admin.getByRole('status').filter({ hasText: 'Raspored je sačuvan.' }).waitFor();
    const examData = await (await fetch(`${base}/wp-json/matinf/v1/schedule?program_id=${program.id}&year=1`)).json();
    assert.equal(examData.exams[0].room, 'Kabinet 321');
    assert.match(examData.exams[0].startsAt, /[+]01:00$/);
    const count = await admin.locator('#matinf-calendar-rows tr').count();
    await admin.getByRole('button', { name: 'Dodaj termin', exact: true }).click();
    assert.equal(await admin.locator('#matinf-calendar-rows tr').count(), count + 1);
    await admin.locator('#matinf-calendar-rows tr').last().getByRole('button', { name: 'Ukloni' }).click();
    await admin.reload();
    assert.equal(await row.getByRole('textbox', { name: 'Učionica', exact: true }).inputValue(), 'Kabinet 321');
    await admin.screenshot({ path: resolve(output, 'calendar-editor.png') });
    const noNonce = await admin.evaluate(async () => (await fetch('admin-ajax.php', { method: 'POST', body: new URLSearchParams({ action: 'matinf_calendar_save' }) })).status);
    assert.equal(noNonce, 403);
    console.log('PASS: calendar editor save, REST update, row controls, nonce protection.');
    posts = await php(`$ids=[]; for($i=0;$i<22;$i++) { $id=wp_insert_post(['post_type'=>'post','post_status'=>'publish','post_title'=>'Pregled obavještenja ' . ($i+1),'post_content'=>'<p>Informacije o nastavi i ispitima.</p>']); wp_set_object_terms($id,['obavjestenja','novosti'],'category'); update_post_meta($id,'_matinf_important',$i%2===0); update_post_meta($id,'_matinf_noticeKind','exam'); $ids[]=$id; } echo wp_json_encode($ids);`);
    await app.goto('http://127.0.0.1:8090');
    async function checkBack(tab, title) {
      await app.getByRole('tab', { name: tab, exact: true }).click();
      const target = app.getByRole('button', { name: title, exact: true }).first();
      await target.scrollIntoViewIfNeeded();
      const offset = await target.evaluate(el => {
        document.querySelectorAll('[data-scroll-probe]').forEach(node => node.removeAttribute('data-scroll-probe'));
        let parent = el.parentElement;
        while (parent && !['auto','scroll'].includes(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
        if (!parent) throw Error('Scroll parent missing'); parent.dataset.scrollProbe = 'true'; return parent.scrollTop;
      });
      assert.ok(offset > 0, `${tab} scroll test must begin below top`);
      await target.click();
      await app.getByRole('button', { name: 'Nazad', exact: true }).waitFor();
      if (typeof title === 'string' && title.startsWith('Pregled obavještenja')) await app.getByText('Informacije o nastavi i ispitima.', { exact: true }).filter({ visible: true }).last().waitFor();
      await app.getByRole('button', { name: 'Nazad', exact: true }).click();
      const actual = await app.locator('[data-scroll-probe]').evaluate(el => el.scrollTop);
      assert.ok(Math.abs(actual - offset) < 3, `${tab}: expected scroll ${offset}, got ${actual}`);
      await app.getByRole('tab', { name: tab === 'Početna' ? 'Više' : 'Početna', exact: true }).click();
      await app.getByRole('tab', { name: tab, exact: true }).click();
      assert.ok(Math.abs(await app.locator('[data-scroll-probe]').evaluate(el => el.scrollTop) - offset) < 3, `${tab}: tab switch must retain scroll`);
      console.log(`PASS: ${tab} retains scroll after detail and tab switch.`);
    }
    const staff = await (await fetch(base + '/wp-json/matinf/v1/content/staff?per_page=50')).json();
    const person = staff.items.filter(row => row.meta.staffGroup === 'Saradnici').at(-2);
    await checkBack('Osoblje', person.title);
    const courses = await (await fetch(base + '/wp-json/matinf/v1/content/courses?per_page=15')).json();
    await checkBack('Predmeti', courses.items[10].title);
    await checkBack('Notifikacije', 'Pregled obavještenja 12');
    await checkBack('Početna', 'Pregled obavještenja 20');
    await checkBack('Više', /Uspješni studenti/);
    await app.getByRole('tab', { name: 'Notifikacije', exact: true }).click();
    await app.getByRole('button', { name: 'Nepročitane', exact: true }).click();
    await app.getByRole('button', { name: 'Pregled obavještenja 12', exact: true }).waitFor({ state: 'hidden' });
    await app.getByRole('button', { name: 'Sve', exact: true }).click();
    await app.getByRole('button', { name: 'Važne', exact: true }).click();
    await app.getByRole('button', { name: 'Pregled obavještenja 21', exact: true }).waitFor();
    await app.getByRole('button', { name: 'Pregled obavještenja 22', exact: true }).waitFor({ state: 'hidden' });
    await app.screenshot({ path: resolve(output, 'notifications-updated.png') });
    await app.reload();
    await app.getByRole('tab', { name: 'Notifikacije', exact: true }).click();
    await app.getByRole('button', { name: 'Nepročitane', exact: true }).click();
    await app.getByRole('button', { name: 'Pregled obavještenja 12', exact: true }).waitFor({ state: 'hidden' });
    console.log('PASS: editable calendar persists through REST, nonce protection, add/remove UI, all five tabs retain scroll, unread/important filters and read history persist.');
  } catch (error) { await app.screenshot({ path: resolve(output, 'updates-error.png') }); await admin.screenshot({ path: resolve(output, 'editor-error.png') }); throw error; }
  finally {
    await php(`update_option('matinf_calendar_overrides',json_decode(base64_decode('${Buffer.from(JSON.stringify(saved)).toString('base64')}'),true),false); foreach(json_decode('${JSON.stringify(posts)}') as $id) wp_delete_post($id,true); echo 'true';`);
    await app.close(); await admin.close();
  }
}
