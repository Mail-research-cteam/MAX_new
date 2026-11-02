const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},MaxSafety:require('../prototype/shared/safety.js'),MaxIcons:{plus:'<svg></svg>',trash:'<svg></svg>'}};vm.createContext(context);vm.runInContext(fs.readFileSync('prototype/shared/message-media.js','utf8'),context);
const media=context.window.MaxMessageMedia,image={src:'data:image/png;base64,YQ==',name:'<unsafe>.png',width:320,height:180};
assert(media.valid(image));
for(const bad of [null,{...image,src:'javascript:alert(1)'},{...image,src:'https://example.com/a.png'},{...image,src:'data:image/svg+xml;base64,YQ=='},{...image,width:NaN},{...image,height:-1},{...image,src:'data:image/png;base64,'+'A'.repeat(1024*1024)}])assert(!media.valid(bad));
const html=media.field('node',image);assert(html.includes('&lt;unsafe&gt;.png'));assert(!html.includes('<unsafe>'));assert(media.field('node',null).includes('Добавить картинку'));assert.equal(media.picture({},'node'),'');
// Execute the production commit path, checking that a failed draft write is atomic.
const source=fs.readFileSync('prototype/shared/app.js','utf8'),body=source.match(/commit:function\(id,image\)\{([\s\S]*?)\n    \}\}\);/)[1];
const original={intro:{auto:'b'},nodes:{b:{type:'bot',x:100,y:200,text:'Keep',buttons:[]}}},clone=x=>JSON.parse(JSON.stringify(x));
let quota=false,snapshots=0,rendered=0,synced=0,saved=0;
const app={S:clone(original),DEFAULT:clone(original),STORE:'draft',clone,typingSnap:99,
 localStorage:{setItem(key){if(quota&&key==='draft')throw Error('QuotaExceededError');}},snapshot(){snapshots++;},buildGraph(){rendered++;},syncPreview(){synced++;},save(){saved++;},layer:{querySelector:()=>({focus(){}})}};
vm.createContext(app);vm.runInContext('var commit=function(id,image){'+body+'};',app);
quota=true;assert.throws(()=>app.commit('b',image),/недостаточно места/);assert.deepEqual(clone(app.S),original);assert.equal(snapshots,0);
quota=false;app.commit('b',image);assert.deepEqual(clone(app.S.nodes.b.image),image);assert.equal(app.S.nodes.b.text,'Keep');assert.equal(app.S.nodes.b.x,100);assert.equal(app.typingSnap,0);assert.equal(snapshots,1);assert.equal(rendered,1);assert.equal(synced,1);assert.equal(saved,1);
app.commit('b',null);assert.deepEqual(clone(app.S),original);assert.equal(snapshots,2);
console.log('PASS allowed embedded formats; invalid/oversized source rejection; escaped file names; empty image rendering; quota failure preserves state/history; one commit per image mutation; existing fields unchanged');
