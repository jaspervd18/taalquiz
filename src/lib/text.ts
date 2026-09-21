/**
 * Alles wat met het vergelijken van antwoorden te maken heeft.
 *
 * De woordenlijst gebruikt een paar conventies die we hier uitpakken:
 *   "la lezione (f)"     -> grammaticalabel achteraan, hoort niet bij het antwoord
 *   "il/la collega (m/f)"-> schuine streep = meerdere geldige vormen
 *   "heet (heten)"       -> vervoegde vorm + infinitief, allebei goed
 *   "(da) dove"          -> het stuk tussen haakjes mag weg
 *   "l', il & lo"        -> '&' scheidt alternatieven
 */

/** Labels als (m), (f), (m/f), (m, pl) zijn grammaticahints, geen antwoord. */
const GRAMMAR_LABEL = /\s*\((?:m|f|v|o|mv|pl|m\s*\/\s*f|[mfv]\s*,\s*(?:pl|mv)|pl\s*,\s*[mfv])\)/gi;

const ARTICLES = new Set([
  // Italiaans
  "il", "lo", "la", "l'", "i", "gli", "le", "un", "uno", "una", "un'",
  // Nederlands
  "de", "het", "een",
]);

export function stripGrammarLabels(raw: string): string {
  return raw.replace(GRAMMAR_LABEL, "").replace(/\s{2,}/g, " ").trim();
}

/** Wat we op het scherm tonen als "het juiste antwoord". */
export function displayAnswer(raw: string): string {
  return raw.trim();
}

/** kleine letters, geen dubbele spaties, geen leestekens aan de rand. */
function basicNormalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/[.!?;:]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Zelfde als hierboven, maar ook zonder accenten: così -> cosi. */
export function foldAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalize(s: string): string {
  return basicNormalize(s);
}

function normalizeLoose(s: string): string {
  return foldAccents(basicNormalize(s)).replace(/[^a-z0-9' ]/g, "");
}

/** "il/la collega" -> ["il collega", "la collega"] */
function expandSlashes(variant: string): string[] {
  if (!variant.includes("/")) return [variant];
  // Getallen als "1/5" laten we met rust.
  if (/^\s*\d+\s*\/\s*\d+\s*$/.test(variant)) return [variant];

  const words = variant.split(" ");
  let results: string[] = [""];
  for (const word of words) {
    const alts = word.includes("/") && !/\d\/\d/.test(word) ? word.split("/") : [word];
    const next: string[] = [];
    for (const sofar of results) {
      for (const alt of alts) next.push(sofar ? `${sofar} ${alt}` : alt);
    }
    results = next;
  }
  return results.map((r) => r.trim()).filter(Boolean);
}

/** "(da) dove" -> ["da dove", "dove"]; "heet (heten)" -> ["heet (heten)", "heet", "heten"] */
function expandParens(variant: string): string[] {
  const match = variant.match(/\(([^)]*)\)/);
  if (!match) return [variant];

  const inner = match[1].trim();
  const withInner = variant.replace(match[0], inner);
  const withoutInner = variant.replace(match[0], " ");
  // Bij "heet (heten)" is het stuk tussen haakjes zelf ook een geldig antwoord.
  const innerAlone = inner;

  return [withInner, withoutInner, innerAlone]
    .flatMap(expandParens)
    .map((s) => s.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
}

function dropLeadingArticle(variant: string): string | null {
  const words = variant.split(" ");
  if (words.length < 2) return null;
  const first = words[0].toLowerCase();
  if (ARTICLES.has(first)) return words.slice(1).join(" ");
  // l'acqua -> acqua
  const elided = variant.match(/^(l|un|dell|nell|all)'(.+)$/i);
  if (elided) return elided[2];
  return null;
}

export interface AnswerSet {
  /** Streng: exact goed (accenten en al). */
  exact: Set<string>;
  /** Soepel: goed, maar zonder accenten of zonder lidwoord. */
  loose: Set<string>;
  /** Voor foutmarge-vergelijking. */
  candidates: string[];
  /** Is elk geldig antwoord alleen bereikbaar zonder lidwoord weg te laten? */
  articleOptional: Set<string>;
}

/** Bouwt alle vormen die we als antwoord accepteren voor één woord. */
export function buildAnswerSet(raw: string): AnswerSet {
  const base = stripGrammarLabels(raw);

  const seeds = base
    .split(/\s*&\s*|\s*,\s*(?![^(]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);

  const variants = new Set<string>();
  for (const seed of seeds) {
    for (const noParens of expandParens(seed)) {
      for (const noSlash of expandSlashes(noParens)) {
        const v = noSlash.trim();
        if (v) variants.add(v);
      }
    }
  }
  if (variants.size === 0) variants.add(base);

  const exact = new Set<string>();
  const loose = new Set<string>();
  const articleOptional = new Set<string>();

  for (const v of variants) {
    exact.add(normalize(v));
    loose.add(normalizeLoose(v));
    const noArticle = dropLeadingArticle(v);
    if (noArticle) {
      const n = normalizeLoose(noArticle);
      loose.add(n);
      articleOptional.add(n);
    }
  }
  // Ook het onbewerkte origineel accepteren, inclusief "(f)".
  exact.add(normalize(raw));
  loose.add(normalizeLoose(raw));

  return { exact, loose, candidates: [...variants], articleOptional };
}

/** Klassieke Levenshtein-afstand, iteratief met één rij geheugen. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr.slice();
  }
  return prev[b.length];
}

/**
 * De oude versie liet altijd 2 tikfouten toe, waardoor "sono" en "solo"
 * allebei goed waren. De marge schaalt nu mee met de lengte van het woord.
 */
function typoBudget(length: number): number {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  if (length <= 12) return 2;
  return 3;
}

export type Verdict = "correct" | "almost" | "wrong";

export interface Judgement {
  verdict: Verdict;
  /** Korte uitleg als het antwoord net niet perfect was. */
  note?: string;
}

export function judge(input: string, raw: string): Judgement {
  const answers = buildAnswerSet(raw);
  const typed = normalize(input);
  const typedLoose = normalizeLoose(input);

  if (!typed) return { verdict: "wrong" };
  if (answers.exact.has(typed)) return { verdict: "correct" };

  if (answers.loose.has(typedLoose)) {
    if (answers.articleOptional.has(typedLoose)) {
      return { verdict: "correct", note: "Lidwoord vergeten, hier telt het toch mee." };
    }
    return { verdict: "correct", note: "Accenten kloppen niet helemaal." };
  }

  let best = Infinity;
  for (const candidate of answers.candidates) {
    const c = normalizeLoose(candidate);
    if (!c) continue;
    const d = levenshtein(typedLoose, c);
    if (d < best) best = d;
  }

  const shortest = Math.min(
    ...answers.candidates.map((c) => normalizeLoose(c).length).filter((n) => n > 0),
  );
  if (best <= typoBudget(shortest)) {
    return { verdict: "almost", note: "Kleine schrijffout." };
  }

  return { verdict: "wrong" };
}
