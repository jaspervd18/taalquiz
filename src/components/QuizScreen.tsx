import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Attempt, Options, Question, Verdict } from "../lib/types";
import { judge, sameTokens } from "../lib/text";
import { requeue, xpFor } from "../lib/quiz";
import { WORDS, lessonSubtitle, wordKey } from "../lib/words";
import { recordAnswer, update } from "../lib/storage";
import { speak } from "../lib/speech";
import { sfx } from "../lib/sfx";
import { Button, Card, SpeakerButton, spring } from "./ui";
import { OrderExercise } from "./OrderExercise";
import { useReducedMotion } from "../hooks";

interface Props {
  questions: Question[];
  options: Options;
  audio: boolean;
  onFinish: (attempts: Attempt[], seconds: number) => void;
  onQuit: () => void;
}

/** Hoe vaak een fout woord deze ronde hoogstens terugkomt. */
const MAX_RETRIES = 2;

const VERDICT_STYLE: Record<Verdict, { box: string; text: string; label: string; emoji: string }> = {
  correct: {
    box: "border-pino bg-pino-soft",
    text: "text-pino-deep",
    label: "Bravo!",
    emoji: "🎉",
  },
  almost: {
    box: "border-citrus bg-citrus-soft",
    text: "text-citrus-deep",
    label: "Bijna!",
    emoji: "✏️",
  },
  wrong: {
    box: "border-vermilion bg-vermilion-soft",
    text: "text-vermilion-deep",
    label: "Helaas",
    emoji: "💡",
  },
};

