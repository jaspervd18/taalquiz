import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Background } from "./components/Background";
import { TopBar } from "./components/TopBar";
import { SetupScreen } from "./components/SetupScreen";
import { QuizScreen } from "./components/QuizScreen";
import { ResultScreen } from "./components/ResultScreen";
import { StatsScreen } from "./components/StatsScreen";
import { useProgress } from "./hooks";
import { getProgress, recordSession, update } from "./lib/storage";
import { buildQuestions, requeue, shuffle } from "./lib/quiz";
import { WORDS } from "./lib/words";
import type { Attempt, Options, Question } from "./lib/types";

type Screen = "setup" | "quiz" | "result" | "stats";

const DEFAULTS: Options = {
  lessons: [1],
  direction: "it2nl",
  style: "mcq",
  mode: "practice",
  count: 20,
  audio: true,
};

export default function App() {
  const progress = useProgress();
  const [screen, setScreen] = useState<Screen>("setup");
  const [options, setOptionsState] = useState<Options>(() => ({
    ...DEFAULTS,
    ...getProgress().options,
  }));
  const [questions, setQuestions] = useState<Question[]>([]);
  const [finished, setFinished] = useState<{ attempts: Attempt[]; seconds: number }>({
    attempts: [],
    seconds: 0,
  });

  // Thema hangt aan <html>, zodat de achtergrond ook meekleurt.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", progress.theme === "dark");
  }, [progress.theme]);

  const setOptions = useCallback((patch: Partial<Options>) => {
    setOptionsState((prev) => {
      const next = { ...prev, ...patch };
      update((p) => ({ ...p, options: next }));
      return next;
    });
  }, []);

  const start = useCallback(
    (overrides?: Partial<Options>) => {
      const opts = { ...options, ...overrides };
      const built = buildQuestions(opts, getProgress().words);
      if (built.length === 0) return;
      setQuestions(built);
      setScreen("quiz");
    },
    [options],
  );

  const handleFinish = useCallback(
    (attempts: Attempt[], seconds: number) => {
      setFinished({ attempts, seconds });
      recordSession({
        at: Date.now(),
        mode: options.mode,
        lessons: options.lessons,
        correct: attempts.filter((a) => a.verdict === "correct").length,
        total: attempts.length,
        seconds,
      });
      setScreen("result");
    },
    [options],
  );

  const pool = useMemo(() => {
    const lessons = new Set(options.lessons);
    return WORDS.filter((w) => lessons.has(w.l));
  }, [options.lessons]);

  const drillMistakes = useCallback(() => {
    // Alleen elk fout woord één keer, in nieuwe volgorde en met verse opties.
    const seen = new Set<string>();
    const redo: Question[] = [];
    for (const a of finished.attempts) {
      if (a.verdict === "correct") continue;
      const key = a.question.word.it + a.question.direction;
      if (seen.has(key)) continue;
      seen.add(key);
      redo.push(requeue(a.question, pool));
    }
    if (redo.length === 0) return;
    setQuestions(shuffle(redo));
    setScreen("quiz");
  }, [finished.attempts, options, pool]);

  return (
    <div className="relative min-h-full text-ink">
      <Background />

      <div className="relative">
        {screen !== "quiz" && (
          <TopBar
            progress={progress}
            onOpenStats={() => setScreen("stats")}
            onHome={() => setScreen("setup")}
          />
        )}

        <AnimatePresence mode="wait">
          {screen === "setup" && (
            <SetupScreen
              key="setup"
              options={options}
              setOptions={setOptions}
              progress={progress}
              onStart={() => start()}
            />
          )}

          {screen === "quiz" && (
            <QuizScreen
              key="quiz"
              questions={questions}
              options={options}
              audio={progress.audio}
              onFinish={handleFinish}
              onQuit={() => setScreen("setup")}
            />
          )}

          {screen === "result" && (
            <ResultScreen
              key="result"
              attempts={finished.attempts}
              seconds={finished.seconds}
              onRetry={() => start()}
              onDrillMistakes={drillMistakes}
              onHome={() => setScreen("setup")}
            />
          )}

          {screen === "stats" && (
            <StatsScreen key="stats" progress={progress} onBack={() => setScreen("setup")} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
