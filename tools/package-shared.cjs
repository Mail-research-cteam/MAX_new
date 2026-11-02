const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../prototype');
fs.writeFileSync(path.join(root,'THIRD-PARTY-NOTICES.txt'),fs.readFileSync(path.join(__dirname,'../THIRD-PARTY-NOTICES.md'),'utf8'));
fs.writeFileSync(path.join(root,'release-helper.json'),JSON.stringify({server:fs.readFileSync(path.join(__dirname,'preview.cjs'),'utf8'),start:'@echo off\r\ncd /d "%~dp0"\r\nnode tools\\preview.cjs\r\npause\r\n'}));
const safe=require('../prototype/shared/safety.js');
const list=['index.html','bot-lpr.html','bot-employee.html','mail.html','password.html','release-helper.json','THIRD-PARTY-NOTICES.txt'];
function walk(dir){for(const x of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
 if(x.name.startsWith('.'))continue;const p=dir+'/'+x.name;
 if(x.isSymbolicLink())throw Error('Release cannot include symlinks');
 if(x.isDirectory()){walk(p);continue;}
 if(!safe.releasePath(p))continue;
 if(dir.startsWith('shared')&&!/\.(?:js|css)$/.test(p))continue;
 if(dir.startsWith('assets')&&/\.json$/.test(p)&&!/^assets\/fonts\/(?:licenses|sources)\.json$/.test(p))continue;
 if(dir.startsWith('assets')&&/\.txt$/.test(p)&&!/(?:license|licence|ofl|notice|readme)/i.test(x.name))continue;
 list.push(p);
}}
walk('shared');walk('assets');
list.push('scenarios/catalog.json');
for(const item of JSON.parse(fs.readFileSync(path.join(root,'scenarios/catalog.json')))){
 if(!safe.identifier(item.id))throw Error('Invalid scenario ID');list.push('scenarios/'+item.id+'.json');
}
const extra=path.join(root,'release-extra.json');
if(fs.existsSync(extra))for(const file of JSON.parse(fs.readFileSync(extra,'utf8')).files||[]){if(!safe.releasePath(file))throw Error('Invalid extra release path');if(fs.lstatSync(path.join(root,file)).isSymbolicLink())throw Error('Release symlink');list.push(file);}
list.push('release-files.json');
fs.writeFileSync(path.join(root,'release-files.json'),JSON.stringify([...new Set(list)].sort(),null,2));
console.log('Release dependencies:',list.length);
