import type { Options, Verdict } from "./types";

const KEY = "parola.progress.v1";

export interface WordStat {
  /** Leitner-doos 0-5: hoe hoger, hoe langer je het woord niet terugziet. */
  box: number;
  seen: number;
  correct: number;
  /** aantal keer juist op rij */
  streak: number;
  /** timestamp waarop het woord weer aan de beurt is */
  due: number;
  last: number;
}

export interface SessionResult {
  at: number;
  mode: string;
  lessons: number[];
  correct: number;
  total: number;
  /** duur in seconden */
  seconds: number;
}

export interface Progress {
  version: 1;
  xp: number;
  /** wordKey -> stat */
  words: Record<string, WordStat>;
  /** "2026-09-21" -> aantal beantwoorde vragen */
  days: Record<string, number>;
  sessions: SessionResult[];
  options: Partial<Options>;
  theme: "light" | "dark";
  audio: boolean;
  bestStreak: number;
}

const EMPTY: Progress = {
  version: 1,
  xp: 0,
  words: {},
  days: {},
  sessions: [],
  options: {},
  theme: "light",
  audio: true,
  bestStreak: 0,
};

/** localStorage kan gooien in private mode of met geblokkeerde cookies. */
function safeRead(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Progress;
    if (parsed?.version !== 1) return { ...EMPTY };
    return { ...EMPTY, ...parsed, words: parsed.words ?? {}, days: parsed.days ?? {} };
  } catch {
    return { ...EMPTY };
  }
}

let cache: Progress = safeRead();
const listeners = new Set<(p: Progress) => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Vol of geblokkeerd: de app blijft gewoon werken, alleen zonder bewaren.
  }
  for (const fn of listeners) fn(cache);
}

export function getProgress(): Progress {
  return cache;
}

export function subscribe(fn: (p: Progress) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function update(patch: (p: Progress) => Progress): void {
  cache = patch(cache);
  persist();
}

export function today(): string {
  return new Date().toLocaleDateString("sv-SE"); // sv-SE geeft YYYY-MM-DD in lokale tijd
}

/** Hoeveel dagen op rij is er geoefend, tot en met vandaag of gisteren. */
export function dayStreak(days: Record<string, number>): number {
  const has = (d: Date) => (days[d.toLocaleDateString("sv-SE")] ?? 0) > 0;
  const cursor = new Date();
  if (!has(cursor)) {
    cursor.setDate(cursor.getDate() - 1);
    if (!has(cursor)) return 0;
  }
  let streak = 0;
  while (has(cursor)) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Wachttijd per Leitner-doos, in dagen. */
const BOX_DELAY_DAYS = [0, 1, 2, 4, 8, 21];

export function recordAnswer(key: string, verdict: Verdict, xpGain: number): void {
  update((p) => {
    const prev: WordStat = p.words[key] ?? {
      box: 0,
      seen: 0,
      correct: 0,
      streak: 0,
      due: 0,
      last: 0,
    };
    const good = verdict === "correct";
    const box = good
      ? Math.min(5, prev.box + 1)
      : verdict === "almost"
        ? prev.box
        : 0;
    const now = Date.now();
    const stat: WordStat = {
      box,
      seen: prev.seen + 1,
      correct: prev.correct + (good ? 1 : 0),
      streak: good ? prev.streak + 1 : 0,
      due: now + BOX_DELAY_DAYS[box] * 86_400_000,
      last: now,
    };
    const day = today();
    return {
      ...p,
      xp: p.xp + xpGain,
      words: { ...p.words, [key]: stat },
      days: { ...p.days, [day]: (p.days[day] ?? 0) + 1 },
    };
  });
}

export function recordSession(result: SessionResult): void {
  update((p) => ({ ...p, sessions: [result, ...p.sessions].slice(0, 50) }));
}

export function resetProgress(): void {
  update((p) => ({ ...EMPTY, theme: p.theme, audio: p.audio }));
}

/** Level 1 begint op 0 xp, elk level kost 120 xp meer dan het vorige. */
export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let need = 200;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level++;
    need += 120;
  }
  return { level, into: rest, need };
}
