const assert=require('node:assert/strict'),fs=require('node:fs'),b=require('../prototype/shared/board.js');
const rect=(id,w=300,h=400)=>({id,x:40,y:40,w,h});
function check(rs,edges){
 const original=JSON.stringify(rs),links=JSON.stringify(edges),placed=b.tidy(rs,edges);
 assert.equal(JSON.stringify(rs),original);assert.equal(JSON.stringify(edges),links);
 assert.equal(placed.length,rs.length);
 assert(placed.every(r=>Number.isFinite(r.x)&&Number.isFinite(r.y)));
 for(let i=0;i<placed.length;i++)for(const other of placed.slice(i+1))assert(!b.overlaps(placed[i],other,36),'Overlap: '+placed[i].id+' / '+other.id);
 assert.deepEqual(b.tidy(placed,edges),placed,'Repeated arrangement must be stable');
 return Object.fromEntries(placed.map(r=>[r.id,r]));
}
const chain=check([rect('a',320,1200),rect('b',280,200),rect('c',340,700)],[['target:a','b'],['auto:b','c']]);
assert.equal(chain.a.y,chain.b.y);assert.equal(chain.b.y,chain.c.y);assert.equal(chain.b.x-chain.a.x,400);assert.equal(chain.c.x-chain.b.x,360);
const fork=check([rect('a'),rect('b'),rect('c'),rect('d')],[['btn:a:0','b'],['btn:a:1','c'],['auto:b','d'],['auto:c','d']]);
assert.equal(fork.a.y,fork.b.y);assert(fork.c.y>=fork.b.y+fork.b.h+36);assert(fork.d.x>Math.max(fork.b.x,fork.c.x));
check([rect('a'),rect('b'),rect('c'),rect('isolated')],[['auto:a','b'],['auto:b','c'],['auto:c','a'],['btn:a:0','a'],['btn:b:0','missing']]);
check([],[]);
const large=Array.from({length:130},(_,i)=>rect('n'+i,260+(i%3)*25,180+(i%9)*125));
const edges=large.slice(1).map((r,i)=>['btn:n'+Math.floor(i/2)+':'+i,r.id]);check(large,edges);
for(const id of ['owner','employee','purchase']){
 const s=JSON.parse(fs.readFileSync('prototype/scenarios/'+id+'.json','utf8')).scenario,links=[];
 if(s.intro.auto)links.push(['auto:__intro',s.intro.auto]);
 for(const [key,n]of Object.entries(s.nodes)){
  for(const [port,prop]of [['auto','auto'],['target','target'],['ok','confirmTarget'],['no','cancelTarget']])if(n[prop])links.push([port+':'+key,n[prop]]);
  (n.buttons||[]).forEach((v,i)=>{if(v.target)links.push(['btn:'+key+':'+i,v.target]);});
 }
 const rs=[rect('__intro',300,330),rect('__meta',300,400),...Object.entries(s.nodes).map(([key,n])=>rect(key,300,250+(n.buttons?.length||0)*50+(n.type==='contact_modal'?1200:0)))];
 check(rs,links);console.log('PASS layout topology:',id);
}
console.log('PASS chains, forks, merge ranks, cycles, disconnected nodes, variable dimensions, 130 cards, no overlaps, idempotence and unchanged input data');
