'use strict';
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
process.chdir(path.resolve(__dirname,'..'));fs.mkdirSync('audit-max/publication',{recursive:true});
const unit=['check-autosave-unit','check-html-unit','check-scenarios','check-safety','check-board-unit','check-navigation-unit','check-board-layout','check-contact-chat-pair','check-message-media-unit','check-preview'];
const browser=['check-navigation-browser','check-html-browser','check-multiselect','check-reconnect-ends','check-connection-feedback','check-shared','check-board-browser','check-board-stress','check-board-tidy-browser','check-security-browser','check-player-paths','check-respondent-actions','check-mobile-chat-exit','check-respondent-pages','check-message-media','check-audit-regressions'];
let failed=false;for(const name of process.argv[2]==='browser'?browser:unit){const run=cp.spawnSync(process.execPath,['tools/'+name+'.cjs'],{stdio:'inherit',env:process.env});if(run.status!==0)failed=true;}process.exitCode=failed?1:0;
