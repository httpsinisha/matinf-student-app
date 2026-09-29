// Local design review only. Copies missing public information pages from the
// hosted site; never overwrites a local page or writes to the hosted WordPress.
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { projectRoot } from './runtime.mjs';
const base = 'http://127.0.0.1:9400';
const output = resolve(projectRoot, '../artifacts/web-redesign');
await mkdir(output, { recursive:true });
const browser = await chromium.launch({ channel:'chrome', headless:true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  const local = await (await fetch(base+'/wp-json/matinf/v1/content/pages?per_page=50')).json();
  const missing = ['raspored','studentske-price'].filter(slug => !local.items.some(item=>item.slug===slug));
  if (missing.length) {
    const remote = await (await fetch('https://sinisa.alwaysdata.net/wp-json/matinf/v1/content/pages?per_page=50', { signal:AbortSignal.timeout(20000) })).json();
    const credentials = JSON.parse(await readFile(resolve(projectRoot,'.runtime/local-admin.json'),'utf8'));
    await page.goto(base+'/wp-login.php');
    await page.locator('#user_login').fill(credentials.username); await page.locator('#user_pass').fill(credentials.password);
    await Promise.all([page.waitForURL('**/wp-admin/**'),page.locator('#wp-submit').click()]);
    for (const slug of missing) {
      const item = remote.items.find(item=>item.slug===slug); if (!item) continue;
      await page.goto(base+'/wp-admin/post-new.php?post_type=page');
      await page.waitForFunction(()=>typeof window.wp?.apiFetch==='function');
      await page.evaluate(async data=>{
        await window.wp.apiFetch({path:'/wp/v2/pages',method:'POST',data});
      }, {title:item.title,slug,status:'publish',content:slug==='raspored'?'[matinf_schedule]':item.bodyHtml});
      console.log('Local preview page added:',slug);
    }
  }
  // Anonymous screenshots, so the admin bar is not part of the design.
  const publicContext=await browser.newContext(); const view=await publicContext.newPage();
  const errors=[]; view.on('pageerror',error=>errors.push(error.message));
  for (const width of [1440,768,390]) {
    await view.setViewportSize({width,height:1000});
    const response=await view.goto(base,{waitUntil:'networkidle'});
    assert.equal(response.status(),200);
    assert.equal(await view.locator('.program-card').count(),3);
    assert.equal(await view.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await view.locator('.stories-band').count(),1);
    await view.screenshot({path:resolve(output,`home-${width}.png`),fullPage:true});
    await view.screenshot({path:resolve(output,`home-${width}-top.png`)});
    if(width===390){
      await view.getByRole('button',{name:'Otvori navigaciju'}).click();
      await view.locator('.nav-more summary').click();
      assert.equal(await view.locator('.nav-dropdown').isVisible(),true);
      await view.keyboard.press('Escape'); assert.equal(await view.locator('.nav-more').getAttribute('open'),null);
      await view.getByRole('navigation',{name:'Glavna navigacija',exact:true}).getByRole('link',{name:'Studije',exact:true}).click();
      await view.waitForLoadState('networkidle');
      for(const id of ['undergraduate','master','doctoral']) assert.equal(await view.locator('#'+id).count(),1);
      await view.screenshot({path:resolve(output,'studies-mobile.png'),fullPage:true});
    }
  }
  for (const path of ['/raspored/','/osoblje/','/prijava/']) {
    const response=await view.goto(base+path,{waitUntil:'networkidle'});
    assert.equal(response.status(),200,path);
    assert.equal(await view.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,path+' overflow');
    await view.screenshot({path:resolve(output,path.replaceAll('/','')+'-mobile.png'),fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: desktop/tablet/mobile, three programs, study levels, menu, schedule, staff and login.');
} finally { await browser.close(); }
