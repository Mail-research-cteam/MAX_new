const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('./browser.cjs');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8000/prototype/';
(async()=>{const browser=await chromium.launch({headless:true});try{
 const c=await browser.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const ui=require('./board-test-helpers.cjs')(p);
 async function ready(){await p.locator('#boardZoom').waitFor();await p.waitForTimeout(180);}
 async function focusPoint(locator,x=150,y=200){await ui.focus(locator,x,y);}
 for(const mode of ['small','normal','large']){
   await p.goto(base+'index.html?scenario=employee&edit=1');await ready();await ui.zoomTo(1);
   if(mode==='small')for(let i=0;i<12;i++)await p.getByRole('button',{name:'Уменьшить доску',exact:true}).click();
   if(mode==='large')for(let i=0;i<5;i++)await p.getByRole('button',{name:'Увеличить доску',exact:true}).click();
   const port=p.locator('[data-port="auto:__intro"]');await focusPoint(port);let r=await port.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.mouse.move(r.x+50,r.y+30);
   const dest=p.locator('.fl-node[data-id="contact_sent"] .fl-head');await ui.dragTarget(dest);r=await dest.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.waitForTimeout(30);assert(await dest.locator('..').evaluate(e=>e.classList.contains('is-drop')));await p.mouse.up();
   assert(await p.locator('#boardEdgeList option[value="auto:__intro"]').textContent().then(s=>s.includes('contact_sent')));
   // Releasing a link on empty board must preserve the existing exit.
   await focusPoint(port);r=await port.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();const v=await p.locator('#flView').boundingBox();await p.mouse.move(v.x+20,v.y+v.height-20);await p.mouse.up();assert((await p.locator('#boardEdgeList option[value="auto:__intro"]').textContent()).includes('contact_sent'));
   console.log('PASS drag connection, edge auto-pan while linking, target highlight, failed drop:',mode);
 }
 // Fixture is loaded at the scenario boundary, never into production scenario files.
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'prototype/scenarios/owner.json'),'utf8'));fixture.id='editor-worst';fixture.title='Проверка больших карточек и конфликтов';
 delete fixture.scenario.nodes.greet.x;fixture.scenario.nodes.share_modal.x=null;fixture.scenario.nodes.share_modal.y=null;
 for(let i=0;i<100;i++)fixture.scenario.nodes['stress_'+i]={type:'bot',x:40,y:40,text:i%3===0?'Проверка приглашения пользователя с адресом bartholomew.fitzgerald@northwind-industries-holdings.example.com':'Проверка совместного доступа, отложенного подтверждения и повторного приглашения сотрудника.',buttons:Array.from({length:i%5},(_,j)=>({label:'Действие '+(j+1)+' для участника исследовательской группы',target:''}))};
 fs.mkdirSync(path.join(root,'tools/fixtures'),{recursive:true});fs.writeFileSync(path.join(root,'tools/fixtures/editor-worst.json'),JSON.stringify(fixture,null,2));
 await p.goto(base+'index.html?scenario=owner&edit=1');await ready();await p.evaluate(b=>localStorage.setItem('max-saved:1:/prototype/:'+b.id,JSON.stringify(b)),fixture);await p.goto(base+'index.html?scenario=editor-worst&edit=1');await ready();assert.equal(await p.locator('.fl-node').count(),130);
 await p.locator('#boardArrange').click();
 const collisions=await p.locator('#flLayer').evaluate(el=>{const rs=[...el.querySelectorAll('.fl-node')].map(n=>({x:n.offsetLeft,y:n.offsetTop,w:n.offsetWidth,h:n.offsetHeight}));return rs.flatMap((a,i)=>rs.slice(i+1).filter(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y));});assert.equal(collisions.length,0);console.log('PASS 130 cards, missing/null/duplicate coordinates, measured repair');
 // Actual default scrolling in a long textarea; wheel must not move the board.
 const area=p.locator('[data-path="nodes.greet.text"]');await area.fill(('Дополнительные условия исследования и подробное описание работы с приглашением.\n').repeat(30));await ui.zoomTo(1);await focusPoint(area,300,250);const ar=await area.boundingBox();await p.mouse.move(ar.x+ar.width/2,ar.y+ar.height/2);const transform=await p.locator('#flLayer').getAttribute('style');await p.mouse.wheel(0,220);await p.waitForTimeout(100);assert(await area.evaluate(el=>el.scrollTop>0));assert.equal(await p.locator('#flLayer').getAttribute('style'),transform);console.log('PASS real wheel scrolls textarea without board zoom or pan');
 await p.locator('#boardArrange').click();const before=await p.locator('.fl-node[data-id="greet"]').evaluate(el=>[el.offsetLeft,el.offsetTop]);await p.reload();await ready();assert.deepEqual(await p.locator('.fl-node[data-id="greet"]').evaluate(el=>[el.offsetLeft,el.offsetTop]),before);console.log('PASS repaired layout survives reload');
 // A changed source file is simulated by a fetch route; old draft remains backed up.
 await p.goto(base+'index.html?scenario=employee&edit=1');await ready();await p.locator('[data-path="nodes.greet.text"]').fill('Тестовый черновик — только отдельный профиль проверки');await p.waitForTimeout(400);
 const changed=JSON.parse(fs.readFileSync(path.join(root,'prototype/scenarios/employee.json'),'utf8'));changed.scenario.nodes.greet.text='Обновлённый исходный файл — тест';await p.route('**/scenarios/employee.json',r=>r.fulfill({json:changed}));let warned=false;p.once('dialog',async d=>{warned=true;await d.dismiss();});await p.reload();await ready();assert(warned);assert.equal(await p.locator('[data-path="nodes.greet.text"]').inputValue(),changed.scenario.nodes.greet.text);assert(await p.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('employee:1:backup'))));console.log('PASS changed file detected, old draft backed up without deletion');
 await p.screenshot({path:path.join(root,'audit-max/board-stress.png')});assert.deepEqual(errors,[]);console.log('PASS stress checks have no runtime errors');
 await c.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
