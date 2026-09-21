import rawWords from "../data/words.json";
import rawSentences from "../data/sentences.json";
import rawLessons from "../data/lessons.json";
import type { Word } from "./types";

/** Woorden en zinnen zitten in dezelfde lijst; het lesnummer zegt wat het is. */
export const WORDS: Word[] = [...(rawWords as Word[]), ...(rawSentences as Word[])];

export const LESSON_TITLES = rawLessons as Record<string, string>;

export const LESSON_NUMBERS: number[] = [...new Set(WORDS.map((w) => w.l))].sort(
  (a, b) => a - b,
);

export const COURSE_LESSONS = LESSON_NUMBERS.filter((n) => n < 100);
export const BONUS_LESSONS = LESSON_NUMBERS.filter((n) => n >= 100 && n < 200);
export const SENTENCE_LESSONS = LESSON_NUMBERS.filter((n) => n >= 200);

export const isSentenceLesson = (n: number) => n >= 200;

export function lessonTitle(n: number): string {
  return LESSON_TITLES[String(n)] ?? `Les ${n}`;
}

/** Alleen het deel na "Les 3: ", want het nummer staat er al naast. */
export function lessonSubtitle(n: number): string {
  return lessonTitle(n).replace(/^(Les|Bonus|Zinnen)\s*\d+\s*:\s*/i, "");
}

export const WORDS_BY_LESSON = new Map<number, Word[]>();
for (const w of WORDS) {
  const list = WORDS_BY_LESSON.get(w.l);
  if (list) list.push(w);
  else WORDS_BY_LESSON.set(w.l, [w]);
}

export function wordKey(w: Word): string {
  return `${w.l}|${w.it}|${w.nl}`;
}
