'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('./browser.cjs');
const base='http://127.0.0.1:8000/prototype/',original=JSON.parse(fs.readFileSync('prototype/scenarios/owner.json','utf8'));
fs.mkdirSync('audit-max/publication',{recursive:true});
(async()=>{const b=await chromium.launch({headless:true});try{
 let networkFailure=false;
 const c=await b.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),p=await c.newPage(),errors=[],outside=[];
 if(process.env.AUDIT_SOURCE_HTML==='1')await c.route('http://127.0.0.1:8000/prototype/*.html*',r=>{const pathname=new URL(r.request().url()).pathname;return r.fulfill({contentType:'text/html',body:fs.readFileSync('.'+pathname)});});
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:8000/'))outside.push(new URL(r.url()).hostname);});
 await p.addInitScript(()=>{let board;Object.defineProperty(window,'MaxBoard',{get:()=>board,set:v=>{const create=v.create;v.create=api=>{window.__auditApi=api;return create(api);};board=v;}});});
 const state=()=>p.evaluate(()=>JSON.parse(JSON.stringify(window.__auditApi.state())));
 async function ready(){await p.locator('.scenario-trigger').waitFor();await p.evaluate(()=>document.fonts.ready);}
 async function command(name){await p.locator('.scenario-trigger').click();await p.getByRole('button',{name,exact:true}).click();}
 async function importText(text){const choice=p.waitForEvent('filechooser');await command('Импорт JSON');await(await choice).setFiles({name:'audit.json',mimeType:'application/json',buffer:Buffer.from(text)});}
 await p.goto(base+'index.html?scenario=owner&edit=1');await ready();
 await p.locator('.scenario-trigger').click();assert(await p.getByRole('button',{name:'Файловая версия',exact:true}).isVisible());assert((await p.locator('.author-source').textContent()).includes('JSON-файл'));await p.keyboard.press('Escape');
 const before=await state();
 for(const corrupt of ['', '{', '[]', JSON.stringify({...original,id:'__proto__'}), JSON.stringify({...original,scenario:{...original.scenario,nodes:{evil:{type:'external',url:'javascript:alert(1)'}}}})]){
  await importText(corrupt);await p.waitForTimeout(100);assert.equal(p.url(),base+'index.html?scenario=owner&edit=1');assert.deepEqual(await state(),before);assert(await p.locator('#authorStatus.author-error').isVisible());
 }
 console.log('PASS malformed/unexpected/unsafe imports reject without replacing current data');
 await p.locator('[data-path="nodes.greet.text"]').fill('Round trip — plain text, coordinates stay');await p.waitForTimeout(400);
 const current=await state(),download=p.waitForEvent('download');await command('Сохранить версию + JSON');const json=await download;await json.saveAs('audit-max/publication/round-trip-private.json');const saved=JSON.parse(fs.readFileSync('audit-max/publication/round-trip-private.json'));assert.deepEqual(saved.scenario,current);
 const imported={...saved,id:'audit-round-trip'};await importText(JSON.stringify(imported));await p.waitForURL('**scenario=audit-round-trip&edit=1');await ready();assert.deepEqual(await state(),current);
 console.log('PASS visible JSON save/import round-trip retains every field and coordinate');
 const danger=structuredClone(original);danger.id='audit-escaped';danger.scenario.header.name='<img src=x onerror="window.__xss=1">';danger.scenario.nodes.greet.text='<svg onload="window.__xss=1"> [unsafe](javascript:alert(1)) https://example.invalid/path';
 await importText(JSON.stringify(danger));await p.waitForURL('**scenario=audit-escaped&edit=1');await ready();await p.locator('.bot-btn').first().waitFor();
 assert.equal(await p.evaluate(()=>window.__xss),undefined);assert.equal(await p.locator('.chat-scroll svg[onload],.tb-title img').count(),0);assert.equal(await p.locator('.chat-scroll a[href^="javascript:"]').count(),0);assert.equal(await p.locator('.chat-scroll a').first().getAttribute('href'),'#');
 assert.equal(await p.evaluate(()=>window.__xss),undefined);try{assert.deepEqual(outside,[]);}catch{networkFailure=true;console.log('FAIL network isolation: external hosts observed',JSON.stringify([...new Set(outside)]));}fs.writeFileSync('audit-max/publication/network-'+(process.env.AUDIT_SOURCE_HTML?'source':'live')+'.json',JSON.stringify({outsideHosts:[...new Set(outside)],passed:!networkFailure}));console.log('PASS untrusted markup inert and unsafe message links stripped');
 // Saved data corruption falls back to the file, preserving the original bytes.
 await p.evaluate(()=>localStorage.setItem('max-saved:1:/prototype/:owner','{'));await p.goto(base+'index.html?scenario=owner&edit=1');await ready();assert.equal(await p.evaluate(()=>localStorage.getItem('max-saved:1:/prototype/:owner')),'{');
 await p.locator('.scenario-trigger').click();assert((await p.locator('.author-source').textContent()).includes('повреждена'));await p.keyboard.press('Escape');
 p.once('dialog',d=>d.dismiss());await importText(JSON.stringify(original));await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>localStorage.getItem('max-saved:1:/prototype/:owner')),'{');console.log('PASS corrupt saved version preserved; file fallback; overwrite cancellation');
 await p.route('**/release-files.json',r=>r.fulfill({json:['../secret.json']}));let downloads=0;p.on('download',()=>downloads++);await p.locator('#flDownload').click();await p.waitForTimeout(150);assert.equal(downloads,0);assert((await p.locator('#authorStatus').textContent()).includes('список файлов ZIP'));await p.unroute('**/release-files.json');
 // A blocked storage must not prevent obtaining a JSON backup.
 const noStorage=await c.newPage();noStorage.on('pageerror',e=>errors.push(e.message));await noStorage.addInitScript(()=>{Storage.prototype.getItem=Storage.prototype.setItem=function(){throw new DOMException('Storage unavailable','SecurityError');};});await noStorage.goto(base+'index.html?scenario=employee&edit=1');await noStorage.locator('.scenario-trigger').waitFor();await noStorage.locator('[data-path="nodes.greet.text"]').fill('Unsaved data survives');await noStorage.waitForTimeout(400);assert(await noStorage.locator('#authorStatus.author-error').isVisible());
 const backup=noStorage.waitForEvent('download');await noStorage.locator('.scenario-trigger').click();await noStorage.getByRole('button',{name:'Сохранить версию + JSON',exact:true}).click();const result=await backup;await result.saveAs('audit-max/publication/storage-fallback-private.json');assert.equal(JSON.parse(fs.readFileSync('audit-max/publication/storage-fallback-private.json')).scenario.nodes.greet.text,'Unsaved data survives');
 assert.deepEqual(errors,[]);await p.screenshot({path:'audit-max/publication/editor-commands-private.png'});console.log('PASS traversal manifest rejected; unavailable storage still downloads recoverable JSON; no runtime errors');await c.close();if(networkFailure)process.exitCode=1;
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
