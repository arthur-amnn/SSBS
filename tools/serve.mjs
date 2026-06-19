/* =====================================================================
   serve.mjs — Petit serveur statique SANS dependance, pour tester l'app
   en local (le Service Worker et les modules ES exigent http://, pas file://).
   Lancer : node tools/serve.mjs   ->   http://localhost:8080
   ===================================================================== */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const PORT = process.env.PORT || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
    const s = await stat(file).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404).end('Not found'); return; }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500).end('Server error: ' + e.message);
  }
}).listen(PORT, () => {
  console.log(`SSBS dev server -> http://localhost:${PORT}`);
  console.log('Ctrl+C pour arreter.');
});
