require('./test-images.cjs')();
const fs=require('node:fs'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {chromium}=require('./browser.cjs');
const base='http://127.0.0.1:8000/',fixture=JSON.parse(fs.readFileSync('prototype/scenarios/owner.json','utf8'));
fixture.scenario.nodes={b:{type:'bot',x:40,y:160,text:'**Сообщение с изображением**\nПодпись под картинкой',buttons:[{label:'Далее',target:'u'}],time:'09:41',auto:''},u:{type:'user',x:400,y:160,text:'Исходящее сообщение',time:'09:42',auto:''},c:{type:'person_chat',x:760,y:160,message:'Сообщение контакту',contactSource:'selected',time:'09:43',auto:''}};
fixture.scenario.intro.auto='b';
const strip=s=>{const copy=structuredClone(s);for(const n of Object.values(copy.nodes))delete n.image;return copy;};
(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true}),p=await context.newPage(),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.name,e.message,String(e),e.stack);});
 await p.addInitScript(()=>{let board;Object.defineProperty(window,'MaxBoard',{configurable:true,get:()=>board,set:v=>{const create=v.create;v.create=function(api){window.__mediaApi=api;const instance=create(api);window.__mediaBoard=instance;return instance;};board=v;}});});
 await p.route('**/prototype/scenarios/owner.json',r=>r.fulfill({json:fixture}));
 await p.goto(base+'prototype/index.html?scenario=owner&edit=1');await p.locator('[data-media-file="b"]').waitFor({state:'attached',timeout:5000}).catch(async e=>{console.log('BODY',await p.locator('body').innerText());console.log('BOOT',await p.evaluate(()=>({media:typeof MaxMessageMedia,author:typeof MaxAuthor,board:typeof MaxBoard})));throw e;});await p.locator('.bot-btn').first().waitFor();
 const reduced=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=2400;c.height=1200;const ctx=c.getContext('2d');ctx.fillStyle='#3971ce';ctx.fillRect(0,0,c.width,c.height);return MaxMessageMedia.readFile(new File([await new Promise(resolve=>c.toBlob(resolve,'image/png'))],'large.png',{type:'image/png'}));});assert.equal(reduced.width,1600);assert.equal(reduced.height,800);assert(reduced.src.startsWith('data:image/webp;'));
 const state=()=>p.evaluate(()=>JSON.parse(JSON.stringify(window.__mediaApi.state()))),before=await state();
 const upload=(id,path)=>p.locator('[data-media-file="'+id+'"]').setInputFiles(path);
 async function waitImage(id){await p.waitForFunction(id=>!!window.__mediaApi.state().nodes[id].image,id);}
 await upload('b','tools/fixtures/message-banner.png');await waitImage('b');const first=(await state()).nodes.b.image;assert(first.src.startsWith('data:image/'));
 assert.deepEqual(strip(await state()),strip(before));await p.locator('#flUndo').click();assert(!(await state()).nodes.b.image);await p.locator('#flRedo').click();assert.deepEqual((await state()).nodes.b.image,first);
 const choosing=p.waitForEvent('filechooser');await p.locator('[data-media-field="b"] .fl-media-drop').press('Enter');await(await choosing).setFiles('tools/fixtures/message-portrait.png');
 await p.waitForFunction(original=>window.__mediaApi.state().nodes.b.image.src!==original,first.src);assert.equal((await state()).nodes.b.image.name,'message-portrait.png');await p.locator('#flUndo').click();assert.deepEqual((await state()).nodes.b.image,first);
 // Real DataTransfer with a file, not a click on the input.
 const bytes=fs.readFileSync('tools/fixtures/message-banner.png').toString('base64');
 await p.locator('[data-media-field="u"]').evaluate((zone,bytes)=>{const data=new DataTransfer(),raw=Uint8Array.from(atob(bytes),c=>c.charCodeAt(0));data.items.add(new File([raw],'drop.png',{type:'image/png'}));zone.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:data}));if(!zone.querySelector('.is-dragover'))throw Error('No drop feedback');zone.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));},bytes);await waitImage('u');
 await upload('c','tools/fixtures/message-portrait.png');await waitImage('c');assert.deepEqual(strip(await state()),strip(before));
 const unchanged=await state();await upload('b',{name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});assert(await p.locator('[data-media-field="b"] .fl-media-error').isVisible());assert.deepEqual(await state(),unchanged);
 await p.locator('[data-media-remove="b"]').click();assert(!(await state()).nodes.b.image);await p.locator('#flUndo').click();assert.deepEqual((await state()).nodes.b.image,first);
 await p.waitForTimeout(400);await p.reload();await p.locator('.message-image').waitFor();assert((await state()).nodes.c.image);assert.deepEqual((await state()).nodes.b.image,first);
 await p.evaluate(()=>{window.__mediaApi.setView({x:30,y:100},1);window.__mediaBoard.apply();});await p.locator('[data-media-field="b"] img').evaluate(e=>e.decode());await p.screenshot({path:'audit-max/message-image-editor.png'});
 console.log('PASS upload, drop, remove/undo/redo, invalid file, draft persistence');
 const preview=p.locator('.app'),viewer=p.locator('.message-image-viewer'),boundary=p.locator('#prototypeBoundary');
 await p.locator('.message-image').first().click();assert(await viewer.isVisible());assert.equal(await viewer.locator('.message-image-viewer__count').textContent(),'1 из 1');
 const v=await viewer.boundingBox(),a=await preview.boundingBox();assert(v.x>=a.x&&v.x+v.width<=a.x+a.width+1);assert.equal(await p.locator('#flow').evaluate(e=>e.inert),false);
 for(let i=0;i<2;i++){
  for(const label of ['Перейти к сообщению','Скачать изображение']){await viewer.getByRole('button',{name:label,exact:true}).click();assert(await boundary.isVisible());await boundary.getByRole('button',{name:'Вернуться назад'}).click();assert(await viewer.isVisible());assert(!await viewer.evaluate(e=>e.inert));}
  await viewer.getByRole('button',{name:'Закрыть изображение'}).click();assert(!await viewer.isVisible());assert(await p.locator('.message-image').first().evaluate(e=>e===document.activeElement));if(!i)await p.locator('.message-image').first().click();
 }
 console.log('PASS viewer close and repeated boundary return');
 // Outgoing image in the bot conversation remains clickable.
 await p.getByRole('button',{name:'Далее',exact:true}).click();assert.equal(await p.locator('.chat-scroll .message-image').count(),2);await p.locator('.chat-scroll .message-image').last().click();assert((await viewer.textContent()).includes('Вы'));await viewer.getByRole('button',{name:'Закрыть изображение'}).click();
 // Export uses the real author ZIP path, with a deliberately isolated scenario fixture.
 const download=p.waitForEvent('download');await p.evaluate(async bundle=>MaxAuthor.exportBundle(bundle,window.__mediaApi.state()),fixture);await(await download.catch(async e=>{console.log('EXPORT STATUS',await p.locator('#authorStatus').textContent());throw e;})).saveAs('audit-max/message-media-release.zip');
 require('./zip-utils.cjs').extract('audit-max/message-media-release.zip','audit-max/message-media-release');
 // Static subpath models a GitHub Pages project prefix; no browser draft can supply the image.
 const release=await context.newPage();release.on('pageerror',e=>errors.push(e.message));await release.goto(base+'audit-max/message-media-release/index.html?scenario=owner');await release.locator('.message-image').waitFor();assert.equal(await release.locator('html').getAttribute('data-frozen'),'true');
 for(const width of [1280,390,320]){
  await release.setViewportSize({width,height:800});await release.locator('.message-image img').evaluate(e=>e.decode());
  assert(await release.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await release.screenshot({path:'audit-max/message-image-chat-'+width+'.png'});
  await release.locator('.message-image').click();await release.locator('.message-image-viewer__stage img').evaluate(e=>e.decode());
  await release.locator('.message-image-viewer img:visible').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  const geometry=await release.locator('.message-image-viewer img:visible').evaluateAll(imgs=>imgs.filter(i=>i.closest('button')).map(i=>({w:i.getBoundingClientRect().width,h:i.getBoundingClientRect().height})));assert(geometry.every(i=>i.w===24&&i.h===24));
  await release.screenshot({path:'audit-max/message-image-viewer-'+width+'.png'});
  await release.getByRole('button',{name:'Скачать изображение',exact:true}).click();await release.locator('#prototypeBoundary button').click();await release.getByRole('button',{name:'Закрыть изображение'}).click();
 }
 const imageOnly=structuredClone(fixture);imageOnly.scenario.nodes.b.text='';imageOnly.scenario.nodes.b.image=first;
 const empty=await context.newPage();empty.on('pageerror',e=>errors.push(e.message));await empty.route('**/prototype/scenarios/owner.json',r=>r.fulfill({json:imageOnly}));await empty.setViewportSize({width:390,height:844});await empty.goto(base+'prototype/index.html?scenario=owner');await empty.locator('.message-image').waitFor();assert(!await empty.locator('.has-message-image .msg-text').isVisible());assert.equal(await empty.locator('.has-message-image .message-caption').evaluate(e=>e.offsetHeight),0);await empty.close();
 // The outgoing contact message is a separate player state.
 await release.close();const contactFixture=structuredClone(fixture);contactFixture.scenario.intro.auto='c';contactFixture.scenario.nodes.c.image=(await state()).nodes.c.image;
 const contact=await context.newPage();contact.on('pageerror',e=>errors.push(e.message));await contact.route('**/prototype/scenarios/owner.json',r=>r.fulfill({json:contactFixture}));await contact.setViewportSize({width:390,height:844});await contact.goto(base+'prototype/index.html?scenario=owner');await contact.locator('.bubble--person .message-image').waitFor();await contact.locator('.message-image').click();assert(await contact.locator('.message-image-viewer').isVisible());await contact.getByRole('button',{name:'Закрыть изображение'}).click();
 assert.deepEqual(errors,[]);console.log('PASS file picker; file drag/drop and feedback; all 3 message types; remove/undo/redo; invalid file; draft reload; viewer close/repeat/boundary return; preview scoping; JSON-in-ZIP portability; static subpath; 320/390/1280px; original icon geometry; no runtime errors');
 await context.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
