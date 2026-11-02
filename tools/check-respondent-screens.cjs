const assert=require('node:assert/strict');
const {chromium}=require('./browser.cjs');
async function settledImages(p){
 await p.locator('.respondent-screen:visible img,.chat-list-panel:visible img').evaluateAll(async imgs=>{
  await Promise.all(imgs.map(async img=>{await img.decode();if(!img.naturalWidth)throw Error('Broken image: '+img.src);}));
 });
}
(async()=>{
 const b=await chromium.launch({headless:true,ignoreDefaultArgs:['--hide-scrollbars']});
 try{
  const p=await b.newPage({viewport:{width:360,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8000/prototype/index.html?scenario=owner');await p.locator('.bot-btn').first().waitFor();
  const input=p.getByRole('textbox',{name:'Сообщение',exact:true});await input.fill('Проверка настоящего поля');
  assert.equal(await input.inputValue(),'Проверка настоящего поля');assert.equal(await input.evaluate(e=>e.tagName),'INPUT');
  assert(parseFloat(await input.evaluate(e=>getComputedStyle(e).fontSize))>=16);
  const history=await p.locator('.chat-scroll').textContent();await p.getByRole('button',{name:'Назад',exact:true}).click();
  assert(await p.locator('#cellBot').isVisible());await settledImages(p);await p.screenshot({path:'audit-max/figma-list-implemented.png'});
  await p.locator('.rs-list-bottom [data-rs="calls"]').click();assert(await p.locator('#prototypeBoundary').isVisible());await p.locator('#prototypeBoundary button').click();await p.locator('#cellBot').click();
  assert.equal(await p.locator('.chat-scroll').textContent(),history);assert.equal(await input.inputValue(),'Проверка настоящего поля');
  await p.locator('.tb-title').click();assert(await p.getByRole('heading',{name:'vktech_adminmail_bot',exact:true}).isVisible());await settledImages(p);await p.screenshot({path:'audit-max/figma-bot-implemented.png'});
  await p.locator('[data-rs="chat"]').click();assert.equal(await p.locator('.chat-scroll').textContent(),history);
  for(const width of [320,390,768,1280]){
   await p.setViewportSize({width,height:800});await p.locator('.tb-title').click();await settledImages(p);
   assert(await p.locator('.respondent-screen').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Profile overflow at '+width);
   if(width===1280){await p.screenshot({path:'audit-max/figma-bot-desktop-implemented.png'});await p.locator('#cellBot').click();assert(!await p.locator('.respondent-screen').isVisible());}
   else await p.locator('[data-rs="chat"]').click();
  }
  assert.deepEqual(errors,[]);console.log('PASS: real input; decoded local assets; chat/draft preservation; calls boundary/back; bot profiles; 320/390/768/1280px; no page errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
