/**
 * Korte tonen uit de Web Audio API, zodat we geen audiobestanden hoeven
 * mee te leveren. De context start pas na de eerste klik van de gebruiker,
 * want browsers blokkeren audio daarvoor.
 */
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, gain: number, type: OscillatorType) {
  const ac = context();
  if (!ac) return;
  const osc = ac.createOscillator();
  const vol = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  vol.gain.setValueAtTime(0.0001, ac.currentTime + start);
  vol.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.015);
  vol.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration);
  osc.connect(vol).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.02);
}

export const sfx = {
  correct(streak = 0) {
    const step = Math.min(4, Math.floor(streak / 3));
    tone(523 + step * 40, 0, 0.12, 0.09, "triangle");
    tone(784 + step * 60, 0.07, 0.16, 0.07, "triangle");
  },
  almost() {
    tone(440, 0, 0.14, 0.08, "sine");
    tone(494, 0.09, 0.14, 0.06, "sine");
  },
  wrong() {
    tone(196, 0, 0.2, 0.07, "sawtooth");
    tone(147, 0.1, 0.24, 0.05, "sawtooth");
  },
  finish() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 0.08, "triangle"));
  },
  click() {
    tone(660, 0, 0.05, 0.04, "square");
  },
};
