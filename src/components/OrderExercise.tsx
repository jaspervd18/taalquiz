import { AnimatePresence, motion } from "framer-motion";
import { spring } from "./ui";

interface Props {
  /** Blokjes die nog in de voorraad liggen, met hun plaats in de oorspronkelijke rij. */
  bank: { token: string; slot: number }[];
  placed: { token: string; slot: number }[];
  locked: boolean;
  onPlace: (slot: number) => void;
  onRemove: (slot: number) => void;
}

function Token({
  token,
  onClick,
  disabled,
  tone,
}: {
  token: string;
  onClick: () => void;
  disabled: boolean;
  tone: "placed" | "bank";
}) {
  return (
    <motion.button
      layout
      type="button"
      onClick={onClick}
      disabled={disabled}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      transition={spring}
      whileHover={disabled ? undefined : { y: -2 }}
      className={`rounded-xl border-2 border-b-4 px-3 py-2 text-base font-extrabold transition-[border-width] duration-75 disabled:opacity-60 ${
        disabled ? "" : "active:translate-y-[3px] active:border-b-2"
      } ${
        tone === "placed"
          ? "border-cobalt-deep bg-cobalt text-on-accent"
          : "border-edge bg-surface text-ink hover:border-cobalt"
      }`}
    >
      {token}
    </motion.button>
  );
}

export function OrderExercise({ bank, placed, locked, onPlace, onRemove }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* De bouwstrook houdt haar hoogte, ook als ze nog leeg is. */}
      <div className="flex min-h-[5.5rem] flex-wrap content-start items-start gap-2 rounded-2xl border-2 border-dashed border-line bg-surface/60 p-3">
        {placed.length === 0 && (
          <span className="px-1 py-2 text-sm font-bold text-muted">
            Tik de woorden aan in de juiste volgorde
          </span>
        )}
        <AnimatePresence mode="popLayout">
          {placed.map((p) => (
            <Token
              key={p.slot}
              token={p.token}
              tone="placed"
              disabled={locked}
              onClick={() => onRemove(p.slot)}
            />
          ))}
        </AnimatePresence>
      </div>

      <div className="flex min-h-[5.5rem] flex-wrap content-start items-start gap-2">
        <AnimatePresence mode="popLayout">
          {bank.map((b) => (
            <Token
              key={b.slot}
              token={b.token}
              tone="bank"
              disabled={locked}
              onClick={() => onPlace(b.slot)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
