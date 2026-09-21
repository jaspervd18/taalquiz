import type { Direction, Options, Question, Style, Word } from "./types";
import { WORDS, wordKey, isSentenceLesson } from "./words";
import { stripGrammarLabels, tokenize } from "./text";
import type { WordStat } from "./storage";

export function shuffle<T>(input: readonly T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(a: readonly T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

function side(w: Word, d: Direction): { prompt: string; answer: string } {
  return d === "it2nl" ? { prompt: w.it, answer: w.nl } : { prompt: w.nl, answer: w.it };
}

const isSentence = (w: Word) => w.t === "sentence";

/**
 * Afleiders van hetzelfde woordtype en liefst uit dezelfde les: die lijken
 * genoeg op het juiste antwoord om de vraag echt een vraag te maken.
 */
function buildChoices(word: Word, direction: Direction, pool: readonly Word[]): string[] {
  const correct = side(word, direction).answer;
  const taken = new Set([stripGrammarLabels(correct).toLowerCase()]);
  const chosen: string[] = [];

  const add = (candidates: readonly Word[]) => {
    for (const c of shuffle(candidates)) {
      if (chosen.length >= 3) return;
      const text = side(c, direction).answer;
      const norm = stripGrammarLabels(text).toLowerCase();
      if (taken.has(norm)) continue;
      taken.add(norm);
      chosen.push(text);
    }
  };

  add(pool.filter((w) => w.t === word.t && w.l === word.l));
  if (chosen.length < 3) add(pool.filter((w) => w.t === word.t));
  if (chosen.length < 3) add(WORDS.filter((w) => w.t === word.t));
  if (chosen.length < 3) add(WORDS.filter((w) => isSentence(w) === isSentence(word)));

  return shuffle([correct, ...chosen]);
}

/**
 * Bouwt de blokjes voor de volgordeoefening: de juiste woorden door elkaar,
 * plus een paar lokkers uit andere zinnen van hetzelfde pakket.
 */
function buildTokens(
  answer: string,
  pool: readonly Word[],
  direction: Direction,
): { tokens: string[]; solution: string[] } {
  const solution = tokenize(answer);
  const used = new Set(solution.map((t) => t.toLowerCase()));

  const decoys: string[] = [];
  const wanted = solution.length >= 4 ? 2 : solution.length >= 3 ? 1 : 0;
  for (const other of shuffle(pool.filter(isSentence))) {
    if (decoys.length >= wanted) break;
    for (const t of shuffle(tokenize(side(other, direction).answer))) {
      if (decoys.length >= wanted) break;
      if (used.has(t.toLowerCase())) continue;
      used.add(t.toLowerCase());
      decoys.push(t);
    }
  }

  let tokens = shuffle([...solution, ...decoys]);
  // Als het toeval de juiste volgorde teruggeeft, nog eens schudden.
  if (decoys.length === 0 && tokens.join(" ") === solution.join(" ") && solution.length > 1) {
    tokens = shuffle(tokens);
  }
  return { tokens, solution };
}

function resolveDirection(o: Options): Direction {
  return o.direction === "mixed" ? pick<Direction>(["it2nl", "nl2it"]) : o.direction;
}

/** De volgordeoefening bestaat alleen voor zinnen; een woord valt terug op typen. */
function resolveStyle(o: Options, word: Word): Style {
  if (o.style === "mixed") {
    return pick<Style>(isSentence(word) ? ["mcq", "type", "order"] : ["mcq", "type"]);
  }
  if (o.style === "order" && !isSentence(word)) return "type";
  return o.style;
}

/**
 * Sorteert voor de herhaalmodus: wat je vaak fout had en wat over tijd is komt
 * eerst, daarna woorden die je nog nooit zag.
 */
export function reviewOrder(words: readonly Word[], stats: Record<string, WordStat>): Word[] {
  const now = Date.now();
  const score = (w: Word) => {
    const s = stats[wordKey(w)];
    if (!s) return 1_000;
    const accuracy = s.seen > 0 ? s.correct / s.seen : 0;
    const overdue = Math.max(0, now - s.due) / 86_400_000;
    return -(2_000 * (1 - accuracy) + 40 * overdue + (s.box === 0 ? 500 : 0));
  };
  return [...words].sort((a, b) => score(a) - score(b));
}

/** Woorden uit lessen die je nu niet oefent, maar die wel aan herhaling toe zijn. */
export function dueElsewhere(
  selected: ReadonlySet<number>,
  stats: Record<string, WordStat>,
  limit: number,
): Word[] {
  if (limit <= 0) return [];
  const now = Date.now();
  const due = WORDS.filter((w) => {
    if (selected.has(w.l)) return false;
    const s = stats[wordKey(w)];
    return s !== undefined && s.box >= 1 && s.due <= now;
  });
  return shuffle(due).slice(0, limit);
}

export function selectWords(o: Options, stats: Record<string, WordStat>): Word[] {
  const lessons = new Set(o.lessons);
  const pool = WORDS.filter((w) => lessons.has(w.l));
  if (pool.length === 0) return [];

  // In "les afmaken" doe je altijd de hele les, het aantal telt daar niet.
  if (o.mode === "complete") return shuffle(pool);

  const ordered = o.mode === "review" ? reviewOrder(pool, stats) : shuffle(pool);
  const limit = o.count > 0 ? Math.min(o.count, ordered.length) : ordered.length;
  const picked = ordered.slice(0, limit);
  return o.mode === "review" ? shuffle(picked) : picked;
}

function makeQuestion(
  word: Word,
  o: Options,
  pool: readonly Word[],
  index: number,
  isReview: boolean,
): Question {
  const direction = resolveDirection(o);
  const style = resolveStyle(o, word);
  const { prompt, answer } = side(word, direction);
  const order = style === "order" ? buildTokens(answer, pool, direction) : null;

  return {
    id: `${wordKey(word)}#${index}`,
    word,
    direction,
    style,
    prompt,
    answer,
    choices: style === "mcq" ? buildChoices(word, direction, pool) : [],
    tokens: order?.tokens ?? [],
    solution: order?.solution ?? [],
    isReview,
  };
}

export function buildQuestions(o: Options, stats: Record<string, WordStat>): Question[] {
  const words = selectWords(o, stats);
  if (words.length === 0) return [];

  const lessons = new Set(o.lessons);
  const pool = WORDS.filter((w) => lessons.has(w.l));

  const main = words.map((w, i) => makeQuestion(w, o, pool, i, false));

  // Een vijfde erbij uit eerdere lessen, zodat oude stof blijft terugkomen.
  if (!o.mixReview || o.mode === "review") return main;
  const extra = dueElsewhere(lessons, stats, Math.min(8, Math.round(main.length * 0.2)));
  if (extra.length === 0) return main;

  const reviewQuestions = extra.map((w, i) =>
    makeQuestion(w, o, WORDS.filter((x) => x.l === w.l), main.length + i, true),
  );
  return shuffle([...main, ...reviewQuestions]);
}

/** Eén extra beurt voor een woord dat je net fout had. */
export function requeue(q: Question, pool: readonly Word[]): Question {
  const order =
    q.style === "order" ? buildTokens(q.answer, pool, q.direction) : null;
  return {
    ...q,
    id: `${q.id}~r${Math.random().toString(36).slice(2, 7)}`,
    choices: q.style === "mcq" ? buildChoices(q.word, q.direction, pool) : [],
    tokens: order?.tokens ?? [],
    solution: order?.solution ?? [],
  };
}

/** Meer punten voor zelf schrijven dan voor aanklikken, en een bonus voor je reeks. */
export function xpFor(style: Style, verdict: string, streak: number): number {
  if (verdict === "wrong") return 0;
  const base = style === "type" ? 12 : style === "order" ? 10 : 7;
  const almostPenalty = verdict === "almost" ? 0.5 : 1;
  const streakBonus = Math.min(10, Math.floor(streak / 3) * 2);
  return Math.round(base * almostPenalty) + streakBonus;
}

export { isSentenceLesson };
