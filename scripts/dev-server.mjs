import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';

const port = Number(process.argv[2] || 5173);
const root = path.resolve(process.argv[3] || 'web');
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = path.resolve(root, relative);
  if (!candidate.startsWith(`${root}${path.sep}`) && candidate !== root) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(candidate, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': types[path.extname(candidate)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(candidate).pipe(response);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`SSQ Hub dev server: http://127.0.0.1:${port}`);
});