export function QuizScreen({ questions, options, audio, onFinish, onQuit }: Props) {
  const [queue, setQueue] = useState<Question[]>(questions);
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [given, setGiven] = useState("");
  const [result, setResult] = useState<{ verdict: Verdict; note?: string } | null>(null);
  const [streak, setStreak] = useState(0);
  const [gainedXp, setGainedXp] = useState<number | null>(null);
  /** Aangetikte blokjes van de volgordeoefening, in de volgorde van aantikken. */
  const [placed, setPlaced] = useState<number[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  /** Hoe vaak een woord deze ronde al fout ging, voor de herkansingslimiet. */
  const misses = useRef(new Map<string, number>());
  const startedAt = useRef(Date.now());
  const advanceTimer = useRef<number | undefined>(undefined);
  const still = useReducedMotion();

  const question = queue[index];
  const total = queue.length;
  const answeredCount = attempts.length;
  const correctCount = attempts.filter((a) => a.verdict === "correct").length;

  /** Voor "les afmaken": hoeveel verschillende woorden zaten al juist? */
  const solved = useMemo(() => {
    const set = new Set<string>();
    for (const a of attempts) {
      if (a.verdict === "correct") set.add(wordKey(a.question.word));
    }
    return set;
  }, [attempts]);
  const solvedCount = solved.size;
  const uniqueCount = useMemo(
    () => new Set(questions.map((q) => wordKey(q.word))).size,
    [questions],
  );

  const pool = useMemo(() => {
    const lessons = new Set(options.lessons);
    return WORDS.filter((w) => lessons.has(w.l));
  }, [options.lessons]);

  const promptLang = question?.direction === "it2nl" ? "it-IT" : "nl-BE";
  const answerLang = question?.direction === "it2nl" ? "nl-BE" : "it-IT";

  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  // Bij een nieuwe vraag: veld leegmaken, focus terug, en de Italiaanse kant voorlezen.
  useEffect(() => {
    if (!question) return;
    setGiven("");
    setResult(null);
    setGainedXp(null);
    setPlaced([]);
    if (question.style === "type") {
      // Even wachten tot de kaart er staat, anders springt de pagina op mobiel.
      const t = window.setTimeout(() => inputRef.current?.focus(), 260);
      return () => window.clearTimeout(t);
    }
  }, [question?.id]);

  const goNext = useCallback(() => {
    window.clearTimeout(advanceTimer.current);
    setIndex((i) => i + 1);
  }, []);

  const finishNow = useCallback(
    (all: Attempt[]) => {
      const seconds = Math.round((Date.now() - startedAt.current) / 1000);
      if (audio) sfx.finish();
      onFinish(all, seconds);
    },
    [audio, onFinish],
  );

  const commit = useCallback(
    (raw: string) => {
      if (!question || result) return;

      const judgement =
        question.style === "order"
          ? sameTokens(raw.split(" ").filter(Boolean), question.solution)
            ? { verdict: "correct" as const }
            : { verdict: "wrong" as const }
          : judge(raw, question.answer);
      const nextStreak = judgement.verdict === "wrong" ? 0 : streak + 1;
      const xp = xpFor(question.style, judgement.verdict, nextStreak);

      setGiven(raw);
      setResult(judgement);
      setStreak(nextStreak);
      setGainedXp(xp > 0 ? xp : null);

      recordAnswer(wordKey(question.word), judgement.verdict, xp);
      if (nextStreak > 0) {
        update((p) => (nextStreak > p.bestStreak ? { ...p, bestStreak: nextStreak } : p));
      }

      const attempt: Attempt = {
        question,
        given: raw,
        verdict: judgement.verdict,
        note: judgement.note,
      };
      const allAttempts = [...attempts, attempt];
      setAttempts(allAttempts);

      if (audio) {
        if (judgement.verdict === "correct") sfx.correct(nextStreak);
        else if (judgement.verdict === "almost") sfx.almost();
        else sfx.wrong();
      }

      // Elke 5 goede antwoorden op rij is een klein feestje waard.
      if (!still && judgement.verdict === "correct" && nextStreak > 0 && nextStreak % 5 === 0) {
        void confetti({
          particleCount: 70,
          spread: 70,
          startVelocity: 32,
          origin: { y: 0.72 },
          colors: ["#22a45d", "#ffb020", "#3b5bf5", "#8b5cf6"],
          disableForReducedMotion: true,
        });
      }

      // In oefenmodus krijgt een fout woord later nog een kans, maar hoogstens
      // twee keer: anders blijft één hardnekkig woord de ronde rekken.
      let nextQueue = queue;
      if (options.mode !== "test" && judgement.verdict !== "correct") {
        const key = wordKey(question.word);
        const missCount = (misses.current.get(key) ?? 0) + 1;
        misses.current.set(key, missCount);
        if (options.mode === "complete" || missCount <= MAX_RETRIES) {
          nextQueue = [...queue, requeue(question, pool)];
          setQueue(nextQueue);
        }
      }

      const isLast = index + 1 >= nextQueue.length;
      if (judgement.verdict === "correct") {
        advanceTimer.current = window.setTimeout(
          () => (isLast ? finishNow(allAttempts) : goNext()),
          950,
        );
      }
      // Bij 'bijna' of fout laten we de gebruiker zelf doorklikken, zodat er
      // tijd is om het juiste antwoord te lezen.
    },
    [question, result, streak, attempts, audio, still, queue, options, pool, index, goNext, finishNow],
  );

  const handleNext = useCallback(() => {
    if (index + 1 >= queue.length) finishNow(attempts);
    else goNext();
  }, [index, queue.length, attempts, finishNow, goNext]);

  // Sneltoetsen: 1-4 kiest een antwoord, Enter bevestigt of gaat verder.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!question) return;
      if (e.key === "Escape") {
        onQuit();
        return;
      }
      if (result) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleNext();
        }
        return;
      }
      if (question.style === "mcq") {
        const n = Number(e.key);
        if (n >= 1 && n <= question.choices.length) {
          e.preventDefault();
          commit(question.choices[n - 1]);
        }
      }
      if (question.style === "order") {
        if (e.key === "Backspace") {
          e.preventDefault();
          setPlaced((p) => p.slice(0, -1));
        }
        if (e.key === "Enter" && placed.length > 0) {
          e.preventDefault();
          commit(placed.map((slot) => question.tokens[slot]).join(" "));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, result, commit, handleNext, onQuit, placed]);

  if (!question) return null;

  const pct =
    options.mode === "complete"
      ? uniqueCount === 0
        ? 0
        : Math.round((solvedCount / uniqueCount) * 100)
      : total === 0
        ? 0
        : Math.round((answeredCount / total) * 100);
  const style = result ? VERDICT_STYLE[result.verdict] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="mx-auto w-full max-w-2xl px-4 pb-44 sm:px-6"
    >
      <div className="sticky top-0 z-10 -mx-4 bg-paper px-4 pt-4 pb-3 sm:-mx-6 sm:px-6">
        <div className="mb-2 flex items-center gap-3 text-sm font-bold">
          <button
            type="button"
            onClick={onQuit}
            className="rounded-xl px-2 py-1 text-muted transition hover:text-ink"
            title="Stoppen (Esc)"
          >
            ← Stop
          </button>
          <span className="text-muted tabular-nums">
            {options.mode === "complete"
              ? `${solvedCount} / ${uniqueCount} juist`
              : `${Math.min(answeredCount + 1, total)} / ${total}`}
          </span>

          {/* Vaste breedte, anders schuiven de badges bij elk goed antwoord. */}
          <div className="ml-auto flex min-w-[8.5rem] items-center justify-end gap-2">
            <AnimatePresence>
              {streak >= 3 && (
                <motion.span
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={spring}
                  className="flex items-center gap-1 rounded-full bg-citrus-soft px-2.5 py-1 text-citrus-deep tabular-nums"
                >
                  🔥 {streak}
                </motion.span>
              )}
            </AnimatePresence>
            {options.mode === "test" && (
              <span className="rounded-full bg-pino-soft px-2.5 py-1 text-pino-deep tabular-nums">
                {correctCount} goed
              </span>
            )}
          </div>
        </div>

        <div className="h-3 overflow-hidden rounded-full border-2 border-line bg-raised">
          <motion.div
            className="h-full rounded-full bg-pino"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 140, damping: 24 }}
          />
        </div>
      </div>

      {/*
        De vraagkaart krijgt een vaste hoogte en de kaarten liggen over elkaar,
        zodat de vertrekkende en de binnenkomende kaart elkaar niet verdringen.
        Zonder dit sprongen de antwoorden omhoog tijdens de wissel.
      */}
      <div className="relative mt-4 h-[13rem] sm:h-[13.5rem]">
        <AnimatePresence initial={false}>
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 44, rotate: 1.5 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: -44, rotate: -1.5 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-0"
          >
            <Card className="flex h-full flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-line px-5 py-2.5 text-xs font-extrabold tracking-wide text-muted uppercase">
                <span className="truncate">
                  {question.direction === "it2nl" ? "Italiaans naar Nederlands" : "Nederlands naar Italiaans"}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 pl-2 text-right normal-case">
                  {question.isReview && (
                    <span className="rounded-full bg-lilac-soft px-2 py-0.5 text-lilac">
                      herhaling
                    </span>
                  )}
                  <span className="max-w-[9rem] truncate">{lessonSubtitle(question.word.l)}</span>
                </span>
              </div>

              <div className="flex flex-1 flex-col items-center justify-center gap-2.5 overflow-hidden px-5 py-4 text-center">
                <div className="flex items-center gap-3">
                  <motion.h2
                    initial={{ scale: 0.94 }}
                    animate={{ scale: 1 }}
                    transition={spring}
                    className="font-display line-clamp-3 text-2xl leading-tight font-semibold text-balance text-ink sm:text-3xl"
                  >
                    {question.prompt}
                  </motion.h2>
                  <SpeakerButton
                    onClick={() => speak(question.prompt, promptLang)}
                    label="Lees de vraag voor"
                  />
                </div>
                <span className="shrink-0 rounded-full bg-raised px-3 py-1 text-xs font-extrabold text-muted">
                  {{ noun: "zelfstandig naamwoord", verb: "werkwoord", adjective: "bijvoeglijk naamwoord", other: "overig", sentence: "zin" }[question.word.t]}
                </span>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Ook het antwoordveld houdt zijn hoogte, ongeacht het aantal opties. */}
      <div className={options.style === "type" ? "mt-4" : "mt-4 h-[19rem]"}>
        {question.style === "mcq" ? (
          <div className="grid gap-2.5">
            {question.choices.map((choice, i) => {
              const isCorrect = result && judge(choice, question.answer).verdict === "correct";
              const isPicked = result && choice === given;
              const state = !result
                ? "idle"
                : isCorrect
                  ? "correct"
                  : isPicked
                    ? "wrong"
                    : "dim";

              return (
                <motion.button
                  key={`${question.id}-${i}`}
                  type="button"
                  disabled={!!result}
                  onClick={() => commit(choice)}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{
                    opacity: state === "dim" ? 0.4 : 1,
                    x: 0,
                    scale: state === "correct" ? 1.015 : 1,
                  }}
                  transition={{ delay: result ? 0 : 0.06 + i * 0.05, type: "spring", stiffness: 340, damping: 26 }}
                  whileHover={result ? undefined : { x: 3 }}
                  className={`flex h-[4.25rem] items-center gap-3 rounded-2xl border-2 border-b-4 px-4 text-left text-base font-extrabold transition-[border-width,background-color,border-color] duration-75 sm:text-lg ${
                    result ? "" : "active:translate-y-[3px] active:border-b-2"
                  } ${
                    state === "correct"
                      ? "border-pino bg-pino-soft text-pino-deep"
                      : state === "wrong"
                        ? "border-vermilion bg-vermilion-soft text-vermilion-deep"
                        : "border-line bg-surface text-ink hover:border-cobalt"
                  }`}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-raised font-display text-sm font-semibold text-muted">
                    {i + 1}
                  </span>
                  <span className="line-clamp-2 flex-1 leading-tight">{choice}</span>
                  <span className="w-5 shrink-0 text-right">
                    {state === "correct" && "✓"}
                    {state === "wrong" && "✗"}
                  </span>
                </motion.button>
              );
            })}
          </div>
        ) : question.style === "order" ? (
          <div className="flex flex-col gap-3">
            <OrderExercise
              bank={question.tokens
                .map((token, slot) => ({ token, slot }))
                .filter((t) => !placed.includes(t.slot))}
              placed={placed.map((slot) => ({ token: question.tokens[slot], slot }))}
              locked={!!result}
              onPlace={(slot) => setPlaced((p) => [...p, slot])}
              onRemove={(slot) => setPlaced((p) => p.filter((s) => s !== slot))}
            />
            <Button
              onClick={() => {
                if (result) handleNext();
                else if (placed.length > 0) {
                  commit(placed.map((slot) => question.tokens[slot]).join(" "));
                }
              }}
              disabled={!result && placed.length === 0}
              className="w-full"
            >
              {result ? "Verder" : "Check"}
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (result) handleNext();
              else if (given.trim()) commit(given);
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              id="answer-input"
              value={given}
              onChange={(e) => setGiven(e.target.value)}
              disabled={!!result}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={question.direction === "it2nl" ? "in het Nederlands..." : "in het Italiaans..."}
              className={`h-[4.25rem] w-full rounded-2xl border-2 bg-surface px-5 text-lg font-extrabold text-ink outline-none transition-colors placeholder:font-bold placeholder:text-muted ${
                result
                  ? result.verdict === "correct"
                    ? "border-pino"
                    : result.verdict === "almost"
                      ? "border-citrus"
                      : "border-vermilion"
                  : "border-line focus:border-cobalt"
              }`}
            />
            <Button type="submit" disabled={!result && !given.trim()} className="h-[4.25rem] shrink-0 !px-5">
              {result ? "Verder" : "Check"}
            </Button>
          </form>
        )}
      </div>

      {/*
        De feedback schuift als balk over de pagina in plaats van eronder te
        groeien, zodat er niets verspringt op het moment dat je antwoordt.
      */}
      <AnimatePresence>
        {result && style && (
          <motion.div
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className={`fixed inset-x-0 bottom-0 z-30 border-t-2 ${style.box}`}
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 sm:px-6">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-display text-lg font-semibold whitespace-nowrap ${style.text}`}>
                    {style.emoji} {style.label}
                  </span>
                  {/* Vaste sleuf, anders verspringt de tekst als de XP binnenkomt. */}
                  <span className="grid w-16 shrink-0 place-items-start">
                    <AnimatePresence>
                      {gainedXp !== null && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={spring}
                          className="rounded-full bg-lilac-soft px-2 py-0.5 text-xs font-extrabold text-lilac tabular-nums"
                        >
                          +{gainedXp} XP
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </div>

                {result.verdict !== "correct" ? (
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-base font-extrabold text-ink">
                      {question.answer}
                    </span>
                    <SpeakerButton
                      onClick={() => speak(question.answer, answerLang)}
                      className="!size-8"
                      label="Lees het antwoord voor"
                    />
                  </div>
                ) : (
                  result.note && (
                    <p className="mt-0.5 truncate text-sm font-bold text-muted">{result.note}</p>
                  )
                )}
                {result.verdict !== "correct" && result.note && (
                  <p className="truncate text-sm font-bold text-muted">{result.note}</p>
                )}
              </div>

              {result.verdict !== "correct" && (
                <Button onClick={handleNext} className="shrink-0">
                  Volgende
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
