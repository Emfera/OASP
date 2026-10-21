// Baut die veröffentlichte Seite nach _site/:
//  - kopiert experiments/ und setzt in allen HTML-Dateien den Versionsstempel ein
//  - erzeugt die Startseite (Register aller Experimente) aus den experiment.json-Dateien
//  - erzeugt EXPERIMENTE.md im Repo (Register als Text, wird mit eingecheckt)
import { readdir, readFile, writeFile, mkdir, cp, rm, stat } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, '_site');

function version() {
  let sha = (process.env.GITHUB_SHA || '').slice(0, 7);
  if (!sha) { try { sha = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { sha = 'ohne-git'; } }
  let dirty = '';
  try { if (!process.env.GITHUB_SHA && execSync('git status --porcelain', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()) dirty = '+lokal'; } catch {}
  return `${sha}${dirty} · ${new Date().toISOString().slice(0, 10)}`;
}

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STATUS = ['läuft', 'offen', 'übernommen', 'verworfen'];

const ver = version();
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const experiments = [];
for (const e of await readdir(join(ROOT, 'experiments'), { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const dir = join(ROOT, 'experiments', e.name);
  let meta;
  try { meta = JSON.parse(await readFile(join(dir, 'experiment.json'), 'utf8')); }
  catch (err) { throw new Error(`experiments/${e.name}: experiment.json fehlt oder ist ungültig (${err.message})`); }
  for (const k of ['id', 'title', 'question', 'status', 'started']) if (!meta[k]) throw new Error(`experiments/${e.name}: Feld "${k}" fehlt`);
  if (!STATUS.includes(meta.status)) throw new Error(`experiments/${e.name}: Status muss einer von ${STATUS.join(', ')} sein`);
  let hasPage = false; try { await stat(join(dir, 'index.html')); hasPage = true; } catch {}
  meta.slug = e.name; meta.hasPage = hasPage;
  experiments.push(meta);
  await cp(dir, join(OUT, 'experiments', e.name), { recursive: true, filter: src => !src.includes('/tests') });
}
experiments.sort((a, b) => STATUS.indexOf(a.status) - STATUS.indexOf(b.status) || (a.id < b.id ? -1 : 1));

for (const f of await walk(OUT)) {
  if (!f.endsWith('.html')) continue;
  const s = await readFile(f, 'utf8');
  if (s.includes('__OASP_VERSION__')) await writeFile(f, s.replaceAll('__OASP_VERSION__', ver));
}

const card = m => `<article class="${esc(m.status)}">
  <header><b>${esc(m.id)}</b> ${esc(m.title)} <span class="st">${esc(m.status)}</span></header>
  <p class="q">${esc(m.question)}</p>
  ${m.result ? `<p><b>Stand:</b> ${esc(m.result)}</p>` : ''}
  ${m.next ? `<p><b>Nächster Schritt:</b> ${esc(m.next)}</p>` : ''}
  <p class="meta">${esc(m.track || '')} · begonnen ${esc(m.started)}${m.decided ? ' · entschieden ' + esc(m.decided) : ''}</p>
  ${m.hasPage && m.status !== 'verworfen' ? `<a class="open" href="experiments/${esc(m.slug)}/">Öffnen</a>` : ''}
  <a href="https://github.com/Emfera/oasp/tree/main/experiments/${esc(m.slug)}">Quelle und Protokoll</a>
</article>`;

await writeFile(join(OUT, 'index.html'), `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>OASP Experimente</title>
<style>
:root{--bg:#f8fafc;--panel:#fff;--line:#cbd5e1;--text:#0f172a;--muted:#475569;--acc:#0369a1}
@media (prefers-color-scheme: dark){:root{--bg:#0f172a;--panel:#1e293b;--line:#334155;--text:#f1f5f9;--muted:#94a3b8;--acc:#38bdf8}}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.45 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:8px 0 4px} .sub{color:var(--muted);font-size:14px;margin-bottom:16px}
article{background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--line);border-radius:10px;padding:12px 14px;margin:12px 0}
article.läuft{border-left-color:#0284c7} article.übernommen{border-left-color:#16a34a} article.verworfen{opacity:.65;border-left-color:#9ca3af} article.offen{border-left-color:#d97706}
.st{float:right;font-size:12px;border:1px solid var(--line);border-radius:99px;padding:1px 8px;color:var(--muted)}
.q{font-style:italic} .meta{font-size:13px;color:var(--muted)} p{margin:6px 0}
a{color:var(--acc);margin-right:14px;font-weight:600} a.open{display:inline-block;padding:10px 16px;border-radius:8px;background:var(--acc);color:#fff;text-decoration:none}
</style></head><body><main>
<h1>OASP – Experimente</h1>
<div class="sub">Open Archaeological Surveying Pipeline · Version ${esc(ver)} · Jedes Experiment beantwortet eine Frage und endet mit „übernommen“ oder „verworfen“.</div>
${experiments.map(card).join('\n')}
</main></body></html>`);

const md = ['# Experimente', '', 'Automatisch erzeugt aus `experiments/*/experiment.json` (`npm run build`). Nicht von Hand bearbeiten.', '',
  '| ID | Titel | Status | Begonnen | Entschieden | Stand |', '| --- | --- | --- | --- | --- | --- |',
  ...experiments.map(m => `| ${m.id} | [${m.title}](experiments/${m.slug}/) | ${m.status} | ${m.started} | ${m.decided || ''} | ${(m.result || '').replace(/\|/g, '/')} |`), ''].join('\n');
await writeFile(join(ROOT, 'EXPERIMENTE.md'), md);

console.log(`Gebaut: ${experiments.length} Experiment(e), Version ${ver}`);
