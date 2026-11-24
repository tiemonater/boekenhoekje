# Boekenhoekje ✨

Een kleine web-app (PWA) om je boekenkast bij te houden, en wat hij waard is.
Gemaakt voor de iPhone: zet hem op je beginscherm en gebruik hem als een gewone app.

**Online:** https://tiemonater.github.io/boekenhoekje/

## Op je iPhone zetten
1. Open de link hierboven in **Safari**.
2. Tik op **Deel** (vierkantje met pijl) → **Zet op beginscherm** → **Voeg toe**.
3. Open de app voortaan via het icoon. Hij werkt dan schermvullend, en ook zonder internet.

> Je boeken staan **alleen op je telefoon**, in de app. Maak af en toe een backup
> (tabblad Backup → Backup maken → Bewaar in Bestanden → iCloud Drive).

## Wat de app kan
- Boeken toevoegen: barcode scannen (live of via een foto), ISBN typen of zelf invullen
- Gegevens opzoeken bij Open Library en Google Books (gratis, geen account nodig)
- Eigen coverfoto's, genres (vaste lijst + eigen), leesstatus, prijs, winkel, notities
- Home: totale waarde, aantal, gemiddelde prijs, duurste boek, uitgegeven dit jaar, genres (balkjes of ring)
- Kast: zoeken, sorteren en filteren
- Leesdoel per jaar: ring met voortgang en of je op schema ligt
- Verlanglijst: boeken die je nog wilt kopen, met "Gekocht!" om ze naar je kast te verhuizen
- Backup naar een JSON-bestand en terugzetten, met herinnering
- Lichte en donkere modus (volgt je iPhone), werkt offline

## Het uiterlijk aanpassen
Alle kleuren, lettertypes, ronde hoeken en animatiesnelheid staan in **`css/theme.css`**.
Pas een waarde aan en de hele app volgt. De donkere modus staat onderaan in hetzelfde bestand.

Het app-icoon en de opstartschermen worden getekend door scripts (zie *Hulpscripts*).

## Hoe het in elkaar zit
Gewone HTML, CSS en JavaScript (ES-modules), zonder build-stap.

```
index.html             de enige pagina; alle schermen worden hierin getekend
manifest.webmanifest   naam, icoon en schermvullend openen
sw.js                  offline-kopie van de app (service worker)
css/
  theme.css            ← kleuren en lettertypes
  base.css             basis-layout, veilige randen (notch, home-balk)
  components.css       kaarten, knoppen, kast, formulieren, enz.
js/
  app.js               start de app, wisselt tussen schermen (#/kast, #/boek/<id>, …)
  db.js                opslag op het toestel (IndexedDB)
  books.js             boek-regels: velden, genres, zoeken/sorteren, statistieken
  backup.js            backup maken/terugzetten, herinnering
  lookup.js            ISBN opzoeken (Open Library, Google Books)
  scanner.js           barcode lezen (camera of foto)
  image.js             foto's verkleinen, covers downloaden
  cover.js             cover tekenen (foto of zelfgemaakte cover)
  genre-chart.js       genre-kaart op Home (balkjes / ring)
  goals.js             leesdoel: opslaan en voortgang/schema berekenen
  goal-card.js         leesdoel-kaart op Home en het instel-venster
  format.js            € 12,50 en Nederlandse datums
  ui.js, icons.js      meldingen, pop-ups, lijn-icoontjes
  views/               één bestand per scherm (home, shelf, book, form, scan, add, backup)
lib/                   html5-qrcode (barcodelezer), zie lib/README.md
icons/                 app-icoon en opstartschermen
tools/                 hulpscripts (niet nodig voor de app zelf)
```

### Een boek (datamodel)
| veld | voorbeeld | toelichting |
|---|---|---|
| `id` | `"9b68…"` | uniek, automatisch |
| `isbn` | `"9789082410617"` | |
| `title`, `author` | `"Het smelt"`, `"Lize Spit"` | titel is verplicht |
| `owned` | `true` / `false` | `false` = op de verlanglijst (telt niet mee in waarde en statistieken) |
| `cover` | Blob, `"https://…"` of `null` | in de opslag als `{ imageType, imageData }` (Safari-fix) |
| `priceCents` | `2250` | prijs in centen (€ 22,50), `null` = onbekend |
| `purchaseDate`, `store` | `"2026-11-24"`, `"De Slegte"` | |
| `format` | `hardcover` / `paperback` / `anders` | |
| `condition` | `nieuw` / `tweedehands` | |
| `status` | `wil-lezen` / `aan-het-lezen` / `gelezen` | |
| `finishedAt` | `"2026-11-24"` | uitgelezen op; alleen bij `gelezen`, telt voor het leesdoel |
| `genres` | `["Fantasy", "Romance"]` | één of meer |
| `pages`, `year`, `notes` | `480`, `2015`, `"…"` | |
| `createdAt`, `updatedAt` | ISO-datum | automatisch |

Nieuwe velden toevoegen: in `makeBook()` in `js/books.js`, het formulier (`js/views/form.js`)
en het detailscherm (`js/views/book.js`). Oude boeken zonder het veld blijven gewoon werken.

### Ideeën voor later
- **CSV-export:** naast `createBackupFile()` in `js/backup.js`.
- **Sync tussen apparaten:** vraagt een server of cloud-opslag; de backup-functies zijn een goed startpunt.

## Updates online zetten
De site draait op GitHub Pages vanaf de `main`-branch.

```bash
git add -A
git commit -m "Wat er veranderd is"
git push
```

Na een minuut of twee staat het online. Sluit de app op je iPhone en open hem opnieuw.
Heb je bestanden **toegevoegd of verwijderd**? Draai dan eerst `python3 tools/update-sw.py`,
zodat de offline-kopie ze ook meeneemt.

## Lokaal testen
```bash
python3 tools/serve.py
```
Open daarna `http://localhost:8000` op je Mac, of `http://<ip-van-je-mac>:8000` op je iPhone
(zelfde wifi). De camera werkt alleen op https, dus scannen test je op de online versie.

## Hulpscripts (tools/)
- `make-icons.py` – tekent het app-icoon (alle formaten)
- `make-splash.py` – maakt de opstartschermen (licht/donker, alle iPhone-maten) en print de `<link>`-regels voor index.html
- `update-sw.py` – werkt de bestandenlijst in `sw.js` bij
- `serve.py` – lokale testserver zonder caching

Icoon en splash hebben Python met Pillow nodig (`pip install pillow`).
