// Automatischer Test für tachylog C0 mit Simulator (kein Instrument nötig)
import { chromium } from 'playwright';
const URL = (process.env.BASE || 'http://127.0.0.1:8765/') + 'experiments/c0-webserial-logger/index.html' + (process.env.C0_QUERY || '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, cond, info = '') => { results.push({ name, ok: !!cond, info }); console.log((cond ? 'OK   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL); await page.waitForFunction(() => window.tachylogC0 && window.tachylogC0.ready);
check('Seite startet ohne Fehler', errors.length === 0, errors.join(' | '));

// 1) Simulator 200 Zeilen bei 20 ms, mit 5 Abbrüchen mitten in einer Zeile und einem Burst
await page.fill('#simMs', '20');
await page.click('#btnSim');
for (let i = 0; i < 5; i++) {
  await page.waitForFunction(n => window.tachylogC0.S.lines >= n, 30 * (i + 1));
  await page.click('#btnSimCut');           // halbe Zeile, dann Abbruch, nach 3 s weiter
  await sleep(3300);
}
await page.click('#btnSimBurst');
await page.waitForFunction(() => window.tachylogC0.S.lines >= 205);
await page.click('#btnSim');                // stop
await page.evaluate(() => window.tachylogC0.chain);
const r1 = await page.evaluate(() => window.tachylogC0.verify());
check('200+ Zeilen, 5 Fragmente gesichert', r1.idb >= 205 && r1.fragments === 5, JSON.stringify(r1));
check('Hash-Kette, OPFS = IndexedDB, raw.gsi bytegleich', r1.ok);

// 2) Neuladen mitten in laufender Aufnahme
await page.click('#btnSim');
await sleep(800);
const before = await page.evaluate(() => window.tachylogC0.S.lines);
await page.reload(); await page.waitForFunction(() => window.tachylogC0 && window.tachylogC0.ready);
const after = await page.evaluate(() => window.tachylogC0.S.lines);
const r2 = await page.evaluate(() => window.tachylogC0.verify());
check('Neuladen: Sitzung fortgesetzt, nichts verloren', after >= before && r2.ok, `vorher ${before}, nachher ${after}`);

// 3) Absturz-Simulation A: letzter IDB-Eintrag fehlt -> Reparatur aus OPFS
const sid = await page.evaluate(() => window.tachylogC0.S.sid);
await page.evaluate(async (sid) => {
  const db = await new Promise(r => { const q = indexedDB.open('tachylog-c0'); q.onsuccess = () => r(q.result); });
  const all = await new Promise(r => { const q = db.transaction('lines').objectStore('lines').getAll(IDBKeyRange.bound([sid, 0], [sid, Infinity])); q.onsuccess = () => r(q.result); });
  const last = all.at(-1);
  await new Promise(r => { const t = db.transaction('lines', 'readwrite'); t.objectStore('lines').delete([sid, last.seq]); t.oncomplete = r; });
  db.close();
}, sid);
await page.reload(); await page.waitForFunction(() => window.tachylogC0 && window.tachylogC0.ready);
const r3 = await page.evaluate(() => window.tachylogC0.verify());
const log3 = await page.$eval('#log', e => e.innerText);
check('Absturz A: fehlender IDB-Eintrag aus OPFS ergänzt', r3.ok && /in IndexedDB ergänzt/.test(log3), JSON.stringify(r3));

// 4) Absturz-Simulation B: halbe JSON-Zeile in raw.jsonl und raw.gsi zu kurz -> Reparatur aus IDB
await page.goto('about:blank'); await sleep(500); await page.goto(URL + '#nostart'); await sleep(300);
await page.evaluate(async (sid) => {
  const root = await navigator.storage.getDirectory();
  const dir = await (await root.getDirectoryHandle('sessions')).getDirectoryHandle(sid);
  const jf = await dir.getFileHandle('raw.jsonl'); const jtext = await (await jf.getFile()).text();
  const lines = jtext.trimEnd().split('\n'); const cutText = lines.slice(0, -2).join('\n') + '\n' + lines.at(-2).slice(0, 40);
  let w = await jf.createWritable(); await w.write(cutText); await w.close();
  const gf = await dir.getFileHandle('raw.gsi'); const gsize = (await gf.getFile()).size;
  w = await gf.createWritable({ keepExistingData: true }); await w.truncate(gsize - 30); await w.close();
}, sid);
await page.goto('about:blank'); await page.goto(URL); await page.waitForFunction(() => window.tachylogC0 && window.tachylogC0.ready);
const r4 = await page.evaluate(() => window.tachylogC0.verify());
const log4 = await page.$eval('#log', e => e.innerText);
check('Absturz B: raw.jsonl und raw.gsi aus IndexedDB repariert', r4.ok && /unvollständiger Schluss entfernt/.test(log4) && /raw.gsi um/.test(log4), JSON.stringify(r4));

// 5) Export-ZIP
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnExport')]);
const path = (process.env.OUT || '/tmp') + '/' + dl.suggestedFilename();
await dl.saveAs(path);
check('Export-ZIP erzeugt', true, path);

// 6) Einheiten-Parser (Befund 1 aus v0.81)
const u = await page.evaluate(() => {
  const P = window.tachylogC0.parseGSI;
  return [P('*110001+0000000012A02001 81..00+0000000081511538 82..00+0000000238504567 83..00+0000000000571144 '),
          P('*110001+0000000012A02001 81..06+0000000815115380 82..06+0000002385045670 83..06+0000000005711440 '),
          P('*110002+0000000012A02002 21.324+0000000012345678 22.324+0000000009012345 31..00+0000000000012345 ')];
});
check('GSI-Einheit mm und 0,1 mm ergeben gleiche Koordinaten', u[0].E === 81511.538 && u[1].E === 81511.538 && u[1].N === 238504.567 && u[1].H === 571.144, JSON.stringify(u.slice(0,2)));
check('PID mit führenden Nullen (ARDIG) bleibt erhalten', u[0].pid === '0012A02001', u[0].pid);
check('Polar-Zeile erkannt', u[2].polar && u[2].E === null);
check('Keine Laufzeitfehler', errors.length === 0, errors.join(' | '));
await browser.close();
const passed = results.filter(r => r.ok).length;
console.log(JSON.stringify({ passed, total: results.length }));
if (passed !== results.length) process.exitCode = 1;
