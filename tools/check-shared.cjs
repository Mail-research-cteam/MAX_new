const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('./browser.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
  require('./check-scenarios.cjs');
  // The archive predates an authorised manual coordinate change. The complete
  // current-file fingerprint above protects all coordinates; compare archive content too when available.
  function withoutCoordinates(v){if(Array.isArray(v))return v.map(withoutCoordinates);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>k!=='x'&&k!=='y').map(([k,v])=>[k,withoutCoordinates(v)]));return v;}
  for(const [id,file]of [['purchase','index.html'],['owner','bot-lpr.html'],['employee','bot-employee.html']]){
    const archive=path.join(root,'audit-max/MAX-main',file);if(!fs.existsSync(archive))continue;
    const original=JSON.parse(fs.readFileSync(archive,'utf8').match(/<script id="scenario" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    const next=JSON.parse(fs.readFileSync(path.join(root,'prototype/scenarios',id+'.json'),'utf8')).scenario;
    assert.deepEqual(withoutCoordinates(next),withoutCoordinates(original));console.log('PASS archived research content; working coordinates protected separately:',id);
  }
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({acceptDownloads:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const base='http://127.0.0.1:8000/prototype/';
    await page.goto(base+'bot-lpr.html?edit=1');await page.locator('.scenario-trigger').waitFor();
    assert.equal(await page.locator('.fl-node').count(),30);console.log('PASS owner graph');
    const field=page.locator('[data-path="nodes.greet.text"]');const original=await field.inputValue();await field.fill(original+' TEST-MARKER');await page.waitForTimeout(500);
    assert(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('max-draft:1:')&&k.endsWith(':owner:1')&&JSON.parse(localStorage.getItem(k)).nodes.greet.text.includes('TEST-MARKER'))));
    const plain=await context.newPage();await plain.goto(base+'bot-lpr.html');await plain.locator('.bot-btn').first().waitFor();assert(!await plain.locator('.chat-scroll').textContent().then(x=>x.includes('TEST-MARKER')));console.log('PASS draft isolated from respondent');
    await page.reload();await page.locator('.scenario-trigger').waitFor();assert((await field.inputValue()).includes('TEST-MARKER'));console.log('PASS draft restored');
    // Restart closes an ordinary modal, without changing graph data.
    await page.getByRole('button',{name:'Авторизоваться',exact:true}).click();await page.waitForTimeout(100);assert(await page.locator('#shareModal').evaluate(e=>e.classList.contains('is-open')));
    await page.locator('#flRestart').click({force:true});assert(!await page.locator('#shareModal').evaluate(e=>e.classList.contains('is-open')));console.log('PASS restart closes modal');
    const id='smoke-'+Date.now();page.once('dialog',d=>d.accept(id));await page.locator('.scenario-trigger').click();await page.getByRole('option',{name:'Новый сценарий',exact:true}).click();await page.waitForURL('**scenario='+id+'&edit=1');await page.locator('.scenario-trigger').waitFor();
    assert.equal(await page.locator('.fl-node').count(),30);console.log('PASS create variant');
    const downloadPromise=page.waitForEvent('download');await page.locator('#flDownloadJSON').click();await (await downloadPromise).saveAs(path.join(root,'audit-max/shared-smoke.json'));
    const exported=JSON.parse(fs.readFileSync(path.join(root,'audit-max/shared-smoke.json'),'utf8'));assert(exported.scenario.nodes.greet.text.includes('TEST-MARKER'));
    await page.goto(base+'index.html?scenario='+id+'&saved=1');await page.locator('.bot-btn').first().waitFor();assert((await page.locator('.chat-scroll').textContent()).includes('TEST-MARKER'));console.log('PASS saved variant shown to respondent');
    await page.goto(base+'index.html?scenario='+id+'&edit=1');await page.locator('.scenario-trigger').waitFor();const zipPromise=page.waitForEvent('download');await page.evaluate(b=>MaxAuthor.exportBundle(b,b.scenario),exported);await (await zipPromise).saveAs(path.join(root,'audit-max/shared-smoke.zip'));console.log('PASS ZIP exported');
    require('./zip-utils.cjs').extract(path.join(root,'audit-max/shared-smoke.zip'),'audit-max/verified-release');
    await plain.goto('http://127.0.0.1:8000/audit-max/verified-release/index.html');await plain.locator('.bot-btn').first().waitFor();assert((await plain.locator('.chat-scroll').textContent()).includes('TEST-MARKER'));assert.equal(await plain.locator('html').getAttribute('data-frozen'),'true');console.log('PASS exported release opens with selected scenario');
    await page.locator('.fl-port--out').first().focus();await page.keyboard.press('Enter');await page.locator('dialog').waitFor();await page.getByRole('button',{name:'Отмена',exact:true}).click();console.log('PASS keyboard connection dialog');
    await page.goto(base+'bot-employee.html?edit=1');await page.locator('.scenario-trigger').waitFor();assert.equal(await page.locator('.fl-node').count(),12);assert.equal(await page.locator('[data-path="nodes.password_page.repeatUrl"]').inputValue(),'password.html?expired=true');console.log('PASS employee repeat URL');
    await page.locator('.bot-btn').first().waitFor();
    const bar=await page.locator('.fl-bar').boundingBox(),app=await page.locator('.app').boundingBox();assert.equal(app.y,0);assert.equal(app.height,720);assert(bar.x+bar.width<=app.x+1);console.log('PASS full-height preview and controls stay on board side');
    await page.screenshot({path:path.join(root,'audit-max/shared-editor.png'),fullPage:false});assert.deepEqual(errors,[]);console.log('PASS no browser runtime errors');
    await plain.setViewportSize({width:390,height:844});await plain.goto(base+'bot-employee.html');await plain.locator('.bot-btn').first().waitFor();assert(await plain.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));console.log('PASS mobile width 390');
    await context.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
