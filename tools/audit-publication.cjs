'use strict';
// Local-only scan. Findings contain categories/locations, never matched values.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),cp=require('node:child_process');
const workspace=path.resolve(__dirname,'..'),root=path.resolve(process.argv.find(x=>x.startsWith('--root='))?.slice(7)||workspace),output=path.resolve(process.argv.find(x=>x.startsWith('--output='))?.slice(9)||path.join(workspace,'audit-max/publication/private-scan.json')),findings=[],inventory=[];
const patterns=[['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],['provider-token',/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{24,}|AKIA[A-Z0-9]{16})\b/g],['credential-assignment',/(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[=:]\s*['"][^'"\s]{12,}['"]/gi],['email',/[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63}){1,8}/gi],['phone',/\+7[ ()-]*\d[\d ()*-]{7,}\d/g],['personal-local-path',/[A-Za-z]:[\\/](?:Users|загрузки|Прототип)[^\r\n"'<>]{0,120}/gi],['temporary-figma-asset',/https:\/\/www\.figma\.com\/api\/mcp\/asset\//g],['password-field',/(?:password|пароль)\s*[=:]\s*['"][^'"\r\n]{3,}['"]/gi]];
function scan(name,text){text=text.replace(/data:image\/[^\s"'<>]+/g,'[EMBEDDED IMAGE]');for(const [type,regex]of patterns){regex.lastIndex=0;let m,count=0;while((m=regex.exec(text))&&count++<200){findings.push({path:name,line:text.slice(0,m.index).split('\n').length,type,example:'[MASKED]'});}}}
function zip(name,buffer){
 let e=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){e=i;break;}
 if(e<0){findings.push({path:name,type:'unreadable-archive'});return;}
 let offset=buffer.readUInt32LE(e+16);const count=buffer.readUInt16LE(e+10);
 for(let i=0;i<count;i++){
  if(buffer.readUInt32LE(offset)!==0x02014b50)throw Error('Invalid ZIP directory');
  const method=buffer.readUInt16LE(offset+10),flags=buffer.readUInt16LE(offset+8),compressed=buffer.readUInt32LE(offset+20),size=buffer.readUInt32LE(offset+24),len=buffer.readUInt16LE(offset+28),extra=buffer.readUInt16LE(offset+30),comment=buffer.readUInt16LE(offset+32),local=buffer.readUInt32LE(offset+42),entry=buffer.subarray(offset+46,offset+46+len).toString('utf8');
  inventory.push({path:name+'!'+entry,size,archive:true});
  if(entry.split(/[\\/]/).includes('..')||/^(?:[\\/]|[A-Za-z]:)/.test(entry))findings.push({path:name,type:'unsafe-archive-path',example:'[MASKED]'});
  if(size<=20*1024*1024&&/\.(?:html|js|cjs|json|css|md|txt|log|ya?ml|env|cmd)$/i.test(entry)&&!(flags&1)){
   const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28),data=buffer.subarray(start,start+compressed);
   try{scan(name+'!'+entry,(method===0?data:method===8?zlib.inflateRawSync(data,{maxOutputLength:20*1024*1024}):Buffer.alloc(0)).toString('utf8'));}catch{findings.push({path:name+'!'+entry,type:'archive-entry-not-scanned'});}
  }
  offset+=46+len+extra+comment;
 }
}
function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git','dist'].includes(d.name))continue;const file=path.join(dir,d.name),rel=path.relative(root,file).replaceAll('\\','/');if(rel.startsWith('audit-max/publication/'))continue;if(d.isSymbolicLink()){findings.push({path:rel,type:'symlink-review-required'});continue;}if(d.isDirectory()){walk(file);continue;}const size=fs.statSync(file).size;inventory.push({path:rel,size});if(/\.zip$/i.test(rel)){try{zip(rel,fs.readFileSync(file));}catch{findings.push({path:rel,type:'unreadable-archive'});}}else if(size<=20*1024*1024&&/\.(?:html|js|cjs|json|css|md|txt|log|ya?ml|env|cmd|svg)$/i.test(rel))scan(rel,fs.readFileSync(file,'utf8'));else if(/\.(?:jpe?g|png)$/i.test(rel)){const b=fs.readFileSync(file);if(b.includes(Buffer.from('Exif\0\0'))||b.includes(Buffer.from('eXIf')))findings.push({path:rel,type:'image-exif-review-required'});}}}
walk(root);
let git={available:false};try{const run=args=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});const top=run(['rev-parse','--show-toplevel']).trim();git={available:true,tracked:run(['ls-files','-z']).split('\0').filter(Boolean),staged:run(['diff','--cached','--name-only','-z']).split('\0').filter(Boolean),commits:Number(run(['rev-list','--all','--count']).trim())};for(const sha of run(['rev-list','--all']).trim().split('\n').filter(Boolean)){const diff=run(['show','--format=','--no-ext-diff',sha]);scan('git-history:'+sha.slice(0,12),diff);}}catch{}
const counts={};for(const f of findings)counts[f.type]=(counts[f.type]||0)+1;
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({git,inventory,findings,counts},null,2));
console.log(JSON.stringify({filesAndArchiveEntries:inventory.length,gitAvailable:git.available,counts},null,2));
