/**
 * Uitspraak via de Web Speech API die in de browser zit: gratis, geen sleutel,
 * geen netwerk. Niet elke browser heeft een Italiaanse stem, dus we vallen
 * netjes stil terug als er niets bruikbaars is.
 */
import { stripGrammarLabels } from "./text";

let voices: SpeechSynthesisVoice[] = [];

function refreshVoices() {
  if (typeof speechSynthesis === "undefined") return;
  voices = speechSynthesis.getVoices();
}

if (typeof speechSynthesis !== "undefined") {
  refreshVoices();
  speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
}

function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) refreshVoices();
  const prefix = lang.split("-")[0];
  return (
    voices.find((v) => v.lang.replace("_", "-").toLowerCase() === lang.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix))
  );
}

export function speechAvailable(lang = "it-IT"): boolean {
  if (typeof speechSynthesis === "undefined") return false;
  if (voices.length === 0) refreshVoices();
  // Sommige browsers vullen de stemmenlijst pas na de eerste uitspraak.
  return voices.length === 0 || voiceFor(lang) !== undefined;
}

/** Alleen het eerste alternatief voorlezen; "il/la collega" klinkt anders raar. */
function speakable(text: string): string {
  return stripGrammarLabels(text)
    .split(/\s*&\s*|\s*,\s*/)[0]
    .replace(/\(([^)]*)\)/g, "$1")
    .replace(/(\S+)\/\S+/g, "$1")
    .trim();
}

export function speak(text: string, lang: "it-IT" | "nl-BE" = "it-IT"): void {
  if (typeof speechSynthesis === "undefined") return;
  const clean = speakable(text);
  if (!clean) return;
  try {
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = lang;
    const voice = voiceFor(lang) ?? (lang === "nl-BE" ? voiceFor("nl-NL") : undefined);
    if (voice) utter.voice = voice;
    utter.rate = 0.92;
    utter.pitch = 1;
    speechSynthesis.speak(utter);
  } catch {
    // Geen stem beschikbaar: stilte is hier prima.
  }
}
