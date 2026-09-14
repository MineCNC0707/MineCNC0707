import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('public');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const file = pathname.startsWith('/vendor/')
      ? path.resolve('node_modules/three/build', pathname.slice('/vendor/'.length))
      : path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const allowed = pathname.startsWith('/vendor/') ? path.resolve('node_modules/three/build') : root;
    if (!file.startsWith(allowed + path.sep)) { res.writeHead(403).end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(Number(process.env.PORT || 5173), '127.0.0.1', () => console.log('Horde Mayhem: http://127.0.0.1:5173'));
