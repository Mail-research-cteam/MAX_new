'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../prototype');
let downloaded;
const context={TextEncoder,TextDecoder,Uint8Array,Blob,Response,URL:class extends URL{},structuredClone,btoa,setTimeout:()=>{},
 document:{currentScript:{src:'https://max.test/shared/author.js'},getElementById:()=>null,createElement:()=>({click(){}})},
 fetch:async file=>{const p=path.resolve(root,file);assert.ok(p.startsWith(root+path.sep));return new Response(fs.readFileSync(p));}
};
context.window=context;context.URL.createObjectURL=b=>{downloaded=b;return 'blob:test';};context.URL.revokeObjectURL=()=>{};
vm.createContext(context);
for(const p of ['safety.js','standalone.js','author.js'])vm.runInContext(fs.readFileSync(path.join(root,'shared',p),'utf8'),context);
(async()=>{for(const id of ['owner','employee','purchase']){
 const b=JSON.parse(fs.readFileSync(path.join(root,'scenarios',id+'.json'))),before=JSON.stringify(b);
 const s=structuredClone(b.scenario),key=Object.keys(s.nodes)[0];s.nodes[key].text='</script><script>throw new Error("injection")</script> & < >';
 await context.MaxHTML.exportHTML(b,s);const html=await downloaded.text();
 assert.equal(JSON.stringify(b),before,'export must not mutate the original scenario');
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];assert.equal(scripts.length,2,'scenario text must not terminate the data script');
 const pack=JSON.parse(scripts[0][1]);assert.equal(pack.bundle.scenario.nodes[key].text,s.nodes[key].text);
 assert.equal(pack.bundle.id,id);assert.equal(pack.format,'max-standalone');
 new vm.Script(scripts[1][1]);
 const names=Object.keys(pack.files);assert.deepEqual(names.filter(p=>/^scenarios\/.*\.json$/.test(p)).sort(),['scenarios/'+id+'.json','scenarios/catalog.json'].sort());
 for(const file of ['index.html','mail.html','password.html','shared/standalone.js','assets/fonts/font-01.woff2','THIRD-PARTY-NOTICES.txt'])assert.ok(pack.files[file],file+' must be embedded');
 for(const file of ['shared/board.js','shared/board.css','shared/editor-ui.js','shared/app.js'])assert.equal(Buffer.from(pack.files[file],'base64').toString(),fs.readFileSync(path.join(root,file),'utf8'),'new HTML must embed current navigation: '+file);
 assert.equal(JSON.parse(Buffer.from(pack.files['scenarios/'+id+'.json'],'base64')).scenario.nodes[key].text,s.nodes[key].text);
 console.log('PASS HTML '+id+': selected scenario only, resources, nonmutation, script escaping, executable bootstrap syntax');
 await context.MaxAuthor.exportBundle(b,s);
 const entries=require('./zip-utils.cjs').entries(Buffer.from(await downloaded.arrayBuffer()));
 for(const file of ['shared/board.js','shared/board.css','shared/editor-ui.js','shared/app.js'])assert.equal(entries.find(e=>e.name===file).data.toString(),fs.readFileSync(path.join(root,file),'utf8'),'ZIP must embed current navigation: '+file);
 assert.equal(JSON.parse(entries.find(e=>e.name==='scenarios/'+id+'.json').data).scenario.nodes[key].text,s.nodes[key].text);
 assert.equal(JSON.stringify(b),before,'ZIP must not mutate the original scenario');
 console.log('PASS ZIP '+id+': current navigation sources, selected edited data, original unchanged');
}})().catch(e=>{console.error(e);process.exitCode=1;});
