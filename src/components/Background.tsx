import { motion } from "framer-motion";
import { useReducedMotion } from "../hooks";

/** Losse vormpjes die traag ronddobberen, zoals confetti die blijft hangen. */
const SHAPES = [
  { kind: "circle", color: "text-citrus", size: 120, left: "6%", top: "12%", dur: 19 },
  { kind: "ring", color: "text-cobalt", size: 150, left: "82%", top: "8%", dur: 23 },
  { kind: "blob", color: "text-pino", size: 130, left: "88%", top: "64%", dur: 21 },
  { kind: "circle", color: "text-lilac", size: 90, left: "2%", top: "72%", dur: 17 },
  { kind: "ring", color: "text-vermilion", size: 100, left: "70%", top: "88%", dur: 25 },
  { kind: "blob", color: "text-cobalt", size: 80, left: "24%", top: "94%", dur: 20 },
] as const;

export function Background() {
  const still = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {SHAPES.map((s, i) => (
        <motion.svg
          key={i}
          viewBox="0 0 100 100"
          className={`absolute opacity-[0.07] ${s.color}`}
          style={{ width: s.size, height: s.size, left: s.left, top: s.top }}
          animate={
            still ? undefined : { y: [0, -22, 10, 0], rotate: [0, 14, -8, 0] }
          }
          transition={{ duration: s.dur, repeat: Infinity, ease: "easeInOut", delay: i * 1.3 }}
        >
          {s.kind === "circle" && <circle cx="50" cy="50" r="46" fill="currentColor" />}
          {s.kind === "ring" && (
            <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="14" />
          )}
          {s.kind === "blob" && (
            <rect x="8" y="8" width="84" height="84" rx="30" fill="currentColor" />
          )}
        </motion.svg>
      ))}
    </div>
  );
}
