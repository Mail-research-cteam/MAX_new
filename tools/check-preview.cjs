'use strict';
// Verify file delivery and path restrictions without a network connection.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let handler;
const mockHttp = {createServer(fn) { handler = fn; return {on(){},listen(){}}; }};
vm.runInNewContext(fs.readFileSync(__dirname + '/preview.cjs', 'utf8'), {
  require: name => name === 'node:http' ? mockHttp : require(name),
  __dirname, process: {argv: [], exit(){throw Error('Unexpected exit');}}, URL, console,
});
(async () => {
  for (const [url, expected] of [
    ['/prototype/index.html',200],
    ['/prototype/bot-lpr.html?edit=1',200],
    ['/prototype/bot-employee.html',200],
    ['/prototype/mail.html',200],
    ['/prototype/password.html?expired=true',200],
    ['/prototype/assets/logo.png',200],
    ['/prototype/THIRD-PARTY-NOTICES.txt',200],
    ['/.codex/config.toml',403], ['/tools/preview.cjs',403],
    ['/%2e%2e%5cWindows/win.ini',403], ['/missing.html',404],
  ]) {
    let status; const headers = {};
    await handler({url, method:'GET',headers:{host:'127.0.0.1:8000'}}, {
      setHeader(k,v){headers[k]=v;},
      writeHead(n){status=n;}, end(){},
    });
    assert.equal(status,expected,url);
    assert.equal(headers['Cache-Control'],'no-store');
    console.log('PASS',status,url);
  }
  let hostile;await handler({url:'/prototype/index.html',method:'GET',headers:{host:'attacker.invalid'}},{setHeader(){},writeHead(n){hostile=n;},end(){}});assert.equal(hostile,403);console.log('PASS hostile Host rejected');
})().catch(error => {console.error(error);process.exitCode=1;});
