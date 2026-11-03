'use strict';
// Execute the production event router with model event targets and a virtual clock.
// This checks routing/state transitions, not browser scrolling or a physical trackpad.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const board=require('../prototype/shared/board.js'),source=fs.readFileSync('prototype/shared/board.js','utf8');
class Target{
 constructor(selectors=[],parent=null){this.selectors=new Set(selectors);this.parent=parent;this.listeners=new Map();}
 closest(selector){for(let el=this;el;el=el.parent)if(selector.split(',').some(s=>el.selectors.has(s)))return el;return null;}
 contains(el){for(;el;el=el.parent)if(el===this)return true;return false;}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
 emit(type,options={}){const e={target:this,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,deltaX:0,deltaY:0,deltaMode:0,clientX:250,clientY:200,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...options};for(const fn of this.listeners.get(type)||[])fn(e);return e;}
}
const document=new Target(),window=new Target(),flow=new Target(['#flow']),viewport=new Target([],flow),area=new Target(['textarea'],viewport),select=new Target(['select'],viewport),app=new Target(['.app']),modal=new Target(['#shareModal']),previewField=new Target(['input'],app),tool=new Target([],flow);
let editing=true,time=1000,timers=new Map(),timer=0;
document.body={classList:{contains:()=>editing}};
let view={pan:{x:40,y:20},zoom:1},cancels=0;
const context={Element:Target,document,window,viewport,performance:{now:()=>time},setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),
 bounds:()=>({left:100,top:50,right:900,bottom:650,width:800,height:600}),local:p=>({x:p.x-100,y:p.y-50}),
 available:()=>({width:800,height:600,cx:400,cy:300}),api:{view:()=>view},setView:(pan,zoom)=>{view=structuredClone({pan,zoom});},
 zoom:(factor,reset,anchor)=>{const n=board.zoomAt(anchor||{x:400,y:300},view.pan,view.zoom,reset?1:view.zoom*factor);view={pan:n.pan,zoom:n.zoom};},
 wheelDelta:board.wheelDelta,cancel:()=>{cancels++;context.drag=null;context.link=null;},drag:null,link:null,captured:null,space:false};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('    const previewSelector='),source.indexOf("    window.addEventListener('keydown'")),context);
