# Parola

Speelse trainer voor Italiaanse woordenschat. Gebouwd rond een woordenlijst van
41 cursuslessen, aangevuld met 13 thematische bonuspakketten.

**2449 woorden, 130 zinnen, alles lokaal in je browser**

## Wat het doet

- **Drie antwoordvormen**: kiezen uit vier opties, zelf typen, of een zin uit
  losse woorden in de juiste volgorde leggen. Elk apart of door elkaar, en in
  beide richtingen.
- **Vier spelmodi**: Test (score op het einde), Oefenen (fouten komen terug, met
  een limiet van twee herkansingen per woord), Slim herhalen (je zwakste en
  langst niet geziene woorden eerst) en Les afmaken, dat pas eindigt als elk
  woord van de les minstens één keer juist zat.
- **Herhaling tussendoor**: optioneel mengt de app een vijfde extra vragen bij
  uit lessen die je al deed en die aan herhaling toe zijn. Die vragen krijgen
  een merkje, zodat je ziet waar ze vandaan komen.
- **130 zinnen** in tien thematische pakketten, los van de woordenlijst.
- **Slim nakijken**: `la lezione (f)` accepteert ook `la lezione` en `lezione`,
  `heet (heten)` accepteert beide vormen, `cosi` telt als juist voor `così` met
  een opmerking over het accent, en de toegestane tikfoutmarge schaalt mee met
  de lengte van het woord.
- **Uitspraak** van elk woord via de Web Speech API van de browser.
- **Voortgang**: XP en levels, dagstreak, een activiteitenkalender, beheersing
  per les en een lijst van je lastigste woorden.

Alles wordt bewaard in `localStorage`. Geen account, geen server, geen tracking.

## Lokaal draaien

```bash
npm install
npm run dev
```

| Commando | Wat het doet |
| --- | --- |
| `npm run dev` | ontwikkelserver |
| `npm run build` | typecheck plus productiebundel in `dist/` |
| `npm test` | unittests van de nakijklogica en de woordenlijst |
| `npm run lint` | oxlint |

## Opbouw

```
src/
  data/words.json      de woordenlijst (les, nl, it, woordsoort)
  data/sentences.json  de zinnen, zelfde vorm met woordsoort "sentence"
  data/lessons.json    lestitels
  lib/text.ts          antwoorden vergelijken, Levenshtein, varianten, zinnen
                       opsplitsen in blokjes
  lib/quiz.ts          vragen bouwen, afleiders kiezen, XP berekenen
  lib/storage.ts       localStorage, Leitner-dozen, levels
  lib/speech.ts        uitspraak via de Web Speech API
  lib/sfx.ts           geluidjes via de Web Audio API
  components/          de schermen, de volgordeoefening en de bouwstenen
```

### De woordenlijst uitbreiden

Voeg regels toe aan `src/data/words.json`:

```json
{ "l": 42, "nl": "de sleutel", "it": "la chiave (f)", "t": "noun" }
```

`t` is `noun`, `verb`, `adjective` of `other`. Lesnummers bepalen de groep:
1 tot 99 is de cursus, 100 tot 199 zijn bonuspakketten, vanaf 200 zijn het
zinnen (die krijgen `"t": "sentence"` en gaan in `sentences.json`). De titel
zet je in `src/data/lessons.json`. De tests controleren dat elk woord en elke
zin zichzelf juist rekent, dus draai `npm test` erna.

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Vitest.
