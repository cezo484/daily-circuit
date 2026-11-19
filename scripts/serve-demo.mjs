// Serves the built client (dist/client) for the local demo.
// No Devvit server runs here, so the game falls back to local mode: the same
// date-seeded puzzle, with completion stored in the browser's localStorage.
// Usage: npm run demo, then open http://localhost:4173/

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist', 'client');
const port = Number(process.env.DEMO_PORT ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    let path = normalize(url.pathname);
    if (path === '/') {
      res.writeHead(302, { Location: '/game.html' });
      res.end();
      return;
    }
    const file = join(root, path);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Content-Length': info.size,
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('Not found. Run npm run build first, then npm run demo.');
  }
});

server.listen(port, () => {
  console.log(`Daily Circuit demo running at http://localhost:${port}/game.html`);
  console.log('Local mode: the puzzle is the real daily one, scores stay in this browser.');
});
