# Portefølje – Henrik Olden Johansen

Min personlige porteføljenettside, laget i faget Utvikling. Stil inspirert av bakkestasjoner og satellittdata, rettet mot romfartsbransjen (SpaceTec, obviously).

## Teknologi

- **HTML** – semantisk struktur
- **CSS** – en stilfil med CSS-variabler, Grid/Flexbox og media queries
- **JavaScript** – mobilmeny og markering av hvor du er på siden
- **Sanntidssporing** (`js/sporing.js`) – satellitten i TLE-settet på forsiden beregnes live (Keplerbane + J2, GMST, elevasjon fra Tromsø) og vises på kartet, med tid til neste passering over Tromsø (kopierte bare koden fra prosjektet jeg hadde på SpaceTec)
- **SVG** – bakkesporet tegnes fra JavaScript, og diagrammet i prosjektdelen er generert av mitt C++-program for TLE-analyse

## Data

Verdenskartet (`img/verden.svg`) er en punktmatrise laget fra [Natural Earth](https://www.naturalearthdata.com/) (public domain) via [world-atlas](https://github.com/topojson/world-atlas) (ISC-lisens).

## Filstruktur

```
portfolio/
├── index.html
├── css/style.css
├── js/        main.js og sporing.js
├── fonts/      lokale fonter (woff2) + lisenser
└── img/        egne SVG-illustrasjoner
```

## Kjøre lokalt

Åpne `index.html` i nettleseren, eller bruk Live Server i VS Code.

## Tilgjengelighet

- «Hopp til innhold»-lenke og synlig fokusmarkering
- Kontrast på minst 4,5 : 1 på all tekst
- `prefers-reduced-motion` slår av animasjoner
- Mobilmeny med `aria-expanded`

## Fonter

Fontene ligger lokalt (GDPR) og er kuttet ned til bare de tegnene siden bruker:

- [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans)
- [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono)

Alle er lisensiert under SIL Open Font License 1.1 (se `fonts/OFL-*.txt`).
