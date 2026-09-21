import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useEffect, useMemo } from "react";
import type { Attempt } from "../lib/types";
import { speak } from "../lib/speech";
import { Button, Card, SpeakerButton, spring } from "./ui";
import { useReducedMotion } from "../hooks";

interface Props {
  attempts: Attempt[];
  seconds: number;
  onRetry: () => void;
  onDrillMistakes: () => void;
  onHome: () => void;
}

function praise(pct: number): { title: string; sub: string } {
  if (pct === 100) return { title: "Perfetto!", sub: "Alles juist. Niets aan toe te voegen." };
  if (pct >= 85) return { title: "Bravissimo!", sub: "Dit zit er stevig in." };
  if (pct >= 70) return { title: "Ben fatto!", sub: "Mooi resultaat, nog een paar puntjes." };
  if (pct >= 50) return { title: "Op weg", sub: "De helft staat. Nog een rondje?" };
  return { title: "Volgende keer beter", sub: "Deze les is nog vers. Herhalen helpt." };
}

function Ring({ pct }: { pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-36 place-items-center">
      <svg viewBox="0 0 120 120" className="absolute size-36 -rotate-90">
        <circle cx="60" cy="60" r={r} className="stroke-line" strokeWidth="14" fill="none" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
          className="stroke-pino"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.25 }}
        />
      </svg>
      <motion.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...spring, delay: 0.3 }}
        className="font-display text-4xl font-semibold text-ink tabular-nums"
      >
        {pct}%
      </motion.span>
    </div>
  );
}

export function ResultScreen({ attempts, seconds, onRetry, onDrillMistakes, onHome }: Props) {
  const still = useReducedMotion();
  const total = attempts.length;
  const correct = attempts.filter((a) => a.verdict === "correct").length;
  const almost = attempts.filter((a) => a.verdict === "almost").length;
  const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
  const { title, sub } = praise(pct);

  // In oefenmodus komt hetzelfde woord meerdere keren terug; in de lijst
  // hoort het maar één keer te staan, met de laatste poging.
  const mistakes = useMemo(() => {
    const byWord = new Map<string, Attempt>();
    for (const a of attempts) {
      const key = `${a.question.word.it}|${a.question.direction}`;
      if (a.verdict === "correct") byWord.delete(key);
      else byWord.set(key, a);
    }
    return [...byWord.values()];
  }, [attempts]);

  useEffect(() => {
    if (still || pct < 70) return;
    const shots = pct === 100 ? 3 : 1;
    for (let i = 0; i < shots; i++) {
      window.setTimeout(() => {
        void confetti({
          particleCount: 90,
          spread: 82,
          origin: { y: 0.6 },
          colors: ["#22a45d", "#ffb020", "#3b5bf5", "#8b5cf6", "#f2542d"],
          disableForReducedMotion: true,
        });
      }, 380 + i * 280);
    }
  }, [pct, still]);

  const minutes = Math.floor(seconds / 60);
  const duration = minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-6"
    >
      <Card className="mt-6 flex flex-col items-center gap-2 p-7 text-center">
        <Ring pct={pct} />
        <h2 className="font-display mt-2 text-3xl font-bold text-ink">
          {title}
        </h2>
        <p className="text-sm font-bold text-muted">{sub}</p>

        <div className="mt-5 grid w-full grid-cols-3 gap-2">
          {[
            { label: "juist", value: `${correct}/${total}`, tone: "text-pino-deep" },
            { label: "bijna", value: String(almost), tone: "text-citrus-deep" },
            { label: "tijd", value: duration, tone: "text-ink" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + i * 0.07 }}
              className="rounded-2xl border-2 border-line bg-raised px-3 py-3"
            >
              <div className={`font-display text-xl font-semibold tabular-nums ${s.tone}`}>{s.value}</div>
              <div className="text-xs font-extrabold tracking-wide text-muted uppercase">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </Card>

      {mistakes.length > 0 && (
        <Card className="mt-4 overflow-hidden">
          <h3 className="font-display border-b-2 border-line px-5 py-3 text-base font-semibold text-ink">
            Nog even bekijken ({mistakes.length})
          </h3>
          <ul className="max-h-80 divide-y-2 divide-line overflow-y-auto scrollbar-thin">
            {mistakes.map((m, i) => (
              <motion.li
                key={`${m.question.id}-${i}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(0.5, i * 0.035) }}
                className="flex items-center gap-3 px-5 py-3"
              >
                <span
                  className={`size-2.5 shrink-0 rounded-full ${
                    m.verdict === "almost" ? "bg-citrus" : "bg-vermilion"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-extrabold text-ink">
                    {m.question.prompt}
                  </div>
                  <div className="truncate text-sm font-bold text-muted">
                    <span className="text-pino-deep">
                      {m.question.answer}
                    </span>
                    {m.given.trim() && (
                      <span className="ml-2 line-through opacity-70">{m.given}</span>
                    )}
                  </div>
                </div>
                <SpeakerButton
                  className="!size-8 shrink-0"
                  label={`Spreek ${m.question.word.it} uit`}
                  onClick={() => speak(m.question.word.it, "it-IT")}
                />
              </motion.li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {mistakes.length > 0 && (
          <Button onClick={onDrillMistakes} className="flex-1">
            Oefen de {mistakes.length} fouten
          </Button>
        )}
        <Button variant="soft" onClick={onRetry} className="flex-1">
          Nog een ronde
        </Button>
        <Button variant="ghost" onClick={onHome} className="flex-1">
          Naar het menu
        </Button>
      </div>
    </motion.div>
  );
}
