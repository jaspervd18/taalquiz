import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  dayStreak,
  levelFromXp,
  resetProgress,
  type Progress,
} from "../lib/storage";
import { COURSE_LESSONS, BONUS_LESSONS, WORDS, WORDS_BY_LESSON, lessonSubtitle, wordKey } from "../lib/words";
import { Button, Card } from "./ui";

const WEEKS = 18;

function heatmapDays(): Date[] {
  const days: Date[] = [];
  const end = new Date();
  // Begin op de maandag van de week, WEEKS weken terug.
  const start = new Date(end);
  start.setDate(start.getDate() - (WEEKS * 7 - 1));
  const shift = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - shift);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

function heatColor(count: number): string {
  if (count === 0) return "bg-raised";
  if (count < 10) return "bg-pino/30";
  if (count < 25) return "bg-pino/55";
  if (count < 60) return "bg-pino/80";
  return "bg-pino";
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border-2 border-line bg-raised px-4 py-3">
      <div className="font-display text-2xl font-semibold tabular-nums text-ink">
        {value}
      </div>
      <div className="text-xs font-extrabold tracking-wide text-muted uppercase">{label}</div>
      {sub && <div className="mt-0.5 text-xs font-bold text-muted">{sub}</div>}
    </div>
  );
}

export function StatsScreen({ progress, onBack }: { progress: Progress; onBack: () => void }) {
  const [confirmReset, setConfirmReset] = useState(false);

  const { level, into, need } = levelFromXp(progress.xp);
  const streak = dayStreak(progress.days);
  const days = useMemo(heatmapDays, []);

  const summary = useMemo(() => {
    const stats = Object.values(progress.words);
    const seen = stats.reduce((a, s) => a + s.seen, 0);
    const correct = stats.reduce((a, s) => a + s.correct, 0);
    const mastered = stats.filter((s) => s.box >= 4).length;
    return {
      answered: seen,
      accuracy: seen === 0 ? 0 : Math.round((correct / seen) * 100),
      touched: stats.length,
      mastered,
    };
  }, [progress.words]);

  const perLesson = useMemo(() => {
    return [...COURSE_LESSONS, ...BONUS_LESSONS].map((l) => {
      const words = WORDS_BY_LESSON.get(l) ?? [];
      let known = 0;
      for (const w of words) {
        const s = progress.words[wordKey(w)];
        if (s && s.box >= 2) known++;
      }
      return { lesson: l, total: words.length, known, pct: words.length ? known / words.length : 0 };
    });
  }, [progress.words]);

  const weakest = useMemo(() => {
    return WORDS.map((w) => ({ w, s: progress.words[wordKey(w)] }))
      .filter(({ s }) => s && s.seen >= 2 && s.correct / s.seen < 0.6)
      .sort((a, b) => a.s!.correct / a.s!.seen - b.s!.correct / b.s!.seen)
      .slice(0, 12);
  }, [progress.words]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6"
    >
      <div className="flex items-center gap-3 py-5">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl px-2 py-1 text-sm font-extrabold text-muted transition hover:text-ink"
        >
          ← Terug
        </button>
        <h2 className="font-display text-2xl font-bold text-ink">
          Jouw voortgang
        </h2>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <div className="font-display text-3xl font-bold text-ink">
              Level {level}
            </div>
            <div className="text-sm font-bold text-muted tabular-nums">
              {into} van {need} XP naar level {level + 1}
            </div>
          </div>
          <div className="text-right text-sm font-extrabold text-citrus-deep">
            🔥 {streak} {streak === 1 ? "dag" : "dagen"} op rij
          </div>
        </div>
        <div className="h-4 overflow-hidden rounded-full border-2 border-line bg-raised">
          <motion.div
            className="h-full rounded-full bg-citrus"
            initial={{ width: 0 }}
            animate={{ width: `${Math.round((into / need) * 100)}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="antwoorden" value={String(summary.answered)} />
          <Stat label="juist" value={`${summary.accuracy}%`} />
          <Stat label="woorden gezien" value={`${summary.touched}`} sub={`van ${WORDS.length}`} />
          <Stat label="beheerst" value={String(summary.mastered)} sub="doos 4 of 5" />
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h3 className="font-display mb-3 text-lg font-semibold text-ink">
          Laatste {WEEKS} weken
        </h3>
        <div className="overflow-x-auto scrollbar-thin">
          <div
            className="grid grid-flow-col gap-1"
            style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}
          >
            {days.map((d, i) => {
              const key = d.toLocaleDateString("sv-SE");
              const count = progress.days[key] ?? 0;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(0.6, i * 0.0015) }}
                  title={`${key}: ${count} ${count === 1 ? "antwoord" : "antwoorden"}`}
                  className={`size-3 rounded-[4px] ${heatColor(count)}`}
                />
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-xs font-bold text-muted">
          <span>minder</span>
          {[0, 5, 20, 40, 80].map((n) => (
            <span key={n} className={`size-3 rounded-[4px] ${heatColor(n)}`} />
          ))}
          <span>meer</span>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h3 className="font-display mb-3 text-lg font-semibold text-ink">
          Per les
        </h3>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {perLesson.map(({ lesson, known, total, pct }, i) => (
            <motion.div
              key={lesson}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(0.5, i * 0.012) }}
              className="flex items-center gap-2 text-sm"
            >
              <span className="w-9 shrink-0 text-right text-xs font-extrabold text-muted">
                {lesson >= 100 ? `B${lesson - 100}` : lesson}
              </span>
              <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-raised">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full bg-pino"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(pct * 100)}%` }}
                  transition={{ duration: 0.7, delay: Math.min(0.5, i * 0.012) }}
                />
              </span>
              <span className="w-16 shrink-0 text-xs font-extrabold text-muted tabular-nums">
                {known}/{total}
              </span>
              <span className="hidden max-w-32 truncate text-xs font-bold text-muted sm:block">
                {lessonSubtitle(lesson)}
              </span>
            </motion.div>
          ))}
        </div>
      </Card>

      {weakest.length > 0 && (
        <Card className="mt-4 p-5">
          <h3 className="font-display mb-3 text-lg font-semibold text-ink">
            Lastigste woorden
          </h3>
          <div className="flex flex-wrap gap-2">
            {weakest.map(({ w, s }) => (
              <span
                key={wordKey(w)}
                title={`${s!.correct}/${s!.seen} juist`}
                className="rounded-xl border-2 border-line bg-vermilion-soft px-3 py-1.5 text-sm font-extrabold text-vermilion-deep"
              >
                {w.it} <span className="font-bold opacity-60">{w.nl}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card className="mt-4 flex flex-wrap items-center gap-3 p-5">
        <div className="flex-1">
          <h3 className="font-display text-base font-semibold text-ink">
            Opnieuw beginnen
          </h3>
          <p className="text-sm font-bold text-muted">
            Alles staat alleen in deze browser. Wissen kan niet ongedaan gemaakt worden.
          </p>
        </div>
        {confirmReset ? (
          <div className="flex gap-2">
            <Button
              variant="soft"
              onClick={() => {
                resetProgress();
                setConfirmReset(false);
              }}
              className="!bg-vermilion !border-vermilion-deep !text-on-accent"
            >
              Ja, wissen
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Annuleren
            </Button>
          </div>
        ) : (
          <Button variant="soft" onClick={() => setConfirmReset(true)}>
            Voortgang wissen
          </Button>
        )}
      </Card>
    </motion.div>
  );
}
