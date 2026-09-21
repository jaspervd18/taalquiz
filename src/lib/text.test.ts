import { describe, expect, it } from "vitest";
import { buildAnswerSet, judge, levenshtein, stripGrammarLabels } from "./text";
import { WORDS } from "./words";

describe("stripGrammarLabels", () => {
  it("haalt geslachts- en meervoudslabels weg", () => {
    expect(stripGrammarLabels("la lezione (f)")).toBe("la lezione");
    expect(stripGrammarLabels("gli anni (m, pl)")).toBe("gli anni");
    expect(stripGrammarLabels("il/la collega (m/f)")).toBe("il/la collega");
  });

  it("laat haakjes staan die bij het woord horen", () => {
    expect(stripGrammarLabels("(da) dove")).toBe("(da) dove");
    expect(stripGrammarLabels("heet (heten)")).toBe("heet (heten)");
  });
});

describe("levenshtein", () => {
  it("telt losse bewerkingen", () => {
    expect(levenshtein("", "")).toBe(0);
    expect(levenshtein("casa", "casa")).toBe(0);
    expect(levenshtein("casa", "cosa")).toBe(1);
    expect(levenshtein("", "ciao")).toBe(4);
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("judge", () => {
  const cases: [string, string, string][] = [
    ["la lezione", "la lezione (f)", "correct"],
    ["lezione", "la lezione (f)", "correct"],
    ["la lezione (f)", "la lezione (f)", "correct"],
    ["  LA LEZIONE  ", "la lezione (f)", "correct"],
    ["la lezzione", "la lezione (f)", "almost"],
    ["la stazione", "la lezione (f)", "wrong"],
    ["cosi", "così", "correct"],
    ["heten", "heet (heten)", "correct"],
    ["heet", "heet (heten)", "correct"],
    ["il collega", "il/la collega (m/f)", "correct"],
    ["la collega", "il/la collega (m/f)", "correct"],
    ["da dove", "(da) dove", "correct"],
    ["dove", "(da) dove", "correct"],
    ["lo", "l', il & lo", "correct"],
    ["anni", "gli anni (m, pl)", "correct"],
    ["mettere in pedi", "mettere in piedi", "almost"],
    ["", "ciao", "wrong"],
  ];

  it.each(cases)("'%s' tegen '%s' geeft %s", (input, answer, want) => {
    expect(judge(input, answer).verdict).toBe(want);
  });

  it("laat korte woorden geen tikfout toe", () => {
    // De oude versie rekende 'solo' goed voor 'sono': twee letters verschil.
    expect(judge("solo", "sono").verdict).toBe("wrong");
    expect(judge("sono", "sono").verdict).toBe("correct");
  });

  it("legt uit waarom een antwoord niet perfect was", () => {
    expect(judge("lezione", "la lezione (f)").note).toMatch(/lidwoord/i);
    expect(judge("cosi", "così").note).toMatch(/accent/i);
  });
});

describe("de woordenlijst zelf", () => {
  it("levert voor elk veld een bruikbare antwoordset", () => {
    for (const w of WORDS) {
      for (const raw of [w.nl, w.it]) {
        const set = buildAnswerSet(raw);
        expect(set.candidates.length, `leeg voor ${JSON.stringify(raw)}`).toBeGreaterThan(0);
        expect(set.exact.size).toBeGreaterThan(0);
      }
    }
  });

  it("rekent elk eigen antwoord goed", () => {
    for (const w of WORDS) {
      expect(judge(w.it, w.it).verdict, `${w.it} faalt op zichzelf`).toBe("correct");
      expect(judge(w.nl, w.nl).verdict, `${w.nl} faalt op zichzelf`).toBe("correct");
    }
  });

  it("heeft geen lege of ongeldige rijen", () => {
    for (const w of WORDS) {
      expect(w.nl.trim()).not.toBe("");
      expect(w.it.trim()).not.toBe("");
      expect(w.l).toBeGreaterThan(0);
      expect(["noun", "verb", "adjective", "other"]).toContain(w.t);
    }
  });
});
