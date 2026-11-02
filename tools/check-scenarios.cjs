'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
for(const [id,expected]of Object.entries(require('./scenario-baseline.json'))){const file=path.join(__dirname,'../prototype/scenarios',id+'.json');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),expected,'Research scenario or manual coordinates changed: '+id);console.log('PASS complete file baseline (including coordinates):',id);}
