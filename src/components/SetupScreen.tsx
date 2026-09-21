import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import type { Options } from "../lib/types";
import {
  BONUS_LESSONS,
  COURSE_LESSONS,
  SENTENCE_LESSONS,
  WORDS,
  WORDS_BY_LESSON,
  lessonSubtitle,
  wordKey,
} from "../lib/words";
import type { Progress } from "../lib/storage";
import { Button, Card, Chip, SectionTitle, spring } from "./ui";

interface Props {
  options: Options;
  setOptions: (patch: Partial<Options>) => void;
  progress: Progress;
  onStart: () => void;
}

const DIRECTIONS: { value: Options["direction"]; label: string; sub: string }[] = [
  { value: "it2nl", label: "IT naar NL", sub: "Italiaans begrijpen" },
  { value: "nl2it", label: "NL naar IT", sub: "Italiaans schrijven" },
  { value: "mixed", label: "Door elkaar", sub: "beide richtingen" },
];

const STYLES: { value: Options["style"]; label: string; sub: string }[] = [
  { value: "mcq", label: "Kiezen", sub: "4 opties" },
  { value: "type", label: "Typen", sub: "zelf schrijven" },
  { value: "order", label: "Volgorde", sub: "zinnen bouwen" },
  { value: "mixed", label: "Door elkaar", sub: "afwisselend" },
];

const MODES: { value: Options["mode"]; label: string; sub: string; emoji: string }[] = [
  { value: "test", label: "Test", sub: "score op het einde", emoji: "🎯" },
  { value: "practice", label: "Oefenen", sub: "fouten komen terug", emoji: "🔁" },
  { value: "review", label: "Slim herhalen", sub: "zwakke woorden eerst", emoji: "🧠" },
  { value: "complete", label: "Les afmaken", sub: "door tot alles juist is", emoji: "🏁" },
];

const COUNTS = [10, 20, 40, 0];

/** Hoe ver een les staat: het aandeel dat al juist ging, en of ze helemaal rond is. */
function lessonProgress(lesson: number, progress: Progress) {
  const words = WORDS_BY_LESSON.get(lesson) ?? [];
  if (words.length === 0) return { mastery: 0, done: false };
  let known = 0;
  let seen = 0;
  for (const w of words) {
    const s = progress.words[wordKey(w)];
    if (s && s.box >= 2) known++;
    if (s && s.box >= 1) seen++;
  }
  return { mastery: known / words.length, done: seen === words.length };
}

function MasteryBar({ pct, light }: { pct: number; light?: boolean }) {
  if (pct <= 0) return null;
  return (
    <span
      aria-hidden
      className={`absolute inset-x-0 bottom-0 h-1.5 rounded-b-2xl ${light ? "bg-on-accent/70" : "bg-pino"}`}
      style={{ width: `${Math.round(pct * 100)}%` }}
    />
  );
}

