import type { Direction, Options, Question, Style, Word } from "./types";
import { WORDS, wordKey } from "./words";
import { stripGrammarLabels } from "./text";
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
  return d === "it2nl"
    ? { prompt: w.it, answer: w.nl }
    : { prompt: w.nl, answer: w.it };
}

/**
 * Afleiders van hetzelfde woordtype en liefst uit dezelfde les: die lijken
 * genoeg op het juiste antwoord om de vraag écht een vraag te maken.
 */
function buildChoices(word: Word, direction: Direction, pool: readonly Word[]): string[] {
  const correct = side(word, direction).answer;
  const correctNorm = stripGrammarLabels(correct).toLowerCase();

  const taken = new Set([correctNorm]);
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
  if (chosen.length < 3) add(WORDS);

  return shuffle([correct, ...chosen]);
}

function resolveDirection(o: Options): Direction {
  return o.direction === "mixed" ? pick<Direction>(["it2nl", "nl2it"]) : o.direction;
}

function resolveStyle(o: Options): Style {
  return o.style === "mixed" ? pick<Style>(["mcq", "type"]) : o.style;
}

/**
 * Sorteert woorden voor de herhaalmodus: wat over tijd is en wat je vaak fout
 * had komt eerst, daarna woorden die je nog nooit zag.
 */
export function reviewOrder(words: readonly Word[], stats: Record<string, WordStat>): Word[] {
  const now = Date.now();
  const score = (w: Word) => {
    const s = stats[wordKey(w)];
    if (!s) return 1_000; // nieuw woord: belangrijk, maar na de echte fouten
    const accuracy = s.seen > 0 ? s.correct / s.seen : 0;
    const overdue = Math.max(0, now - s.due) / 86_400_000;
    return -(2_000 * (1 - accuracy) + 40 * overdue + (s.box === 0 ? 500 : 0));
  };
  return [...words].sort((a, b) => score(a) - score(b));
}

export function selectWords(o: Options, stats: Record<string, WordStat>): Word[] {
  const lessons = new Set(o.lessons);
  const pool = WORDS.filter((w) => lessons.has(w.l));
  if (pool.length === 0) return [];

  const ordered = o.mode === "review" ? reviewOrder(pool, stats) : shuffle(pool);
  const limit = o.count > 0 ? Math.min(o.count, ordered.length) : ordered.length;
  const picked = ordered.slice(0, limit);
  // In herhaalmodus kiezen we gericht, maar vragen stellen we wel door elkaar.
  return o.mode === "review" ? shuffle(picked) : picked;
}

export function buildQuestions(o: Options, stats: Record<string, WordStat>): Question[] {
  const words = selectWords(o, stats);
  const lessons = new Set(o.lessons);
  const pool = WORDS.filter((w) => lessons.has(w.l));

  return words.map((word, i) => {
    const direction = resolveDirection(o);
    const style = resolveStyle(o);
    const { prompt, answer } = side(word, direction);
    return {
      id: `${wordKey(word)}#${i}`,
      word,
      direction,
      style,
      prompt,
      answer,
      choices: style === "mcq" ? buildChoices(word, direction, pool) : [],
    };
  });
}

/** Eén extra beurt voor een woord dat je net fout had. */
export function requeue(q: Question, pool: readonly Word[]): Question {
  return {
    ...q,
    id: `${q.id}~r${Math.random().toString(36).slice(2, 7)}`,
    choices: q.style === "mcq" ? buildChoices(q.word, q.direction, pool) : [],
  };
}

/** Meer punten voor typen dan voor aanklikken, en een bonus voor je reeks. */
export function xpFor(style: Style, verdict: string, streak: number): number {
  if (verdict === "wrong") return 0;
  const base = style === "type" ? 12 : 7;
  const almostPenalty = verdict === "almost" ? 0.5 : 1;
  const streakBonus = Math.min(10, Math.floor(streak / 3) * 2);
  return Math.round(base * almostPenalty) + streakBonus;
}
