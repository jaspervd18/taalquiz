export interface Word {
  /** lesnummer */
  l: number;
  nl: string;
  it: string;
  t: "noun" | "verb" | "adjective" | "other";
}

export type Direction = "it2nl" | "nl2it";
export type Style = "mcq" | "type";
export type GameMode = "test" | "practice" | "review";

export interface Options {
  lessons: number[];
  direction: Direction | "mixed";
  style: Style | "mixed";
  mode: GameMode;
  /** 0 = alle woorden */
  count: number;
  audio: boolean;
}

export interface Question {
  id: string;
  word: Word;
  direction: Direction;
  style: Style;
  prompt: string;
  answer: string;
  choices: string[];
}

export type Verdict = "correct" | "almost" | "wrong";

export interface Attempt {
  question: Question;
  given: string;
  verdict: Verdict;
  note?: string;
}
