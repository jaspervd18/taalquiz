import { motion } from "framer-motion";
import { dayStreak, levelFromXp, update, type Progress } from "../lib/storage";
import { spring } from "./ui";

function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      whileHover={{ y: -1, rotate: 6 }}
      whileTap={{ scale: 0.9 }}
      transition={spring}
      className="grid size-11 place-items-center rounded-2xl border-2 border-line border-b-4 bg-surface text-ink transition-[transform,border-width] duration-75 active:translate-y-[3px] active:border-b-2"
    >
      {children}
    </motion.button>
  );
}

export function TopBar({
  progress,
  onOpenStats,
  onHome,
}: {
  progress: Progress;
  onOpenStats: () => void;
  onHome: () => void;
}) {
  const { level, into, need } = levelFromXp(progress.xp);
  const streak = dayStreak(progress.days);
  const pct = Math.round((into / need) * 100);

  return (
    <header className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 px-4 pt-5 sm:px-6">
      <button type="button" onClick={onHome} className="flex items-center gap-2.5 rounded-2xl text-left">
        <motion.span
          className="grid size-11 place-items-center rounded-2xl bg-cobalt font-display text-xl font-bold text-on-accent"
          whileHover={{ rotate: -8, scale: 1.05 }}
          transition={spring}
        >
          P
        </motion.span>
        <span>
          <span className="block font-display text-xl leading-none font-bold text-ink">
            Parola
          </span>
          <span className="text-xs font-bold text-muted">woordentrainer</span>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        {streak > 0 && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={spring}
            title={`${streak} dagen op rij geoefend`}
            className="flex items-center gap-1 rounded-2xl border-2 border-citrus-deep bg-citrus-soft px-3 py-2 text-sm font-extrabold text-citrus-deep"
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1], rotate: [0, -6, 6, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              🔥
            </motion.span>
            {streak}
          </motion.div>
        )}

        <button
          type="button"
          onClick={onOpenStats}
          title={`Level ${level}, ${into} van ${need} XP`}
          className="flex items-center gap-2 rounded-2xl border-2 border-line border-b-4 bg-surface px-3 py-2 transition-[transform,border-width] duration-75 active:translate-y-[3px] active:border-b-2"
        >
          <span className="font-display text-sm font-bold text-ink">Lv {level}</span>
          <span className="relative h-2 w-12 overflow-hidden rounded-full bg-raised">
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full bg-pino"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 160, damping: 26 }}
            />
          </span>
        </button>

        <IconButton
          label={progress.audio ? "Geluid uit" : "Geluid aan"}
          onClick={() => update((p) => ({ ...p, audio: !p.audio }))}
        >
          {progress.audio ? (
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="m22 9-6 6M16 9l6 6" />
            </svg>
          )}
        </IconButton>

        <IconButton
          label={progress.theme === "dark" ? "Lichte modus" : "Donkere modus"}
          onClick={() =>
            update((p) => ({ ...p, theme: p.theme === "dark" ? "light" : "dark" }))
          }
        >
          {progress.theme === "dark" ? (
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </IconButton>
      </div>
    </header>
  );
}
