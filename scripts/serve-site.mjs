import { createReadStream, existsSync, statSync } from 'fs';
import { createServer } from 'http';
import { extname, join, normalize, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-site');
const PREFIX = '/demos/surrey';
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};

function fileFor(urlPath) {
  const path = decodeURIComponent(urlPath.split('?')[0]);
  if (path !== PREFIX && !path.startsWith(`${PREFIX}/`)) return null;
  const rel = path === PREFIX || path === `${PREFIX}/` ? 'index.html' : path.slice(PREFIX.length + 1);
  const full = normalize(join(ROOT, rel));
  if (full !== ROOT && !full.startsWith(`${ROOT}/`)) return null;
  return full;
}

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error('dist-site/index.html is missing. Run npm run build:site first.');
  process.exit(1);
}

const server = createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  if (path === PREFIX) {
    res.writeHead(302, { Location: `${PREFIX}/` });
    res.end();
    return;
  }
  const file = fileFor(path);
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Site preview at http://localhost:${PORT}${PREFIX}/`);
});
