// Legt ein neues Experiment an: npm run neu -- c1-logger-kern "Logger-Kern" "Welche Frage beantwortet es?"
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
const [slug, title, question] = process.argv.slice(2);
if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !title || !question) {
  console.error('Aufruf: npm run neu -- <id-kurzname> "<Titel>" "<Frage>"   (z. B. c1-logger-kern)'); process.exit(1);
}
const dir = join(new URL('..', import.meta.url).pathname, 'experiments', slug);
try { await stat(dir); console.error(`experiments/${slug} gibt es schon.`); process.exit(1); } catch {}
await mkdir(join(dir, 'tests'), { recursive: true });
const id = slug.split('-')[0].toUpperCase();
await writeFile(join(dir, 'experiment.json'), JSON.stringify({ id, slug, title, question, criteria: [], track: '', status: 'offen', started: new Date().toISOString().slice(0, 10), decided: null, result: '', next: '' }, null, 2) + '\n');
await writeFile(join(dir, 'README.md'), `# ${id} – ${title}\n\n**Frage:** ${question}\n\n## Abnahmekriterien\n\n- \n\n## Vorgehen\n\n## Ergebnis\n\n_offen_\n\n## Entscheidung\n\n_übernommen nach … / verworfen, weil …_\n`);
console.log(`Angelegt: experiments/${slug}/ (experiment.json, README.md, tests/)`);