export function SetupScreen({ options, setOptions, progress, onStart }: Props) {
  const selected = useMemo(() => new Set(options.lessons), [options.lessons]);

  const wordCount = useMemo(
    () => options.lessons.reduce((sum, l) => sum + (WORDS_BY_LESSON.get(l)?.length ?? 0), 0),
    [options.lessons],
  );

  const status = useMemo(() => {
    const map = new Map<number, { mastery: number; done: boolean }>();
    for (const l of [...COURSE_LESSONS, ...BONUS_LESSONS, ...SENTENCE_LESSONS]) {
      map.set(l, lessonProgress(l, progress));
    }
    return map;
  }, [progress]);
  const stateOf = (l: number) => status.get(l) ?? { mastery: 0, done: false };

  const toggle = (lesson: number) => {
    const next = new Set(selected);
    if (next.has(lesson)) next.delete(lesson);
    else next.add(lesson);
    setOptions({ lessons: [...next].sort((a, b) => a - b) });
  };

  const planned = options.count === 0 ? wordCount : Math.min(options.count, wordCount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28 }}
      className="mx-auto w-full max-w-3xl px-4 pb-32 sm:px-6"
    >
      <div className="py-8 text-center">
        <motion.h1
          className="font-display text-4xl leading-tight font-bold text-balance text-ink sm:text-5xl"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring}
        >
          Impariamo{" "}
          <motion.span
            className="inline-block text-cobalt"
            animate={{ rotate: [0, -2.5, 2.5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            l'italiano!
          </motion.span>
        </motion.h1>
        <p className="mt-2 text-sm font-bold text-muted">
          {WORDS.filter((w) => w.t !== "sentence").length} woorden en{" "}
          {WORDS.filter((w) => w.t === "sentence").length} zinnen
        </p>
      </div>

      <Card className="p-5 sm:p-6">
        <SectionTitle step={1} title="Kies je lessen" hint={`${wordCount} woorden`} />

        <div className="mb-4 flex flex-wrap gap-2">
          <Chip onClick={() => setOptions({ lessons: COURSE_LESSONS })} className="!text-xs">
            Alle cursuslessen
          </Chip>
          <Chip onClick={() => setOptions({ lessons: COURSE_LESSONS.slice(-5) })} className="!text-xs">
            Laatste 5
          </Chip>
          <Chip onClick={() => setOptions({ lessons: BONUS_LESSONS })} className="!text-xs">
            Alleen bonus
          </Chip>
          <Chip onClick={() => setOptions({ lessons: SENTENCE_LESSONS })} className="!text-xs">
            Alleen zinnen
          </Chip>
          <Chip onClick={() => setOptions({ lessons: [] })} className="!text-xs">
            Wissen
          </Chip>
        </div>

        <div className="flex flex-wrap gap-2">
          {COURSE_LESSONS.map((l) => {
            const on = selected.has(l);
            return (
              <motion.button
                key={l}
                type="button"
                onClick={() => toggle(l)}
                whileHover={{ y: -2 }}
                transition={spring}
                aria-pressed={on}
                title={`${lessonSubtitle(l)}, ${WORDS_BY_LESSON.get(l)?.length ?? 0} woorden, ${Math.round(stateOf(l).mastery * 100)}% gekend${stateOf(l).done ? ", helemaal afgewerkt" : ""}`}
                className={`relative size-11 overflow-hidden rounded-2xl border-b-4 font-display text-base font-semibold transition-[transform,border-width] duration-75 active:translate-y-[3px] active:border-b-0 ${
                  on
                    ? "bg-cobalt text-on-accent border-cobalt-deep"
                    : "bg-raised text-ink border-edge hover:brightness-95"
                }`}
              >
                <span className="relative z-10">{l}</span>
                {stateOf(l).done && (
                  <span
                    aria-hidden
                    className={`absolute top-0.5 right-1 text-[0.6rem] ${on ? "text-on-accent" : "text-pino"}`}
                  >
                    ✓
                  </span>
                )}
                <MasteryBar pct={stateOf(l).mastery} light={on} />
              </motion.button>
            );
          })}
        </div>

        <p className="mt-5 mb-2 text-xs font-extrabold tracking-wide text-muted uppercase">
          Bonuspakketten
        </p>
        <div className="flex flex-wrap gap-2">
          {BONUS_LESSONS.map((l) => (
            <motion.button
              key={l}
              type="button"
              onClick={() => toggle(l)}
              whileHover={{ y: -2 }}
              transition={spring}
              aria-pressed={selected.has(l)}
              title={`${WORDS_BY_LESSON.get(l)?.length ?? 0} woorden, ${Math.round(stateOf(l).mastery * 100)}% gekend`}
              className={`relative overflow-hidden rounded-2xl border-b-4 px-3.5 py-2.5 text-sm font-extrabold transition-[transform,border-width] duration-75 active:translate-y-[3px] active:border-b-0 ${
                selected.has(l)
                  ? "bg-lilac text-on-accent border-lilac-deep"
                  : "bg-lilac-soft text-lilac border-edge hover:brightness-95"
              }`}
            >
              <span className="relative z-10">
                {lessonSubtitle(l)}
                {stateOf(l).done && " ✓"}
              </span>
              <MasteryBar pct={stateOf(l).mastery} light={selected.has(l)} />
            </motion.button>
          ))}
        </div>

        <p className="mt-5 mb-2 text-xs font-extrabold tracking-wide text-muted uppercase">
          Zinnen
        </p>
        <div className="flex flex-wrap gap-2">
          {SENTENCE_LESSONS.map((l) => (
            <motion.button
              key={l}
              type="button"
              onClick={() => toggle(l)}
              whileHover={{ y: -2 }}
              transition={spring}
              aria-pressed={selected.has(l)}
              title={`${WORDS_BY_LESSON.get(l)?.length ?? 0} zinnen, ${Math.round(stateOf(l).mastery * 100)}% gekend`}
              className={`relative overflow-hidden rounded-2xl border-b-4 px-3.5 py-2.5 text-sm font-extrabold transition-[transform,border-width] duration-75 active:translate-y-[3px] active:border-b-0 ${
                selected.has(l)
                  ? "bg-pino text-on-accent border-pino-deep"
                  : "bg-pino-soft text-pino-deep border-edge hover:brightness-95"
              }`}
            >
              <span className="relative z-10">
                {lessonSubtitle(l)}
                {stateOf(l).done && " ✓"}
              </span>
              <MasteryBar pct={stateOf(l).mastery} light={selected.has(l)} />
            </motion.button>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <SectionTitle step={2} title="Richting" />
          <div className="flex flex-col gap-2">
            {DIRECTIONS.map((d) => (
              <Chip
                key={d.value}
                active={options.direction === d.value}
                onClick={() => setOptions({ direction: d.value })}
                className="!px-4 !py-3 text-left"
              >
                <span className="block text-base">{d.label}</span>
                <span className="block text-xs font-bold opacity-70">{d.sub}</span>
              </Chip>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle step={3} title="Antwoordvorm" />
          <div className="flex flex-col gap-2">
            {STYLES.map((s) => (
              <Chip
                key={s.value}
                active={options.style === s.value}
                onClick={() => setOptions({ style: s.value })}
                className="!px-4 !py-3 text-left"
              >
                <span className="block text-base">{s.label}</span>
                <span className="block text-xs font-bold opacity-70">{s.sub}</span>
              </Chip>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <SectionTitle step={4} title="Spelmodus" />
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <Chip
              key={m.value}
              active={options.mode === m.value}
              onClick={() => setOptions({ mode: m.value })}
              className="!px-4 !py-3 text-left"
            >
              <span className="block text-base">
                {m.emoji} {m.label}
              </span>
              <span className="block text-xs font-bold opacity-70">{m.sub}</span>
            </Chip>
          ))}
        </div>

        <div className="mt-6">
          <SectionTitle step={5} title="Hoeveel vragen?" />
          {options.mode === "complete" ? (
            <p className="rounded-2xl bg-raised px-4 py-3 text-sm font-bold text-muted">
              In deze modus doe je altijd de hele les. Fout beantwoorde woorden
              blijven terugkomen tot je ze alle {wordCount} juist hebt.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {COUNTS.map((c) => (
                <Chip key={c} active={options.count === c} onClick={() => setOptions({ count: c })}>
                  {c === 0 ? `Alles (${wordCount})` : c}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6">
          <SectionTitle step={6} title="Herhaling" />
          <button
            type="button"
            onClick={() => setOptions({ mixReview: !options.mixReview })}
            aria-pressed={options.mixReview}
            className="flex w-full items-center gap-3 rounded-2xl border-2 border-line bg-surface px-4 py-3 text-left"
          >
            <span
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                options.mixReview ? "bg-pino" : "bg-raised"
              }`}
            >
              <motion.span
                layout
                transition={spring}
                className="absolute top-1 size-5 rounded-full bg-surface shadow"
                style={{ left: options.mixReview ? "1.5rem" : "0.25rem" }}
              />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold text-ink">
                Oude woorden tussendoor meenemen
              </span>
              <span className="block text-xs font-bold text-muted">
                Voegt een vijfde extra vragen toe uit lessen die je al deed en die
                aan herhaling toe zijn.
              </span>
            </span>
          </button>
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-paper via-paper to-transparent px-4 pt-10 pb-5">
        <div className="mx-auto max-w-3xl">
          <Button onClick={onStart} disabled={wordCount === 0} className="w-full !py-4 !text-lg">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={wordCount === 0 ? "empty" : planned}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="inline-block"
              >
                {wordCount === 0
                  ? "Kies eerst een les"
                  : `Andiamo! ${planned} ${planned === 1 ? "vraag" : "vragen"}`}
              </motion.span>
            </AnimatePresence>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
