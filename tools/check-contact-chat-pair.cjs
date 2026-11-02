const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const geometry=require('../prototype/shared/board.js');
const source=fs.readFileSync('prototype/shared/app.js','utf8');
const add=source.slice(source.indexOf('  function addNode(kind) {'),source.indexOf('  function fitView()'));
const history=source.slice(source.indexOf('  function snapshot() {'),source.indexOf('  var trail = []'));
// Execute production commands with a measured-layout adapter; this is not a browser test.
const initial={intro:{auto:'existing'},nodes:{existing:{type:'bot',x:375,y:330,text:'Existing',buttons:[]},person_chat_1:{type:'person_chat',x:1000,y:700,message:'Keep'}}};
const clone=o=>JSON.parse(JSON.stringify(o));
const ctx={S:clone(initial),undoStack:[],redoStack:[],pendingPlacement:[],zoom:1,PERSON_MSG_DEFAULT:'Existing default text',
 viewport:{getBoundingClientRect:()=>({width:1000,height:800,left:0,top:0})},
 layer:{getBoundingClientRect:()=>({left:0,top:0}),querySelector:()=>({offsetWidth:300})},
 board:{reveal(){},notice(){}},$:()=>null,renderChrome(){},syncPreview(){},save(){}};
ctx.buildGraph=()=>{
 const size=n=>({x:n.x,y:n.y,w:300,h:n.type==='contact_modal'?1200:500});
 const moving=new Set(ctx.pendingPlacement.splice(0)),occupied=Object.entries(ctx.S.nodes).filter(([id])=>!moving.has(id)).map(([,n])=>size(n));
 for(const id of moving){const n=ctx.S.nodes[id],r=geometry.place(size(n),occupied);n.x=r.x;n.y=r.y;occupied.push(r);}
};
vm.createContext(ctx);vm.runInContext(history+add,ctx);
ctx.addNode('contact_modal');
const list=ctx.S.nodes.contact_modal_1,chat=ctx.S.nodes[list.target];
assert.equal(chat.type,'person_chat');assert.equal(list.target,'person_chat_2');assert.equal(chat.contactSource,'selected');
assert.equal(chat.message,ctx.PERSON_MSG_DEFAULT);assert.equal(chat.x,list.x+380);
assert(!geometry.overlaps({...list,w:300,h:1200},{...chat,w:300,h:500}));
assert.deepEqual(clone(ctx.S.nodes.existing),initial.nodes.existing);assert.deepEqual(clone(ctx.S.nodes.person_chat_1),initial.nodes.person_chat_1);
assert.equal(ctx.undoStack.length,1);const paired=clone(ctx.S);
ctx.undo();assert.deepEqual(clone(ctx.S),initial);ctx.redo();assert.deepEqual(clone(ctx.S),paired);
ctx.addNode('contact_modal');assert.equal(ctx.S.nodes.contact_modal_2.target,'person_chat_3');
assert.equal(Object.values(ctx.S.nodes).filter(n=>n.type==='contact_modal').length,2);
const count=Object.keys(ctx.S.nodes).length;ctx.addNode('bot');assert.equal(Object.keys(ctx.S.nodes).length,count+1);
console.log('PASS linked contact-list/chat pair; unique IDs; measured placement; existing nodes preserved; atomic undo/redo; ordinary additions unchanged (layout adapter, not browser)');
