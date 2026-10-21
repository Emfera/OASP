// Startet einen lokalen Server auf _site/ und führt alle Tests experiments/*/tests/*.test.mjs aus.
// Aufruf: npm test            (alle)
//         npm test -- c0      (nur Experimente, deren Ordnername "c0" enthält)
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname;
const SITE = join(ROOT, '_site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try { const b = await readFile(join(SITE, p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('nicht gefunden'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const filter = process.argv[2] || '';
const runs = [];
for (const e of await readdir(join(ROOT, 'experiments'), { withFileTypes: true })) {
  if (!e.isDirectory() || !e.name.includes(filter)) continue;
  let files = []; try { files = (await readdir(join(ROOT, 'experiments', e.name, 'tests'))).filter(f => f.endsWith('.test.mjs')); } catch {}
  for (const f of files) runs.push(join(ROOT, 'experiments', e.name, 'tests', f));
}

let failed = 0;
for (const file of runs) {
  console.log(`\n▶ ${file.replace(ROOT, '')}`);
  const code = await new Promise(r => {
    const c = spawn(process.execPath, [file], { stdio: 'inherit', env: { ...process.env, BASE, OUT: tmpdir() } });
    c.on('exit', r);
  });
  if (code !== 0) failed++;
}
server.close();
console.log(`\n${runs.length - failed} von ${runs.length} Testdateien bestanden.`);
process.exit(failed ? 1 : 0);
