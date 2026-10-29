// Minimal static file server used by scripts and E2E tests.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
};

/** Serves `mounts` ({ urlPrefix: directory }) and resolves to the running server. */
export function serve(mounts, port = 0) {
  const entries = Object.entries(mounts).sort((a, b) => b[0].length - a[0].length);
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const mount = entries.find(([prefix]) => url.startsWith(prefix));
    if (!mount) { res.writeHead(404).end(); return; }
    let file = path.join(mount[1], url.slice(mount[0].length));
    if (!file.startsWith(path.resolve(mount[1]))) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env.PORT ?? 4173);
  const root = path.resolve(import.meta.dirname, '../..');
  // Like GitHub Pages: the app lives under /Hyrox/. E2E_PUBLISHED=1 serves the repository root
  // (what Pages publishes), otherwise the fresh build in app/dist.
  const mounts = { '/Hyrox/': process.env.E2E_PUBLISHED ? root : path.join(root, 'app/dist') };
  serve(mounts, port).then(() => console.log(`Serving on http://127.0.0.1:${port}/Hyrox/`));
}
