// serve.ts — a tiny static file server for Marina Heat.
// `node serve.ts` serves the game/ directory at http://127.0.0.1:8917/
// so the ES modules load even where file:// module loading is blocked.
// Plain JavaScript in a .ts file; node:http only, no dependencies.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), 'game');
const PORT = 8917;

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = normalize(join(GAME_DIR, rel));
    if (!file.startsWith(GAME_DIR)) throw new Error('escape');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Marina Heat serving at http://127.0.0.1:${PORT}/`);
});
