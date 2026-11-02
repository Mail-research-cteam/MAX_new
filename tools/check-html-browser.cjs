'use strict';
// No preview server is required: only the source page is served by Playwright routing.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('./browser.cjs');
const root=path.resolve(__dirname,'../prototype'),out=path.resolve(__dirname,'../audit-max/html-browser');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true});
 try{for(const id of ['owner','employee','purchase']){
  const context=await browser.newContext({acceptDownloads:true});
  await context.route('https://max.test/**',async route=>{
   const p=path.resolve(root,'.'+new URL(route.request().url()).pathname);
   if(!p.startsWith(root+path.sep)||!fs.existsSync(p))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(p),contentType:mime[path.extname(p)]||'application/octet-stream'});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://max.test/index.html?scenario='+id+'&edit=1');
  await page.locator('.editor-toolbar').waitFor();
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#flDownload').click()]);
  const first=path.join(out,id+'.html');await download.saveAs(first);
  const offline=await context.newPage(),requests=[];offline.on('pageerror',e=>errors.push(e.message));
  offline.on('dialog',d=>d.accept());
  await offline.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)){requests.push(url);return route.abort();}return route.continue();});
  await offline.goto(pathToFileURL(first).href);
  await offline.frameLocator('#screen iframe').locator('.app').waitFor();
  const editor=offline.frameLocator('#screen iframe');await editor.locator('.editor-toolbar').waitFor();
  const field=editor.locator('textarea[data-path="intro.card.text"]');
  const target=await field.count()?field:editor.locator('textarea[data-path]').first();
  const key=await target.getAttribute('data-path'),value='Автономная правка </script><script>window.PWNED=true</script>';
  await target.fill(value);await target.blur();
  assert.equal(await offline.locator('body > nav').count(),0);
  assert.equal(await editor.locator('.editor-context,.scenario-trigger,.scenario-options').count(),0);
  assert.equal(await editor.getByRole('button',{name:'HTML',exact:true}).count(),1);
  assert.equal(await editor.locator('#authorStatus').isVisible(),false);
  await editor.locator('[data-view=preview]').click();
  const layout=await editor.locator('.editor-toolbar').evaluate(bar=>({bottom:bar.getBoundingClientRect().bottom,appTop:document.querySelector('.app').getBoundingClientRect().top,background:getComputedStyle(bar).backgroundColor,canvasBackground:getComputedStyle(document.querySelector('#flow')).backgroundColor}));
  assert.ok(layout.appTop>=layout.bottom);assert.equal(layout.background,'rgb(255, 255, 255)');assert.equal(layout.canvasBackground,'rgba(0, 0, 0, 0)');
  const [saved]=await Promise.all([offline.waitForEvent('download'),editor.locator('#flDownload').click()]);
  const second=path.join(out,id+'-edited.html');await saved.saveAs(second);
  const source=fs.readFileSync(second,'utf8');
  const imported=await page.evaluate(html=>MaxHTML.extract(html),source);
  const actual=key.split('.').reduce((v,k)=>v[k],imported.scenario);assert.equal(actual,value);
  await offline.goto(pathToFileURL(second).href);
  await offline.frameLocator('#screen iframe').locator('.editor-toolbar').waitFor();
  assert.equal(await offline.frameLocator('#screen iframe').locator('textarea[data-path="'+key+'"]').inputValue(),value);
  assert.equal(await offline.evaluate(()=>window.PWNED),undefined);
  await offline.evaluate(()=>MaxOffline.bridge('').open('mail.html'));
  const mail=offline.frameLocator('#screen iframe:last-child');await mail.locator('.logo').waitFor();
  assert.ok(await mail.locator('.logo').evaluate(img=>img.complete&&img.naturalWidth>0));
  await offline.goBack();
  await offline.evaluate(()=>MaxOffline.bridge('').open('password.html?expired=true'));
  await offline.frameLocator('#screen iframe:last-child').locator('#js-email').waitFor();
  assert.deepEqual(requests,[],'offline document must not request network resources');assert.deepEqual(errors,[]);
  console.log('PASS '+id+': file:// editor, edit/re-export/reopen, safe HTML import, mail/password, no network requests');
  await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
