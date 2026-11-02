const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('./browser.cjs');
(async()=>{const b=await chromium.launch({headless:true});try{
 const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const boundary=p.locator('#prototypeBoundary');
 async function roundTrip(selector,escape=false){
  const control=typeof selector==='string'?p.locator(selector).first():selector,url=p.url();await control.click();
  assert(await boundary.isVisible(),'Missing boundary: '+selector);
  assert.equal(await boundary.locator('h1').innerText(),'Вернёмся к сценарию?');
  assert.equal(await boundary.locator('p').innerText(),'Этот раздел не входит в текущий прототип.');
  assert.equal(await boundary.locator('button').count(),1);
  await p.keyboard.press('Tab');assert(await boundary.locator('button').evaluate(e=>e===document.activeElement));
  if(escape)await p.keyboard.press('Escape');else await boundary.getByRole('button',{name:'Вернуться назад'}).click();
  assert(!await boundary.isVisible());assert.equal(p.url(),url);
  assert.equal(await p.locator('.app>[inert],body>[inert]').count(),0);
 }
 await p.goto('http://127.0.0.1:8000/prototype/index.html?scenario=owner');await p.locator('.bot-btn').first().waitFor();
 await roundTrip('.wb-voice');await p.locator('.wb-input').fill('Текст остаётся');const history=await p.locator('.chat-scroll').textContent();
 for(const sel of ['.tb-btn.act-mobile','.wb-emoji','.wb-attach'])await roundTrip(sel);
 assert.equal(await p.locator('.wb-input').inputValue(),'Текст остаётся');assert.equal(await p.locator('.chat-scroll').textContent(),history);
 await p.locator('.wb-attach').click();await p.setViewportSize({width:360,height:800});
 await p.screenshot({path:'audit-max/boundary-selected-mobile.png'});await boundary.locator('button').click();
 await p.getByRole('button',{name:'Назад',exact:true}).click();
 for(const sel of ['.rs-design-cell','.list-add','.rs-list-search-trigger','.rs-list-bottom button:not([data-rs])'])await roundTrip(sel);
 await roundTrip('.rs-list-bottom [data-rs="calls"]');await p.locator('#cellBot').click();
 await p.locator('.tb-title').click();await roundTrip('.rs-profile-actions button:not([data-rs])');await p.locator('[data-rs="chat"]').click();
 await p.locator('.wb-input').fill('');await p.setViewportSize({width:1280,height:800});for(const sel of ['.tb-btn.act-desktop','.wb-extra','.nav-item','.list-search'])await roundTrip(sel);
 await roundTrip(p.locator('.nav-item').filter({hasText:'Звонки'}));await p.locator('.tb-title').click();await roundTrip('.rs-desktop-media button');await p.locator('[data-rs="chat"]').click();
 await p.locator('.wb-attach').click();assert.equal(await boundary.locator('.prototype-boundary__content').evaluate(e=>getComputedStyle(e).maxWidth),'800px');assert(await boundary.locator('h1').evaluate(e=>e.clientHeight<40));assert(await boundary.locator('button').evaluate(e=>e.clientWidth<300));await p.screenshot({path:'audit-max/boundary-selected-desktop.png'});await boundary.locator('button').click();
 // The same boundary stays inside the respondent preview, leaving the board usable.
 await p.goto('http://127.0.0.1:8000/prototype/index.html?scenario=owner&edit=1');await p.locator('.bot-btn').first().waitFor();await p.locator('.wb-attach').click();
 const rect=await boundary.boundingBox(),appRect=await p.locator('.app').boundingBox(),border=await p.locator('.app').evaluate(e=>({left:parseFloat(getComputedStyle(e).borderLeftWidth),right:parseFloat(getComputedStyle(e).borderRightWidth)}));assert(Math.abs(rect.x-appRect.x-border.left)<1);assert(Math.abs(rect.width-appRect.width+border.left+border.right)<1);assert.equal(await p.locator('#flow').evaluate(e=>e.inert),false);await boundary.locator('button').click();
 // Existing delayed messages continue while the boundary is shown.
 await p.goto('http://127.0.0.1:8000/prototype/index.html?scenario=employee');await p.locator('.bot-btn[data-node="greet"]').first().waitFor();await p.locator('.bot-btn[data-node="greet"]').first().click();await p.locator('#mConfirm').click();await p.locator('.wb-attach').click();await p.waitForTimeout(2200);assert(await boundary.isVisible());await boundary.locator('button').click();assert(await p.locator('.bot-btn[data-node="request_sent"]').count());
 // Payment UI actions, without changing the working scenario file.
 const fixture=JSON.parse(fs.readFileSync('prototype/scenarios/purchase.json','utf8'));const payment=Object.entries(fixture.scenario.nodes).find(([,n])=>n.type==='payment')[0];fixture.scenario.intro.auto=payment;
 await p.route('**/scenarios/purchase.json',r=>r.fulfill({json:fixture}));await p.goto('http://127.0.0.1:8000/prototype/index.html?scenario=purchase');await p.locator('#payOverlay.is-open').waitFor();
 await roundTrip('.pay-promo-btn');await roundTrip(p.getByRole('link',{name:'Условия использования',exact:true}),true);assert(await p.locator('#payOverlay').evaluate(e=>e.classList.contains('is-open')));
 await p.clock.install();await p.clock.pauseAt(new Date());await p.locator('#payPay').click();await p.locator('.pay-success:visible').waitFor();await roundTrip(p.getByRole('link',{name:'Квитанция',exact:true}));
 await p.clock.resume();await p.goto('http://127.0.0.1:8000/prototype/mail.html');
 for(const sel of ['.tab','.widget','.avatar','.help button','.btn--secondary'])await roundTrip(sel);
 await p.locator('.search__input').fill('Проверка');await p.locator('.search__input').press('Enter');assert(await boundary.isVisible());await boundary.locator('button').click();assert.equal(await p.locator('.search__input').inputValue(),'Проверка');
 await p.locator('.linkbar').click();await roundTrip('.modal__btn',true);assert(await p.locator('#maxModal').evaluate(e=>e.classList.contains('is-open')));await p.locator('.modal__close').click();
 assert.deepEqual(errors,[]);console.log('PASS selected visual/copy; UI destinations; repeat/back/Escape/focus; retained modal/profile/input; timer continuation; preview scoping; payment; mail; no page errors');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
