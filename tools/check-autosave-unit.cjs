'use strict';
const assert=require('node:assert/strict'),{controller,INTERVAL}=require('../prototype/shared/autosave.js');
function file(initial=''){
 let text=initial,writes=0,fail=false,pause=null;
 return {name:'owner.json',getFile:async()=>({text:async()=>text}),queryPermission:async()=> 'granted',
  async createWritable(){writes++;let next;return {async write(value){if(pause)await pause;if(fail)throw Error('Disk full');next=value;},async close(){text=next;},async abort(){}};},
  get text(){return text;},get writes(){return writes;},external(value){text=value;},fail(){fail=true;},pause(value){pause=value;}};
}
(async()=>{
 assert.equal(INTERVAL,120000);let state={text:'first'},events=[];
 const f=file(),s=controller({get:()=>state,build:async value=>JSON.stringify(value),notify:(...x)=>events.push(x)});
 assert.equal(await s.save(),false);assert.equal(f.writes,0,'never writes before picker selection');
 await s.attach(f,()=>{});assert.equal(await s.save(),true);assert.equal(f.text,JSON.stringify(state));
 assert.equal(await s.save(),false);assert.equal(f.writes,1,'unchanged data is skipped');
 state.text='second';let release;f.pause(new Promise(r=>release=r));
 const one=s.save(),two=s.save();assert.equal(one,two,'only one writer at a time');
 await new Promise(r=>setImmediate(r));state.text='third';release();await one;
 assert.equal(f.text,JSON.stringify({text:'second'}),'write uses a snapshot');
 assert.notEqual(events.at(-1)[0],'clean','new edits during write remain dirty');
 f.pause(null);await s.save();assert.equal(f.text,JSON.stringify(state));assert.equal(events.at(-1)[0],'clean');
 f.external('External edit');state.text='fourth';assert.equal(await s.save(),false);assert.equal(f.text,'External edit');assert.equal(s.active(),false);
 const broken=file();await s.attach(broken,()=>{});broken.fail();assert.equal(await s.save(),false);assert.equal(broken.text,'');assert.equal(s.active(),false);
 const denied=file();denied.queryPermission=async()=> 'denied';await s.attach(denied,()=>{});assert.equal(await s.save(),false);assert.equal(denied.writes,0);
 let rejected=false;try{await s.attach(file('wrong scenario'),()=>{throw Error('Wrong scenario');});}catch{rejected=true;}assert.ok(rejected);assert.equal(s.active(),false);
 const stopped=file();await s.attach(stopped,()=>{});s.stop();assert.equal(await s.save(),false);assert.equal(stopped.writes,0);
 console.log('PASS autosave: 120s, explicit selection, unchanged skip, serialized snapshots, in-flight edits, external conflict, disk failure, permission denial, validation and stop');
})().catch(e=>{console.error(e);process.exitCode=1;});
