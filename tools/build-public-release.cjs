'use strict';
// Use the production exporter, reading only the explicit runtime manifest.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),runtime=path.join(root,'prototype'),safe=require('../prototype/shared/safety.js'),reader=require('./zip-utils.cjs');
process.chdir(root);require('./package-shared.cjs');
(async()=>{
 let result,status='';
 class LocalURL extends URL {static createObjectURL(blob){result=blob;return 'blob:local-export';}static revokeObjectURL(){}}
 const context={window:{},MaxSafety:safe,URL:LocalURL,TextEncoder,TextDecoder,Uint8Array,DataView,Blob,structuredClone,setTimeout:fn=>fn(),
  document:{currentScript:{src:'https://example.invalid/prototype/shared/author.js'},getElementById:id=>id==='authorStatus'?{set textContent(v){status=v;},classList:{toggle(){}}}:null,createElement:()=>({click(){}})},
  fetch:async name=>{if(!safe.releasePath(name))throw Error('Invalid release dependency');const data=fs.readFileSync(path.join(runtime,name));return {ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(runtime,'shared/author.js'),'utf8'),context);
 const bundle=JSON.parse(fs.readFileSync(path.join(runtime,'scenarios/purchase.json')));
 await context.window.MaxAuthor.exportBundle(bundle,bundle.scenario);if(!result)throw Error('Release export failed: '+status);
 const bytes=Buffer.from(await result.arrayBuffer()),entries=reader.entries(bytes);
 for(const item of entries){assert(safe.releasePath(item.name)||['tools/preview.cjs','start.cmd'].includes(item.name));assert(!/^(?:audit-max|node_modules|tools\/fixtures)\//.test(item.name));}
 for(const id of ['owner','employee','purchase'])assert.deepEqual(JSON.parse(entries.find(x=>x.name==='scenarios/'+id+'.json').data),JSON.parse(fs.readFileSync(path.join(runtime,'scenarios/'+id+'.json'))));
 assert(entries.find(x=>x.name==='index.html').data.toString().includes('data-frozen="true"'));
 fs.mkdirSync('dist',{recursive:true});const file='dist/public-release-'+new Date().toISOString().replace(/[:.]/g,'-')+'.zip';fs.writeFileSync(file,bytes);
 fs.mkdirSync('audit-max/publication',{recursive:true});fs.writeFileSync('audit-max/publication/public-release.json',JSON.stringify({file,entries:entries.length,scenarioDataUnchanged:true,published:false},null,2));console.log('Prepared runtime ZIP:',file,'('+entries.length+' files)');
})().catch(e=>{console.error(e.message);process.exitCode=1});
