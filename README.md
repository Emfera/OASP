# OASP – Open Archaeological Surveying Pipeline

Offene, browserbasierte Werkzeuge zwischen Feldvermessung (Tachymeter, GNSS) und archäologischer Dokumentation. Zwei Anwendungen auf einem gemeinsamen, getesteten Kern:

- **OASP Capture** (tachylog): Live-Logger für Leica-Tachymeter, optional
- **OASP Review**: Import, Kontrolle, Korrektur, 2D/3D-Ansicht und Export für beliebige Messquellen; geht aus OASP GSI Review v0.81 hervor

**Veröffentlichte Experimente:** https://emfera.github.io/OASP/
**Register:** [EXPERIMENTE.md](EXPERIMENTE.md)

## Arbeitsweise: erst Experiment, dann Produkt

In dieser Phase wird viel ausprobiert und verworfen. Damit das nachvollziehbar bleibt, gilt:

1. **Ein Experiment beantwortet genau eine Frage.** Es liegt in `experiments/<id>-<kurzname>/` und hat eine `experiment.json` (Frage, Kriterien, Status, Ergebnis), eine `README.md` (Vorgehen, Protokoll) und möglichst Tests in `tests/`.
   Neues Experiment anlegen: `npm run neu -- c1-logger-kern "Logger-Kern" "Bleibt nach Absturz jede Zeile erhalten?"`
2. **Status:** `offen` → `läuft` → `übernommen` oder `verworfen`. Jedes Experiment endet mit einer Entscheidung und einem Satz Begründung in `result`.
3. **Verwerfen heißt nicht löschen.** Vor dem Entfernen des Codes wird der Stand mit einem Tag gesichert (`git tag exp/c0-final`). Ordner, `experiment.json` und `README.md` bleiben, damit das Register zeigt, was versucht wurde und warum es nicht trug.
4. **Übernehmen heißt umziehen.** Was sich bewährt, wandert als getestetes Modul nach `packages/` oder in eine App unter `apps/`. Das Experiment verweist dann auf die neue Stelle.
5. **Jeder Stand ist eindeutig.** Beim Veröffentlichen bekommt jede Seite einen Versionsstempel (Commit und Datum). Er erscheint in der Seite und in jedem Feldexport. So lässt sich ein Feldergebnis immer der genauen Programmversion zuordnen.
6. **Veröffentlicht wird nur, was die Tests besteht.** Jeder Push auf `main` baut die Seite, führt alle Tests aus und veröffentlicht nur bei Erfolg auf GitHub Pages. Größere Umbauten laufen über einen Branch und Pull Request; dort laufen die Tests ebenfalls, veröffentlicht wird nichts.
7. **Keine Felddaten im Repo.** Das Repo ist öffentlich, Fundstellenkoordinaten sind es nicht. `*.gsi`, `*.zip` und `felddaten/` sind gesperrt. Testdaten nur synthetisch oder ausdrücklich freigegeben und verschoben.

## Befehle

```
npm install          # einmalig (Playwright)
npx playwright install chromium
npm run build        # erzeugt _site/ und EXPERIMENTE.md
npm test             # startet lokalen Server und führt alle Tests aus
npm test -- c0       # nur Tests eines Experiments
npm run check        # build + test
```

## Ordner

```
experiments/   ein Ordner je Experiment (Frage, Code, Tests, Protokoll)
packages/      übernommene, getestete Fachmodule (später)
apps/          Capture und Review (später)
scripts/       build, test, neues Experiment
.github/       Test und Veröffentlichung
```

Der Entwicklungsplan mit Architektur, Datenmodell und Analyse von v0.81 liegt als Dokument außerhalb des Repos und wird hierher übernommen, sobald er stabil ist.

## Lizenz

MIT – Martin Fera
