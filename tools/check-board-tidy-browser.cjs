const assert=require('node:assert/strict');
const {chromium}=require('./browser.cjs');
const strip=v=>Array.isArray(v)?v.map(strip):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>k!=='x'&&k!=='y').map(([k,v])=>[k,strip(v)])):v;
(async()=>{const browser=await chromium.launch({headless:true});try{
 const p=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{let board;Object.defineProperty(window,'MaxBoard',{configurable:true,get:()=>board,set:value=>{const create=value.create;value.create=function(api){window.__testBoardApi=api;return create(api);};board=value;}});});
 for(const scenario of ['owner','employee','purchase']){
  await p.goto('http://127.0.0.1:8000/prototype/index.html?scenario='+scenario+'&edit=1');await p.locator('#boardArrange').waitFor();await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(180);
  const overlap=await p.locator('#boardArrange').getAttribute('data-overlaps');console.log('Initial manual layout overlaps:',scenario,overlap);
  const before=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__testBoardApi.state()))),view=await p.locator('#flLayer').evaluate(e=>e.style.transform);
  await p.getByRole('button',{name:'Навести порядок',exact:true}).click();
  const after=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__testBoardApi.state())));assert.deepEqual(strip(after),strip(before));
  assert.equal(await p.locator('#flLayer').evaluate(e=>e.style.transform),view);
  const rects=await p.locator('.fl-node').evaluateAll(es=>es.map(e=>({id:e.dataset.id,x:e.offsetLeft,y:e.offsetTop,w:e.offsetWidth,h:e.offsetHeight})));
  for(let i=0;i<rects.length;i++)for(const b of rects.slice(i+1)){const a=rects[i];assert(!(a.x<b.x+b.w+35&&a.x+a.w+35>b.x&&a.y<b.y+b.h+35&&a.y+a.h+35>b.y),'Overlap '+a.id+'/'+b.id);}
  await p.getByRole('button',{name:'Навести порядок',exact:true}).click();assert.deepEqual(await p.evaluate(()=>JSON.parse(JSON.stringify(window.__testBoardApi.state()))),after);
  await p.locator('#flUndo').click();assert.deepEqual(await p.evaluate(()=>JSON.parse(JSON.stringify(window.__testBoardApi.state()))),before);
  await p.locator('#flRedo').click();assert.deepEqual(await p.evaluate(()=>JSON.parse(JSON.stringify(window.__testBoardApi.state()))),after);
  await p.screenshot({path:'audit-max/tidy-'+scenario+'.png'});console.log('PASS measured layout, state preservation, stable repeat, unchanged zoom, undo/redo:',scenario);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
