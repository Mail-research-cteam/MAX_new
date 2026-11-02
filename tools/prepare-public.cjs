'use strict';
// Copy an explicit candidate, never delete or move the user's working files.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');process.chdir(root);cp.execFileSync(process.execPath,['tools/package-shared.cjs'],{stdio:'inherit'});
const out=path.join(root,'dist','public-source-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
const copy=(from,to=from)=>{const source=path.join(root,from);if(!fs.existsSync(source))throw Error('Missing public dependency: '+from);if(fs.lstatSync(source).isSymbolicLink())throw Error('Symlink not allowed');fs.mkdirSync(path.dirname(path.join(out,to)),{recursive:true});fs.copyFileSync(source,path.join(out,to));};
for(const f of ['README.md','SECURITY.md','THIRD-PARTY-NOTICES.md','package.json','package-lock.json','.gitignore','AGENTS.md'])copy(f);
for(const f of JSON.parse(fs.readFileSync('prototype/release-files.json')))copy('prototype/'+f);
const tools=['preview','build-public-release','check-audit-regressions','package-shared','prepare-public','audit-publication','browser','zip-utils','board-test-helpers','test-images','run-checks','check-scenarios','check-safety','check-preview','check-board-unit','check-board-layout','check-contact-chat-pair','check-message-media-unit','check-message-media','check-board-browser','check-board-stress','check-board-tidy-browser','check-shared','check-security-browser','check-player-paths','check-respondent-actions','check-mobile-chat-exit','check-respondent-pages','check-multiselect','check-reconnect-ends','check-connection-feedback','check-boundary','check-respondent-screens'];
for(const f of tools)copy('tools/'+f+'.cjs');copy('tools/scenario-baseline.json');
fs.writeFileSync(path.join(out,'.nojekyll'),'');
fs.mkdirSync('audit-max/publication',{recursive:true});fs.writeFileSync('audit-max/publication/public-candidate.json',JSON.stringify({directory:path.relative(root,out),license:'not selected by owner',data:'demo confirmed by owner',graphics:'redistribution confirmed by owner',published:false},null,2));
console.log('Public source candidate:',path.relative(root,out));
