import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { projectRoot } from './runtime.mjs';
const base='http://127.0.0.1:9400';
const output=resolve(projectRoot,'../artifacts/web-redesign/pages');
await mkdir(output,{recursive:true});
const api=async name=>{ const items=[]; for(let page=1;;page++){const response=await fetch(base+'/wp-json/matinf/v1/content/'+name+'?per_page=50&page='+page,{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);const data=await response.json();items.push(...data.items);if(page>=data.totalPages)return items;} };
const [programs,courses,staff,documents,news]=await Promise.all(['programs','courses','staff','documents','news'].map(api));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage(); page.setDefaultTimeout(20000);
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  const categories=await page.locator('.footer-grid a').evaluateAll(links=>Object.fromEntries(links.filter(a=>['Novosti','Obavještenja'].includes(a.textContent)).map(a=>[a.textContent,a.href])));
  const paths={stories:base+'/studentske-price/',news:categories.Novosti,announcements:categories['Obavještenja'],staff:base+'/osoblje/',programs:base+'/studije/',courses:base+'/predmeti/',documents:base+'/dokumenti/',schedule:base+'/raspored/',exams:base+'/raspored/?view=exams',graduate:base+'/raspored/?view=graduate',contact:base+'/kontakt/',about:base+'/o-aplikaciji/',login:base+'/prijava/',profile:staff[0]?.url,program:programs[0]?.url,course:courses[0]?.url,document:documents[0]?.url,article:news[0]?.url};
  for(const width of (process.argv.includes("--functional-only") ? [] : [1440,390])){
    await page.setViewportSize({width,height:1000});
    for(const [name,url] of Object.entries(paths)){
      if(!url) continue;
      const response=await page.goto(url,{waitUntil:'networkidle'});
      assert.equal(response.status(),200,name);
      assert.equal(await page.locator('h1').count(),1,name+' one heading');
      assert.doesNotMatch(await page.locator('body').innerText(),/Fatal error|Warning:|Parse error/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name+' overflow '+width);
      await page.screenshot({path:resolve(output,name+'-'+width+'.png'),fullPage:true});
      console.log('PASS',name,width);
    }
  }
  await page.goto(base+'/osoblje/?group=nastavnici');
  assert.equal(await page.locator('.directory-section:not(#nastavnici)').count(),0);
  assert.equal(await page.locator('.pill-nav [aria-current=page]').innerText(),'Nastavnici');
  await page.goto(base+'/predmeti/');
  await page.locator('[name=program_id]').selectOption(String(programs[0].id));
  await page.locator('[name=study_year]').selectOption('1');
  await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Prikaži predmete'}).click()]);
  assert.equal(await page.locator('[name=program_id]').inputValue(),String(programs[0].id));
  const actualLinks=await page.locator('.course-row').evaluateAll(links=>links.map(a=>a.href));
  for(const link of actualLinks){const course=courses.find(c=>c.url===link); assert.ok(course); assert.equal(course.meta.programId,programs[0].id);assert.equal(course.meta.year,1);}
  await page.goto(base+'/raspored/?view=classes&weekday=2');
  assert.equal(await page.locator('.timetable-day').count(),1);
  assert.equal(await page.locator('.timetable-day h2').innerText(),'Utorak');
  await page.getByRole('navigation',{name:'Vrsta rasporeda'}).getByRole('link',{name:'Ispiti',exact:true}).click();
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.schedule-tabs [aria-current=page]').innerText(),'Ispiti');
  assert.equal(await page.locator('.timetable-day').count(),0);
  await page.goto(programs[0].url);
  const years=page.locator('.curriculum-year'); assert.equal(await years.count(),programs[0].meta.durationYears);
  if(await years.count()>1){await years.nth(1).locator('summary').click();assert.notEqual(await years.nth(1).getAttribute('open'),null);}
  await page.goto(base+'/studentske-price/');
  assert.equal(await page.locator('.student-story').count(),3);
  await page.locator('.story-index a').nth(1).click();assert.match(page.url(),/#prica-2$/);
  await page.goto(base+'/missing-preview-page/');assert.equal(await page.locator('.empty-state').count(),1);
  assert.deepEqual(errors,[]);
  console.log('PASS: filters, program curriculum, calendar views/days, story links and 404.');
} finally {await browser.close();}
