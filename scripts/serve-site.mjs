import { createReadStream, existsSync, realpathSync, statSync } from 'fs';
import { createServer } from 'http';
import { extname, join, normalize, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-site');
const PREFIX = '/demos/surrey';
const PORT = Number(process.env.PORT || 4173);
export const LISTEN_HOST = process.env.HOST || '127.0.0.1';

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

export function siteRequestTarget(urlPath) {
  let path;
  try {
    path = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  } catch {
    return { status: 400 };
  }
  if (path !== PREFIX && !path.startsWith(`${PREFIX}/`)) return { status: 404 };
  const rel = path === PREFIX || path === `${PREFIX}/` ? 'index.html' : path.slice(PREFIX.length + 1);
  const full = normalize(join(ROOT, rel));
  if (full !== ROOT && !full.startsWith(`${ROOT}/`)) return { status: 404 };
  return { status: 200, file: full };
}

const server = createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  if (path === PREFIX) {
    res.writeHead(302, { Location: `${PREFIX}/` });
    res.end();
    return;
  }
  const target = siteRequestTarget(path);
  if (target.status === 400) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }
  const file = target.file;
  if (target.status !== 200 || !file || !existsSync(file) || !statSync(file).isFile()) {
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

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  if (!existsSync(join(ROOT, 'index.html'))) {
    console.error('dist-site/index.html is missing. Run npm run build:site first.');
    process.exit(1);
  }
  server.listen(PORT, LISTEN_HOST, () => {
    console.log(`Site preview at http://${LISTEN_HOST}:${PORT}${PREFIX}/`);
  });
}
