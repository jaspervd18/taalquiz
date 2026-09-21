import rawWords from "../data/words.json";
import rawLessons from "../data/lessons.json";
import type { Word } from "./types";

export const WORDS = rawWords as Word[];

export const LESSON_TITLES = rawLessons as Record<string, string>;

export const LESSON_NUMBERS: number[] = [...new Set(WORDS.map((w) => w.l))].sort(
  (a, b) => a - b,
);

/** Lessen 1-41 komen uit de cursus, alles daarboven zijn de bonuspakketten. */
export const COURSE_LESSONS = LESSON_NUMBERS.filter((n) => n < 100);
export const BONUS_LESSONS = LESSON_NUMBERS.filter((n) => n >= 100);

export function lessonTitle(n: number): string {
  return LESSON_TITLES[String(n)] ?? `Les ${n}`;
}

/** Alleen het deel na "Les 3: ", want het lesnummer staat er al naast. */
export function lessonSubtitle(n: number): string {
  return lessonTitle(n).replace(/^(Les|Bonus)\s*\d+\s*:\s*/i, "");
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
