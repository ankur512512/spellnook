import { create } from "zustand";
import { fetchDailyGame, submitGuess } from "./api";
import { useAuth } from "./auth/authStore";
import type { DailyGame, LetterStatus } from "./types";

type Phase = "loading" | "playing" | "won" | "lost";

// Priority so a key never downgrades (correct > present > absent).
const RANK: Record<string, number> = { correct: 3, present: 2, absent: 1 };

interface GameState {
  game: DailyGame | null;
  availableLengths: number[];
  length: number;
  phase: Phase;
  guesses: string[]; // submitted words
  statuses: LetterStatus[][]; // per submitted word
  current: string; // row being typed
  keyStatuses: Record<string, LetterStatus>;
  message: string | null;
  shake: boolean;
  answer: string | null;

  init: () => Promise<void>;
  setLength: (length: number) => Promise<void>;
  addLetter: (ch: string) => void;
  removeLetter: () => void;
  submit: () => Promise<void>;
}

// Fresh board state when (re)loading a puzzle.
const freshBoard = {
  guesses: [] as string[],
  statuses: [] as LetterStatus[][],
  current: "",
  keyStatuses: {} as Record<string, LetterStatus>,
  answer: null as string | null,
  message: null as string | null,
  phase: "playing" as Phase,
};

let messageTimer: ReturnType<typeof setTimeout> | undefined;
let startedAt = Date.now();

export const useGame = create<GameState>((set, get) => ({
  game: null,
  availableLengths: [],
  length: 5,
  phase: "loading",
  guesses: [],
  statuses: [],
  current: "",
  keyStatuses: {},
  message: null,
  shake: false,
  answer: null,

  init: async () => {
    const game = await fetchDailyGame();
    startedAt = Date.now();
    set({
      game,
      availableLengths: game.availableLengths,
      length: game.wordLength,
      ...freshBoard,
    });
  },

  setLength: async (length) => {
    if (length === get().length) return;
    set({ phase: "loading" });
    const game = await fetchDailyGame(length);
    startedAt = Date.now();
    set({
      game,
      availableLengths: game.availableLengths,
      length: game.wordLength,
      ...freshBoard,
    });
  },

  addLetter: (ch) => {
    const { game, current, phase } = get();
    if (!game || phase !== "playing") return;
    if (current.length >= game.wordLength) return;
    if (!/^[a-zA-Z]$/.test(ch)) return;
    set({ current: current + ch.toLowerCase() });
  },

  removeLetter: () => {
    const { current, phase } = get();
    if (phase !== "playing") return;
    set({ current: current.slice(0, -1) });
  },

  submit: async () => {
    const { game, current, guesses, statuses, keyStatuses, phase } = get();
    if (!game || phase !== "playing") return;

    if (current.length !== game.wordLength) {
      flash(set, "Not enough letters");
      bump(set);
      return;
    }

    const guessIndex = guesses.length;
    const result = await submitGuess(game.gameId, current, guessIndex);

    if (!result.valid) {
      flash(set, result.reason === "not_in_word_list" ? "Not in word list" : "Invalid guess");
      bump(set);
      return;
    }

    // Merge key colors without downgrading.
    const nextKeys = { ...keyStatuses };
    current.split("").forEach((ch, i) => {
      const s = result.statuses[i];
      if (!nextKeys[ch] || RANK[s] > (RANK[nextKeys[ch]] ?? 0)) nextKeys[ch] = s;
    });

    const nextGuesses = [...guesses, current];
    const nextStatuses = [...statuses, result.statuses];

    let phaseNext: Phase = "playing";
    if (result.won) phaseNext = "won";
    else if (nextGuesses.length >= game.maxGuesses) phaseNext = "lost";

    set({
      guesses: nextGuesses,
      statuses: nextStatuses,
      current: "",
      keyStatuses: nextKeys,
      phase: phaseNext,
      answer: result.answer ?? null,
    });

    if (phaseNext === "won") flash(set, pickWinWord(nextGuesses.length), 4000);
    else if (phaseNext === "lost") flash(set, (result.answer ?? "").toUpperCase(), 6000);

    // Record the finished game for signed-in players (best-effort).
    if (phaseNext !== "playing") {
      useAuth.getState().recordResult({
        mode: "daily",
        length: game.wordLength,
        won: phaseNext === "won",
        guesses: nextGuesses.length,
        durationMs: Date.now() - startedAt,
        puzzleDate: game.date,
      });
    }
  },
}));

function bump(set: (p: Partial<GameState>) => void) {
  set({ shake: true });
  setTimeout(() => set({ shake: false }), 600);
}

function flash(set: (p: Partial<GameState>) => void, msg: string, ms = 1200) {
  clearTimeout(messageTimer);
  set({ message: msg });
  messageTimer = setTimeout(() => set({ message: null }), ms);
}

function pickWinWord(n: number): string {
  return (
    ["Genius", "Magnificent", "Impressive", "Splendid", "Great", "Nice", "Solid", "Phew"][n - 1] ??
    "Solved"
  );
}
