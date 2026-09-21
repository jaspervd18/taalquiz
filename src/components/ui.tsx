import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

export const spring = { type: "spring", stiffness: 420, damping: 28 } as const;

/** Knoppen krijgen een dikke onderrand die indeukt bij het klikken. */
const PRESS =
  "border-b-4 active:translate-y-[3px] active:border-b-0 transition-[transform,border-width] duration-75";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[28px] border-2 border-line bg-surface ${className}`}>
      {children}
    </div>
  );
}

type ChipProps = HTMLMotionProps<"button"> & {
  active?: boolean;
  tone?: "cobalt" | "lilac";
  children: ReactNode;
};

export function Chip({
  active = false,
  tone = "cobalt",
  children,
  className = "",
  ...rest
}: ChipProps) {
  const on =
    tone === "lilac"
      ? "bg-lilac text-on-accent border-lilac-deep"
      : "bg-cobalt text-on-accent border-cobalt-deep";
  const off =
    tone === "lilac"
      ? "bg-lilac-soft text-lilac border-edge hover:brightness-95"
      : "bg-raised text-ink border-edge hover:brightness-95";

  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      transition={spring}
      className={`rounded-2xl px-4 py-2.5 text-sm font-extrabold ${PRESS} ${
        active ? on : off
      } ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "soft" | "ghost";
  children: ReactNode;
};

export function Button({
  variant = "primary",
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  const styles = {
    primary: `bg-pino text-on-accent border-pino-deep ${PRESS}`,
    soft: `bg-raised text-ink border-edge ${PRESS}`,
    ghost: "text-muted hover:text-ink border-b-4 border-transparent",
  }[variant];

  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { y: -1 }}
      transition={spring}
      disabled={disabled}
      className={`rounded-2xl px-5 py-3 text-base font-extrabold disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 ${styles} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function SectionTitle({
  step,
  title,
  hint,
}: {
  step?: number;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      {step !== undefined && (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-citrus font-display text-sm font-bold text-ink">
          {step}
        </span>
      )}
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {hint && <span className="text-sm font-bold text-muted">{hint}</span>}
    </div>
  );
}

export function SpeakerButton({
  onClick,
  className = "",
  label = "Spreek uit",
}: {
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      whileHover={{ scale: 1.1, rotate: -8 }}
      whileTap={{ scale: 0.88 }}
      transition={spring}
      className={`grid size-10 shrink-0 place-items-center rounded-full bg-citrus-soft text-citrus-deep ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </motion.button>
  );
}
