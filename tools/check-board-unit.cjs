const assert=require('node:assert/strict'),b=require('../prototype/shared/board.js');
// A zoom anchored on a cursor must preserve the same world point for negative pan and every scale.
for(const z of [.08,.15,.45,1,2.5])for(const p of [{x:0,y:0},{x:850,y:440}]){const pan={x:-3120,y:170},before=b.world(p,pan,z),next=b.zoomAt(p,pan,z,z*1.2),after=b.world(p,next.pan,next.zoom);assert(Math.abs(before.x-after.x)<1e-8);assert(Math.abs(before.y-after.y)<1e-8);}
const s={intro:{auto:'a'},nodes:{a:{auto:'b',buttons:[{target:'b'},{target:'b'}],confirmTarget:'b',cancelTarget:'b',target:'b'},b:{}}};
for(const key of ['btn:a:0','btn:a:1','auto:a','ok:a','no:a','target:a','auto:__intro']){const copy=structuredClone(s);b.target(copy,key,'');const p=key.split(':');if(p[0]==='btn')assert.equal(copy.nodes.a.buttons[1-Number(p[2])].target,'b');assert.deepEqual(Object.keys(copy.nodes),['a','b']);assert.equal(JSON.stringify(copy).split('"target":""').length>1||JSON.stringify(copy).includes(':""'),true);}
const occupied=[{x:0,y:0,w:250,h:1700},{x:0,y:1736,w:250,h:800},{x:300,y:0,w:250,h:200}];const result=b.place({x:0,y:0,w:250,h:2100},occupied);assert(occupied.every(r=>!b.overlaps(result,r)));assert.deepEqual(b.place({x:900,y:100,w:250,h:800},occupied),{x:900,y:100,w:250,h:800});
console.log('PASS cursor anchoring, exact exit deletion, placement against tall cards, preservation of free coordinates');

for(const deltaMode of [0,1,2]){
 const size={width:800,height:600},sx=deltaMode===1?16:deltaMode===2?800:1,sy=deltaMode===1?16:deltaMode===2?600:1;
 assert.deepEqual(b.wheelDelta({deltaX:3,deltaY:7,deltaMode},size),{x:3*sx,y:7*sy});
 assert.deepEqual(b.wheelDelta({deltaX:0,deltaY:7,deltaMode,shiftKey:true},size),{x:7*sy,y:0});
 assert.deepEqual(b.wheelDelta({deltaX:3,deltaY:7,deltaMode,shiftKey:true},size),{x:3*sx,y:0});
 assert.deepEqual(b.wheelDelta({deltaX:0,deltaY:7,deltaMode,shiftKey:true,ctrlKey:true},size),{x:0,y:7*sy});
}
for(const z of [b.MIN,b.MAX]){
 const pan={x:-3120.123456,y:170.987654},p={x:513.1,y:391.7};
 const next=b.zoomAt(p,pan,z,z===b.MIN?0:Infinity);assert.deepEqual(next,{zoom:z,pan});
 const reverse=b.zoomAt(p,pan,z,z===b.MIN?z*1.01:z/1.01);assert.notEqual(reverse.zoom,z);
}
console.log('PASS wheel axes/Shift/modifiers, pixel/line/page units; exact limit stability and immediate reversal');
