'use strict';
// Local file preview only. No uploads or file writes.
const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs/promises');
const path = require('node:path');
const rootArg=process.argv.find(a=>a.startsWith('--root='));
const root = rootArg?path.resolve(rootArg.slice(7)):path.resolve(__dirname, '..');
const lan = process.argv.includes('--lan');
const host = lan ? '0.0.0.0' : '127.0.0.1';
const allowedHosts=new Set(['localhost','127.0.0.1','[::1]']);
if(lan)for(const values of Object.values(os.networkInterfaces()))for(const item of values||[])allowedHosts.add(item.address);
const portArg = process.argv.find(a => a.startsWith('--port='));
const port = portArg ? Number(portArg.slice(7)) : 8000;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Порт должен быть числом от 1 до 65535.'); process.exit(1);
}
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.txt':'text/plain; charset=utf-8',
  '.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon'};
function inside(file) {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'");
  const requestHost=String(req.headers?.host||'').replace(/:\d+$/,'');
  if(!allowedHosts.has(requestHost)){res.writeHead(403);res.end();return;}
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405, {Allow:'GET, HEAD'}); res.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const parts = pathname.replaceAll('\\', '/').split('/');
    if (parts.some(p => p.startsWith('.') || p.includes(':') || p.includes('\0'))) {
      res.writeHead(403); res.end(); return;
    }
    let file = path.resolve(root, '.' + pathname);
    if (!inside(file)) { res.writeHead(403); res.end(); return; }
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    file = await fs.realpath(file);
    if (!inside(file) || !types[path.extname(file).toLowerCase()]) { res.writeHead(403); res.end(); return; }
    const body = await fs.readFile(file);
    res.writeHead(200, {'Content-Type':types[path.extname(file).toLowerCase()], 'Content-Length':body.length});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    res.writeHead(error instanceof URIError ? 400 : 404); res.end();
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Порт ${port} занят. Запустите: node tools/preview.cjs --port=${port + 1}`
    : error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`Просмотр запущен. Остановка: Ctrl+C`);
  const prefix=require('node:fs').existsSync(path.join(root,'prototype/index.html'))?'prototype/':'';
  console.log(`Бот: http://localhost:${port}/${prefix}index.html`);
  console.log(`Редактор: http://localhost:${port}/${prefix}index.html?scenario=owner&edit=1`);
  console.log(`Стартовая страница: http://localhost:${port}/${prefix}mail.html`);
  if (lan) console.log(`Для телефона используйте IPv4 компьютера вместо localhost (команда ipconfig).`);
});