const before=()=>structuredClone(view),wheel=(target,options={})=>document.emit('wheel',{target,...options}),pause=()=>{time+=101;},reset=()=>{window.emit('blur');view={pan:{x:40,y:20},zoom:1};pause();};
for(const z of [.08,.25,1,2.5])for(const mode of [0,1,2]){
 reset();view.zoom=z;const b=before(),sx=mode===1?16:mode===2?800:1,sy=mode===1?16:mode===2?600:1;
 assert(wheel(viewport,{deltaX:3,deltaY:7,deltaMode:mode}).defaultPrevented);assert.deepEqual(view,{pan:{x:b.pan.x-3*sx,y:b.pan.y-7*sy},zoom:z});
}
for(const [event,expected]of [[{deltaY:20},{x:40,y:0}],[{deltaX:20},{x:20,y:20}],[{shiftKey:true,deltaY:20},{x:20,y:20}],[{shiftKey:true,deltaX:20,deltaY:20},{x:20,y:20}],[{altKey:true,deltaY:20},{x:40,y:0}]]){reset();wheel(viewport,event);assert.deepEqual(view.pan,expected);assert.equal(view.zoom,1);}
console.log('PASS router: both pan axes, diagonal, Shift without double delta, Alt, all deltaMode units at four scales');
for(const target of [viewport,area,select])for(const mod of ['ctrlKey','metaKey']){
 reset();const b=before(),point={x:150,y:150},world=board.world(point,b.pan,b.zoom);
 assert(wheel(target,{[mod]:true,deltaY:-91}).defaultPrevented);assert(view.zoom>1);const after=board.world(point,view.pan,view.zoom);assert(Math.abs(world.x-after.x)<1e-9&&Math.abs(world.y-after.y)<1e-9);
}
for(const target of [app,previewField,modal,tool,area,select]){
 reset();const b=before();assert.equal(wheel(target,{deltaY:90}).defaultPrevented,false);assert.deepEqual(view,b);
 if(target!==area&&target!==select){pause();assert(wheel(target,{ctrlKey:true,deltaY:-90}).defaultPrevented);assert.deepEqual(view,b);}
}
console.log('PASS router: explicit zoom over board fields; native field/select/preview scroll and portalled preview zoom suppression');
reset();wheel(app,{deltaY:90});const b=before();assert(wheel(viewport,{deltaY:90}).defaultPrevented);assert.deepEqual(view,b);pause();wheel(viewport,{deltaY:90});assert.equal(view.pan.y,b.pan.y-90);
reset();wheel(viewport,{deltaY:90});assert(wheel(app,{deltaY:90}).defaultPrevented);document.emit('pointerdown',{target:app});assert.equal(wheel(app,{deltaY:90}).defaultPrevented,false);document.emit('pointerup');
reset();document.emit('pointerdown',{target:app});assert(wheel(viewport,{deltaY:90}).defaultPrevented);assert.deepEqual(view,{pan:{x:40,y:20},zoom:1});document.emit('pointerup');
reset();wheel(area,{deltaY:90});assert(wheel(area,{ctrlKey:true,deltaY:-90}).defaultPrevented);assert(view.zoom>1,'modifier starts an explicit new intent without waiting');
console.log('PASS router: crossing tail suppressed, short idle/click releases ownership; preview pointer does not transfer to board');
function gesture(type,target,scale,coords={}){return document.emit(type,{target,scale,...coords});}
reset();assert(gesture('gesturestart',viewport,1).defaultPrevented);gesture('gesturechange',viewport,1.2);assert.equal(view.zoom,1.2);const g=before();wheel(viewport,{ctrlKey:true,deltaY:-100});assert.deepEqual(view,g,'Safari wheel duplicate');gesture('gesturechange',app,1.4,{clientX:1000});assert(Math.abs(view.zoom-1.4)<1e-12);gesture('gestureend',app,1.4);wheel(viewport,{ctrlKey:true,deltaY:-100});assert(Math.abs(view.zoom-1.4)<1e-12,'trailing duplicate');pause();wheel(viewport,{ctrlKey:true,deltaY:10});assert(view.zoom<1.4);
for(const target of [app,modal]){reset();gesture('gesturestart',target,1);const b=before();gesture('gesturechange',viewport,2);assert.deepEqual(view,b);gesture('gestureend',viewport,2);}
reset();gesture('gesturestart',viewport,1,{clientX:0,clientY:0});const w=board.world({x:400,y:300},view.pan,view.zoom);gesture('gesturechange',viewport,2,{clientX:0,clientY:0});assert.deepEqual(board.world({x:400,y:300},view.pan,view.zoom),w);
gesture('gesturechange',viewport,100);assert.equal(view.zoom,2.5);const limit=before();gesture('gesturechange',viewport,101);assert.deepEqual(view,limit);gesture('gesturechange',viewport,100);assert(view.zoom<2.5);
for(const action of ['blur','pointercancel','gesturecancel','timeout','hidden']){
 reset();gesture('gesturestart',viewport,1);if(action==='timeout')for(const fn of [...timers.values()])fn();else if(action==='hidden'){document.hidden=true;document.emit('visibilitychange');document.hidden=false;}else(action==='gesturecancel'?document:window).emit(action,{target:viewport});
 const b=before();pause();wheel(viewport,{ctrlKey:true,deltaY:-90});assert(view.zoom>b.zoom,action+' must release gesture');
}
reset();context.drag={type:'node'};const count=cancels;wheel(viewport,{deltaY:20});assert.equal(cancels,count+1);assert.equal(view.pan.y,0);
reset();editing=false;assert.equal(wheel(viewport,{ctrlKey:true,deltaY:90}).defaultPrevented,false);assert.equal(gesture('gesturestart',app,1).defaultPrevented,false);
console.log('PASS router: Safari deduplication, ownership, fallback anchor, limit reversal, blur/cancel/timeout/visibility cleanup, drag cancellation, respondent untouched');
// Production available-area/fit/layout calculations with deterministic element rectangles.
let visible=true,width=1040,height=1000,top=100,bottom=850;
const control=(rect)=>({getClientRects:()=>[rect()],getBoundingClientRect:rect});
const controls={'.editor-toolbar':control(()=>({left:0,right:width,top:0,bottom:top-12})),'.node-palette-inner':control(()=>({left:100,right:width-100,top:bottom+12,bottom:height-18})),'.zoom-dock':control(()=>({left:width-270,right:width-18,top:bottom+12,bottom:height-18}))};
let camera={pan:{x:-350,y:-120},zoom:.7},draws=0;
const rectangles=[{dataset:{id:'a'},offsetLeft:-200,offsetTop:30,offsetWidth:250,offsetHeight:400},{dataset:{id:'b'},offsetLeft:600,offsetTop:600,offsetWidth:250,offsetHeight:300}];
const geometry={document:{querySelector:s=>controls[s]||null},viewport:{},getComputedStyle:()=>({visibility:visible?'visible':'hidden'}),bounds:()=>({left:0,right:width,top:0,bottom:height,width,height}),
 layer:{querySelectorAll:()=>rectangles},api:{view:()=>camera,draw:()=>draws++},setView:(pan,zoom)=>{camera=structuredClone({pan,zoom});},zoomAt:board.zoomAt,MIN:board.MIN,MAX:board.MAX,link:null};
vm.createContext(geometry);vm.runInContext(source.slice(source.indexOf('    function available(){'),source.indexOf('    function label(')),geometry);
const areaBefore=()=>JSON.parse(vm.runInContext('JSON.stringify(available())',geometry));
const centerWorld=()=>{const a=areaBefore();return board.world({x:a.cx,y:a.cy},camera.pan,camera.zoom);};
geometry.layout();const center=centerWorld();width=1440;geometry.layout();assert.deepEqual(centerWorld(),center);assert.equal(camera.zoom,.7);
visible=false;geometry.layout();width=1200;top=150;bottom=780;geometry.layout();visible=true;geometry.layout();assert.deepEqual(centerWorld(),center);assert.equal(camera.zoom,.7);
height=840;bottom=690;geometry.layout();assert.deepEqual(centerWorld(),center);
for(const factor of [1.2,.8]){const c=centerWorld();geometry.zoom(factor);assert(Math.abs(centerWorld().x-c.x)<1e-9&&Math.abs(centerWorld().y-c.y)<1e-9);}
geometry.fit();const a=areaBefore(),left=-200,right=850,y=30,y2=900;
assert(Math.abs((left+right)/2*camera.zoom+camera.pan.x-a.cx)<1e-9);assert(Math.abs((y+y2)/2*camera.zoom+camera.pan.y-a.cy)<1e-9);
assert(left*camera.zoom+camera.pan.x>=40-1e-9);assert(right*camera.zoom+camera.pan.x<=a.width-40+1e-9);assert(y*camera.zoom+camera.pan.y>=a.y+40-1e-9);assert(y2*camera.zoom+camera.pan.y<=a.y+a.height-40+1e-9);assert.equal(draws,1);
console.log('PASS camera geometry: safe control strips, centered fit, button anchor, split/full/hidden/resize center preservation without scale changes');
