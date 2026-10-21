# C0 – Web-Serial-Logger für Leica TS07 (tachylog, Machbarkeitstest)

Eine einzelne HTML-Seite. Sie prüft, ob ein Leica TS07 per Bluetooth direkt im Browser geloggt werden kann, ohne dass bei Verbindungsabbrüchen Daten verloren gehen. Ausgewertet wird nichts: keine Karte, keine Projektdaten.

## Was die Seite tut

1. Verbindet sich per Web Serial mit dem gekoppelten TS07 (Bluetooth SPP oder Kabel).
2. Zerlegt den Datenstrom in GSI-Zeilen (Zeilenende CR/LF, LF oder CR).
3. Sichert jede Zeile zweifach: in einer Datei im Browser-Dateisystem (OPFS, mit `flush()`) und in IndexedDB (`durability: strict`). Erst wenn beide bestätigt haben, erscheint die Zeile in der Liste.
4. Verkettet alle Zeilen mit SHA-256. Jede Zeile enthält den Hash ihrer Vorgängerin.
5. Bricht die Verbindung mitten in einer Zeile ab, wird der Rest als **Fragment** gesichert, nicht verworfen.
6. Bei einem Abbruch gibt es Alarm (rote Anzeige, Ton, Vibration). Danach versucht die Seite alle 2,5 s, die Verbindung neu aufzubauen.
7. Nach Neuladen, Absturz oder leerem Akku setzt die Seite die offene Sitzung fort. Beide Speicher werden abgeglichen; was einem fehlt, wird aus dem anderen ergänzt.
8. Der Export liefert ein ZIP mit `raw.gsi` (vollständige Zeilen, Byte für Byte), `raw.jsonl` (alle Zeilen und Fragmente mit Zeitstempel und Hash), `events.json` (Verbindungs- und Sichtbarkeitsereignisse) und `manifest.json` (Prüfsummen und Prüfergebnis).

Die Koordinaten in der Liste werden mit der GSI-Einheit gelesen (mm, 0,1 mm, 0,01 mm). Damit ist Befund 1 aus v0.81 hier bereits berücksichtigt.

## Voraussetzungen

- **Browser:** Chrome oder Edge. Auf Android ist Chrome 138 oder neuer nötig. iPhone und iPad können Web Serial nicht nutzen.
- **HTTPS:** Die Seite muss über HTTPS laufen. Veröffentlichte Fassung: https://emfera.github.io/OASP/experiments/c0-webserial-logger/ – die Versionsnummer steht neben dem Titel. Am Notebook geht auch `http://localhost`:
  ```
  python -m http.server 8000
  ```
  Danach `http://localhost:8000` öffnen.
- **TS07 einmal im Betriebssystem koppeln** (Bluetooth-Einstellungen).
- **TS07-Ausgabe:** Daten → Ausgabe → Schnittstelle, GSI16, eine **Maske mit Koordinaten (81/82/83)**. Die Liste zeigt einen Hinweis, wenn nur Polarwerte ankommen.

### Vorschau in der Claude-App oder in anderen eingebetteten Ansichten

Solche Vorschauen sind abgeschottet. Die Seite läuft dort trotzdem, aber eingeschränkt:

- Den Hintergrund-Worker darf sie dort nicht starten. Sie schreibt dann ohne Worker ins Dateisystem (Kopfzeile: „ohne Worker“) oder, wenn auch das gesperrt ist, nur in IndexedDB (rote Kopfzeile „nur IndexedDB“).
- Bluetooth und serielle Schnittstellen sind dort gesperrt. Verbinden geht nicht, der Simulator schon.

Für den Feldtest die Seite deshalb **direkt in Chrome** öffnen. Für Tests lassen sich die Speicherwege mit `?noworker` bzw. `?noworker&noopfs` an der Adresse erzwingen.

## Feldtest (Abnahme C0)

Auf zwei Geräten durchführen: einem Android-Handy und einem Windows-Notebook bzw. Toughbook.

| Schritt | Vorgehen | Erwartung |
| --- | --- | --- |
| 1 | Seite öffnen, „Mit TS07 verbinden“, TS07 wählen | grüne Anzeige „Verbunden – bereit“ |
| 2 | 50 Punkte messen | 50 Zeilen gesichert, Koordinaten plausibel |
| 3 | Bluetooth am Handy aus- und wieder einschalten | roter Alarm; danach selbstständig wieder verbunden |
| 4 | Mit dem TS07 außer Reichweite gehen (≈ 30 m), zurückkommen | wie 3 |
| 5 | TS07 aus- und einschalten | wie 3 |
| 6 | **Während der Trennung** am TS07 einen Punkt auslösen | Notieren, was das TS07 meldet (Fehler? Speichert es intern?). Die Liste zeigt nach der Neuverbindung „Lücke“ |
| 7 | Bildschirm sperren, 1 min warten, Punkte messen, entsperren | Notieren, ob Punkte während der Sperre ankamen (Protokoll: „Seite verborgen“) |
| 8 | Browser-Tab schließen, Seite neu öffnen | Sitzung fortgesetzt, Zählerstand gleich |
| 9 | Auf insgesamt 200 Punkte bringen, dabei mindestens 5 Abbrüche | – |
| 10 | „Speicher prüfen“ | „kein Datenverlust, beide Speicher stimmen überein“ |
| 11 | „Export (ZIP)“ | ZIP mit vier Dateien; `raw.gsi` öffnet in v0.81 |

Bitte ZIP und Notizen zu den Schritten 6 und 7 zurückschicken. Sie entscheiden über die Regeln für C1: Darf während einer Trennung gemessen werden? Braucht Android einen Hinweis „Bildschirm anlassen“?

## Automatischer Test (ohne Instrument)

Ein Simulator auf der Seite erzeugt GSI16-Zeilen. Sie laufen durch denselben Speicherweg wie echte Daten. Der automatische Test (Playwright, Chromium) prüft:

- 205 Zeilen mit 5 Abbrüchen mitten in einer Zeile und einem Block aus 20 Zeilen
- Neuladen während der Aufnahme
- Absturzreparatur in beide Richtungen: IndexedDB-Eintrag fehlt; `raw.jsonl` endet mit halber Zeile und `raw.gsi` ist zu kurz
- ZIP-Export, Einheitenumrechnung, führende Nullen im PID

Stand 21.10.2026: 11 von 11 Prüfungen bestanden, jeweils mit und ohne Worker; zusätzlich geprüft: nur IndexedDB und eine Sicherheitsregel, die Worker verbietet.

## Bekannte Grenzen

- Was der TS07 sendet, solange keine Verbindung besteht, kann keine Software empfangen. Ob das Instrument dabei einen Fehler meldet, klärt Schritt 6.
- Browserspeicher hängt am Browserprofil. „Websitedaten löschen“ löscht auch die Messungen. Deshalb nach jedem Feldtag exportieren.
- „Speicher nicht dauerhaft“ in der Kopfzeile bedeutet: Der Browser darf bei Platzmangel löschen. Chrome gewährt dauerhaften Speicher meist erst, wenn die Seite installiert ist oder öfter genutzt wurde.

## Für spätere Versionen vorgemerkt

- **Start ohne Netz:** C0 muss online geladen werden. C1 bekommt einen Offline-Speicher der App (Service Worker), damit sie auch ohne Empfang startet.
- **Exportziel wählen:** Auf Android über das Teilen-Menü (Drive, Mail, Ordner), am Computer mit „Speichern unter“, sonst normaler Download. Bis dahin: In Chrome unter Einstellungen → Downloads „Speicherort für Downloads erfragen“ einschalten.
