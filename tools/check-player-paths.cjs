'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('./browser.cjs');
const app=fs.readFileSync('prototype/shared/app.js','utf8'),instrumented=app.replace("  if (document.readyState === 'loading')","  window.__playerAudit={trail:()=>trail,modal:()=>modalId,pick:()=>pickId,pay:()=>payNode};\n  if (document.readyState === 'loading')");
function exits(s,id){const n=s.nodes[id],list=[];if(n.type==='bot')(n.buttons||[]).filter(b=>b&&b.label).forEach((b,i)=>{if(b.target)list.push({from:id,to:b.target,kind:'button',index:i});});if(n.type==='modal'){for(const [key,kind]of [['confirmTarget','confirm'],['cancelTarget','cancel']])if(n[key])list.push({from:id,to:n[key],kind});}else if(n.type==='contact_modal'){if(n.target)list.push({from:id,to:n.target,kind:'contact'});}else if(n.auto&&n.type!=='external')list.push({from:id,to:n.auto,kind:n.type==='payment'?'payment':'auto'});return list;}
fs.mkdirSync('audit-max/publication',{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true});try{
 const c=await browser.newContext({viewport:{width:1280,height:900}}),p=await c.newPage(),errors=[],rows=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/prototype/index.html*',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync('prototype/index.html')}));
 await p.route('**/shared/app.js',r=>r.fulfill({contentType:'text/javascript',body:instrumented}));
 await p.addInitScript(()=>{window.__openedAudit=[];window.open=url=>{window.__openedAudit.push(url);return null;};});await p.clock.install();
 for(const id of ['owner','employee','purchase']){
  const s=JSON.parse(fs.readFileSync('prototype/scenarios/'+id+'.json')).scenario,paths=new Map([[s.intro.auto,[]]]),queue=[s.intro.auto];
  for(let i=0;i<queue.length;i++)for(const e of exits(s,queue[i]))if(!paths.has(e.to)){paths.set(e.to,[...paths.get(e.from),e]);queue.push(e.to);}
  async function marker(target){const type=s.nodes[target].type;await p.waitForFunction(({target,type})=>{const a=window.__playerAudit;if(!a)return false;if(type==='external')return window.__openedAudit.length>0;if(type==='modal')return a.modal()===target;if(type==='contact_modal')return a.pick()===target;if(type==='payment')return a.pay()===target;if(type==='toast')return document.getElementById('toast').classList.contains('is-open');return a.trail().includes(target);},{target,type});}
  async function act(e){
   const n=s.nodes[e.from];
   if(e.kind==='button')await p.locator('.bot-btn[data-node="'+e.from+'"][data-index="'+e.index+'"]').click();
   if(e.kind==='confirm'||e.kind==='cancel')await p.locator(e.kind==='confirm'?'#mConfirm':'#mCancel').click();
   if(e.kind==='contact')await p.locator('#pickList [data-pick]').first().click();
   if(e.kind==='payment'){await p.locator('#payPay').click();await p.clock.runFor((n.successDelay??6000)+1);}
   if(e.kind==='auto')await p.clock.runFor((n.type==='toast'?450:n.autoDelay??s.autoDelay??700)+1);
   await marker(e.to);
  }
  let passed=0;
  for(const source of paths.keys())for(const edge of exits(s,source)){
   await p.goto('http://127.0.0.1:8000/prototype/index.html?scenario='+id);await p.waitForFunction(()=>!!window.__playerAudit);await p.clock.runFor(260);await marker(s.intro.auto);
   for(const step of [...paths.get(source),edge])await act(step);
   rows.push({scenario:id,source,target:edge.to,kind:edge.kind,status:'passed',fromStart:true});passed++;
  }
  rows.push({scenario:id,status:'reachability',reachable:paths.size,total:Object.keys(s.nodes).length,unreachable:Object.keys(s.nodes).filter(n=>!paths.has(n))});console.log('PASS full routes from start:',id,passed,'edges;',paths.size,'reachable nodes (browser virtual time, original delays retained)');
 }
 fs.writeFileSync('audit-max/publication/player-paths.json',JSON.stringify({rows,errors,clock:'Playwright browser virtual time'},null,2));assert.deepEqual(errors,[]);await c.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
