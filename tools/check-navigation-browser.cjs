'use strict';
// Browser-generated and synthetic input only; not a physical-device certification.
// Route the source files in-process, so this suite needs no preview server.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('./browser.cjs');
const root=path.resolve(__dirname,'../prototype'),out=path.resolve(__dirname,'../audit-max/navigation');
const near=(a,b,message)=>assert(Math.abs(a-b)<.01,message+': '+a+' vs '+b);
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true});
  await context.route('https://max.test/**',async route=>{const p=path.resolve(root,'.'+new URL(route.request().url()).pathname);if(!p.startsWith(root+path.sep)||!fs.existsSync(p))return route.fulfill({status:404,body:''});const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};await route.fulfill({body:fs.readFileSync(p),contentType:mime[path.extname(p)]||'application/octet-stream'});});
  await context.addInitScript(()=>{let board;Object.defineProperty(window,'MaxBoard',{configurable:true,get:()=>board,set:value=>{const create=value.create;value.create=api=>{window.__navigation={api,snapshots:0,saves:0};for(const [name,count]of [['snapshot','snapshots'],['save','saves']]){const original=api[name];api[name]=(...args)=>{window.__navigation[count]++;return original(...args);};}const instance=create(api);window.__navigation.board=instance;return instance;};board=value;}});});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('https://max.test/index.html?scenario=owner&edit=1');await p.locator('.editor-toolbar').waitFor();await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
  const camera=()=>p.evaluate(()=>{const {pan,zoom}=__navigation.api.view();return {x:pan.x,y:pan.y,z:zoom};});
  const state=()=>p.evaluate(()=>({data:JSON.stringify(__navigation.api.state()),snapshots:__navigation.snapshots,saves:__navigation.saves,storage:JSON.stringify({...localStorage})}));
  const baseline=await state();
  assert.equal(await p.locator('#boardResetZoom,#boardFit').count(),0);
  const dockOrder=await p.locator('.zoom-dock').evaluate(el=>[...el.children].map(child=>({label:child.getAttribute('aria-label'),y:child.getBoundingClientRect().y})));
  assert.deepEqual(dockOrder.map(item=>item.label),['Увеличить доску','Масштаб доски','Уменьшить доску']);assert(dockOrder[0].y<dockOrder[1].y&&dockOrder[1].y<dockOrder[2].y);
  async function wheel(selector,event={},fresh=true){if(fresh)await p.waitForTimeout(110);return p.locator(selector).first().evaluate((el,event)=>{const r=el.getBoundingClientRect(),e=new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,...event});el.dispatchEvent(e);return e.defaultPrevented;},event);}
  async function toZoom(z){const b=await camera();await wheel('#flView',{ctrlKey:true,deltaY:-Math.log(z/b.z)/.002});near((await camera()).z,z,'requested zoom');}
  async function safeArea(){return p.locator('#flView').evaluate(el=>{const r=el.getBoundingClientRect(),bar=document.querySelector('.editor-toolbar').getBoundingClientRect(),bottom=Math.min(...['.node-palette-inner','.zoom-dock'].map(s=>document.querySelector(s).getBoundingClientRect().top))-12;return{x:r.x,y:bar.bottom+12,width:r.width,height:bottom-bar.bottom-12,cx:r.x+r.width/2,cy:(bar.bottom+12+bottom)/2};});}
  async function center(){const a=await safeArea(),c=await camera(),r=await p.locator('#flView').boundingBox();return{x:(a.cx-r.x-c.x)/c.z,y:(a.cy-r.y-c.y)/c.z,z:c.z};}
  for(const z of [.25,1,2.5]){
   await toZoom(z);
   for(const mode of [0,1,2])for(const event of [{deltaY:5},{deltaX:7},{deltaX:3,deltaY:5},{shiftKey:true,deltaY:5},{shiftKey:true,deltaX:7,deltaY:5},{altKey:true,deltaY:5}]){
    const a=await safeArea(),b=await camera();await wheel('#flView',{...event,deltaMode:mode});const c=await camera();let dx=(event.deltaX||0)*(mode===1?16:mode===2?a.width:1),dy=(event.deltaY||0)*(mode===1?16:mode===2?a.height:1);if(event.shiftKey){dx=dx||dy;dy=0;}near(c.x,b.x-dx,'pan X');near(c.y,b.y-dy,'pan Y');near(c.z,b.z,'plain wheel must not zoom');
   }
  }
  for(const mod of ['ctrlKey','metaKey']){
   await toZoom(1);const r=await p.locator('#flView').boundingBox(),x=r.x+210,y=r.y+300,b=await camera(),w={x:(210-b.x)/b.z,y:(300-b.y)/b.z};assert(await wheel('#flView',{[mod]:true,deltaY:-150,clientX:x,clientY:y}));const c=await camera();near(w.x*c.z+c.x,210,'zoom X anchor');near(w.y*c.z+c.y,300,'zoom Y anchor');
  }
  for(const [limit,dy]of [[.08,100000],[2.5,-100000]]){await wheel('#flView',{ctrlKey:true,deltaY:dy});near((await camera()).z,limit,'zoom bound');const b=await camera();await wheel('#flView',{ctrlKey:true,deltaY:dy});assert.deepEqual(await camera(),b);await wheel('#flView',{ctrlKey:true,deltaY:-Math.sign(dy)});assert.notEqual((await camera()).z,limit);}
  console.log('PASS browser wheel: axes, modifiers, deltaMode, anchor, exact limits and immediate reversal');
  await toZoom(1);
  // DOM-only content supplies scroll range without editing research data.
  await p.locator('.chat-scroll').evaluate(el=>{const filler=document.createElement('div');filler.style.height='3000px';filler.dataset.testFiller='';el.append(filler);el.scrollTop=80;});
  const geometry=()=>p.evaluate(()=>{const selectors=['.app','.chat-scroll','.tb-avatar','.wb-input','.editor-toolbar','.zoom-dock'];return selectors.map(s=>{const el=document.querySelector(s),r=el.getBoundingClientRect();return{s,x:r.x,y:r.y,w:r.width,h:r.height,font:getComputedStyle(el).fontSize,scroll:el.scrollTop};});});
  const preview=await geometry();for(const z of [.25,1,2.5]){await toZoom(z);assert.deepEqual(await geometry(),preview);}
  for(const selector of ['.chat-scroll','.chat-list']){
   if(selector==='.chat-list')await p.locator('.app').evaluate(el=>el.classList.add('is-chat-list'));
   const el=p.locator(selector);await el.evaluate(el=>{const f=document.createElement('div');f.style.height='3000px';el.append(f);el.scrollTop=10;});const r=await el.boundingBox(),b=await camera();await p.waitForTimeout(110);await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.wheel(0,180);await p.waitForTimeout(180);assert(await el.evaluate(el=>el.scrollTop>10));assert.deepEqual(await camera(),b);
   await el.evaluate(el=>el.scrollTop=el.scrollHeight);await p.mouse.wheel(0,500);await p.waitForTimeout(150);assert.deepEqual(await camera(),b);
   if(selector==='.chat-list')await p.locator('.app').evaluate(el=>el.classList.remove('is-chat-list'));
  }
  for(const selector of ['#shareModal','#pickOverlay','#payOverlay']){
   await p.locator(selector).evaluate(el=>el.classList.add('is-open'));const scroll=selector==='#shareModal'?'#shareModal .modal':selector==='#pickOverlay'?'.pick-list':'.pay-scroll';
   await p.locator(scroll).evaluate(el=>{el.style.maxHeight='180px';el.style.overflowY='auto';const f=document.createElement('div');f.style.height='2400px';el.append(f);el.scrollTop=20;});
   const b=await camera(),r=await p.locator(scroll).boundingBox();await p.waitForTimeout(110);await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.wheel(0,100);await p.waitForTimeout(150);assert(await p.locator(scroll).evaluate(el=>el.scrollTop>20));assert.deepEqual(await camera(),b);
   for(const mod of ['ctrlKey','metaKey']){assert(await wheel(scroll,{[mod]:true,deltaY:-100}));assert.deepEqual(await camera(),b);}
   await p.locator(scroll).evaluate(el=>el.scrollTop=el.scrollHeight);await p.mouse.wheel(0,500);await p.waitForTimeout(150);assert.deepEqual(await camera(),b);await p.locator(selector).evaluate(el=>el.classList.remove('is-open'));
  }
  assert.equal(await p.evaluate(()=>scrollX||scrollY||document.documentElement.scrollTop),0);
  console.log('PASS preview dimensions/fonts/controls/scroll independent at 25/100/250%; native chat/list/dialog scroll and edge containment');
  const ui=require('./board-test-helpers.cjs')(p),area=p.locator('[data-path="nodes.greet.text"]');await toZoom(1);await ui.focus(area,300,300);await area.evaluate(el=>{el.value='Long text\n'.repeat(200);el.scrollTop=0;});await p.waitForTimeout(110);const ar=await area.boundingBox(),b=await camera();await p.mouse.move(ar.x+ar.width/2,ar.y+ar.height/2);await p.mouse.wheel(0,200);await p.waitForTimeout(150);assert.equal(await area.evaluate(el=>el.scrollTop),0);near((await camera()).y,b.y-200,'textarea hover pans board');near((await camera()).z,b.z,'textarea hover preserves zoom');await area.evaluate(el=>el.scrollTop=el.scrollHeight);const edgeCamera=await camera();await p.mouse.wheel(0,400);await p.waitForTimeout(150);near((await camera()).y,edgeCamera.y-400,'textarea edge still pans board');
  assert(await wheel('[data-path="nodes.greet.text"]',{ctrlKey:true,deltaY:-80}));assert((await camera()).z>b.z);
  const number=p.locator('input[type=number]').first();if(await number.count()){const value=await number.inputValue();assert(await wheel('input[type=number]',{ctrlKey:true,deltaY:-80}));assert.equal(await number.inputValue(),value);}
  const type=p.locator('[data-type="greet"]');await ui.focus(type,300,300);await type.click();const t=await camera();await p.keyboard.press('Escape');assert.deepEqual(await camera(),t);
  console.log('PASS textarea hover/edge pans board, explicit zoom over field/number, native select');
  await p.locator('#flView').focus();for(const mode of ['Схема','Схема + превью']){const b=await center();await p.getByRole('radio',{name:mode,exact:true}).click();await p.waitForTimeout(100);const c=await center();near(c.x,b.x,'view center X');near(c.y,b.y,'view center Y');near(c.z,b.z,'view scale');}
  const c=await center();await p.getByRole('radio',{name:'Превью',exact:true}).click();await p.setViewportSize({width:1440,height:900});await p.getByRole('radio',{name:'Схема + превью',exact:true}).click();await p.waitForTimeout(120);const c2=await center();near(c.x,c2.x,'hidden/resize center X');near(c.y,c2.y,'hidden/resize center Y');near(c.z,c2.z,'hidden scale');
  for(const selector of ['[aria-label="Увеличить доску"]','[aria-label="Уменьшить доску"]']){const b=await center();await p.locator(selector).click();const c=await center();near(c.x,b.x,'button center X');near(c.y,b.y,'button center Y');}
  await p.evaluate(()=>__navigation.board.fit());const a=await safeArea(),bbox=await p.locator('.fl-node').evaluateAll(es=>{const rs=es.map(e=>e.getBoundingClientRect());return{left:Math.min(...rs.map(r=>r.left)),right:Math.max(...rs.map(r=>r.right)),top:Math.min(...rs.map(r=>r.top)),bottom:Math.max(...rs.map(r=>r.bottom))};});near((bbox.left+bbox.right)/2,a.cx,'fit center X');near((bbox.top+bbox.bottom)/2,a.cy,'fit center Y');assert(bbox.top>=a.y-1&&bbox.bottom<=a.y+a.height+1);
  assert.deepEqual(await state(),baseline,'navigation must not mutate data, storage, save state or undo history');console.log('PASS view/resize/button centers and fit; JSON, undo and draft unchanged');
  // Text entry remains native; inspect it after the navigation-only immutability check.
  await toZoom(1);await ui.focus(area,300,300);await area.click();await p.waitForTimeout(50);const typed=await area.inputValue(),typingCamera=await camera();await p.keyboard.press('End');await p.keyboard.press('Space');assert.equal((await area.inputValue()).length,typed.length+1);assert.deepEqual(await camera(),typingCamera);await p.locator('#flView').focus();
  // A crossing tail is absorbed; a short pause starts the next intentional action.
  await wheel('.app',{deltaY:10});const lock=await camera();assert(await wheel('#flView',{deltaY:100},false));assert.deepEqual(await camera(),lock);await wheel('#flView',{deltaY:100});near((await camera()).y,lock.y-100,'released wheel sequence');
  const gesture=(selector,type,scale,xy={})=>p.locator(selector).evaluate((el,{type,scale,xy})=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.assign(e,{scale,...xy});el.dispatchEvent(e);return e.defaultPrevented;},{type,scale,xy});
  await toZoom(1);const g=await camera();assert(await gesture('#flView','gesturestart',1));await gesture('.app','gesturechange',1.2);near((await camera()).z,g.z*1.2,'Safari owner retained');const once=await camera();await wheel('#flView',{ctrlKey:true,deltaY:-100},false);assert.deepEqual(await camera(),once);await gesture('.app','gestureend',1.2);
  await gesture('#shareModal','gesturestart',1);const gb=await camera();await gesture('#flView','gesturechange',2);assert.deepEqual(await camera(),gb);await gesture('#flView','gesturecancel',2);await wheel('#flView',{deltaY:10});near((await camera()).y,gb.y-10,'cancel releases gesture');
  await gesture('#flView','gesturestart',1);await p.evaluate(()=>dispatchEvent(new Event('blur')));await wheel('#flView',{deltaY:10});near((await camera()).y,gb.y-20,'blur releases gesture');console.log('PASS synthetic Safari gesture ownership/deduplication/cancel/blur and wheel sequence boundaries');
  // New autonomous exports must execute the same navigation with no network dependency.
  const [download]=await Promise.all([p.waitForEvent('download'),p.locator('#flDownload').click()]);const file=path.join(out,'owner.html');await download.saveAs(file);const offline=await context.newPage();await offline.goto(pathToFileURL(file).href);await offline.frameLocator('#screen iframe').locator('.editor-toolbar').waitFor();const frame=offline.frames().find(f=>f.parentFrame());await frame.waitForTimeout(300);
  const old=await frame.locator('#flLayer').evaluate(el=>el.style.transform);await frame.locator('#flView').evaluate(el=>el.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaX:10,deltaY:20})));const next=await frame.locator('#flLayer').evaluate(el=>el.style.transform);assert.notEqual(next,old);assert.equal(new DOMMatrixShim(old).z,new DOMMatrixShim(next).z);await offline.close();
  assert.deepEqual(errors,[]);console.log('PASS fresh autonomous HTML pans without zoom; no runtime errors');await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
// Inline style is translate(Xpx,Ypx) scale(Z); compare the unrounded internal scale.
function DOMMatrixShim(style){this.z=Number(style.match(/scale\(([^)]+)\)/)[1]);}
