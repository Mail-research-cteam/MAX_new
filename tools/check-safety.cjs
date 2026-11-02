'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),s=require('../prototype/shared/safety.js');
const base=JSON.parse(fs.readFileSync('prototype/scenarios/owner.json')).scenario,clone=()=>structuredClone(base);
for(const bad of ['javascript:alert(1)','data:text/html,<script>x</script>','file:///private','//evil.invalid/x','https://user:password@evil.invalid','https://safe.invalid\\@evil.invalid','java\nscript:x'])assert.equal(s.url(bad),'');
for(const good of ['mail.html','password.html?expired=true','https://example.com/path'])assert.equal(s.url(good),good);
assert(s.validate(clone()));
const empty=clone();empty.nodes={};empty.intro.auto='';assert(s.validate(empty));
for(const mutate of [v=>{v.nodes.greet.type='unknown';},v=>{v.nodes.greet.buttons=[null];},v=>{v.nodes.greet.text={bad:true};},v=>{v.contacts.push({...v.contacts[0]});},v=>{v.nodes.greet.auto='missing';},v=>{v.nodes.greet.autoDelay=-1;},v=>{v.nodes.greet.duration=Infinity;},v=>{v.nodes.greet={type:'external',url:'javascript:alert(1)'};},v=>{v.contacts[0].avatar='data:image/svg+xml,<svg onload="x"/>';},v=>{v.nodes=JSON.parse('{"__proto__":{"type":"bot"}}');}]){const v=clone();mutate(v);assert.throws(()=>s.validate(v));}
assert.throws(()=>s.parse('{'));assert.throws(()=>s.parse(' '.repeat(s.MAX_BYTES+1)));
for(const file of ['../private.json','/private.json','https://evil.invalid/x.js','a\\b.js','.env','assets/../x.js','a.js?x','assets/%2e%2e/private.json'])assert.equal(s.releasePath(file),false);
assert(s.releasePath('assets/fonts/licenses.json'));
// Author ZIP path is tested with the same implementation used by downloads.
const context={window:{},MaxSafety:s,URL,TextEncoder,Uint8Array,DataView,Blob,document:{currentScript:{src:'https://example.invalid/prototype/shared/author.js'}}};vm.createContext(context);vm.runInContext(fs.readFileSync('prototype/shared/author.js','utf8'),context);
(async()=>{const zip=context.window.MaxAuthor.zip([['hello.txt','hello']]),bytes=Buffer.from(await zip.arrayBuffer()),reader=require('./zip-utils.cjs');assert.equal(reader.entries(bytes)[0].data.toString(),'hello');const corrupt=Buffer.from(bytes);corrupt[30+'hello.txt'.length]^=1;assert.throws(()=>reader.entries(corrupt),/CRC/);const unsafe=Buffer.from(await context.window.MaxAuthor.zip([['../escape.txt','x']]).arrayBuffer());assert.throws(()=>reader.entries(unsafe),/Unsafe/);console.log('PASS unsafe URL/shape/prototype/import-size/ZIP-path rejection; valid baseline; production ZIP CRC and traversal regression');})().catch(e=>{console.error(e);process.exitCode=1});
