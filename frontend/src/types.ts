export type LetterStatus = "correct" | "present" | "absent" | "empty" | "tbd";

export interface DailyGame {
  gameId: string;
  date: string;
  wordLength: number;
  maxGuesses: number;
  availableLengths: number[];
}

export interface GuessResult {
  valid: boolean;
  statuses: LetterStatus[];
  won: boolean;
  answer?: string | null;
  reason?: string | null;
}
