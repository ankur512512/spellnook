import { API_URL } from "./config";
import type { DailyGame, GuessResult } from "./types";

// Relative base => works in dev (Vite proxy) and prod (nginx) without changes.
const BASE = API_URL;

export async function fetchDailyGame(length?: number): Promise<DailyGame> {
  const q = length ? `?length=${length}` : "";
  const res = await fetch(`${BASE}/api/game/daily${q}`);
  if (!res.ok) throw new Error("Failed to load game");
  return res.json();
}

export async function submitGuess(
  gameId: string,
  guess: string,
  guessIndex: number,
): Promise<GuessResult> {
  const res = await fetch(`${BASE}/api/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, guess, guessIndex }),
  });
  if (!res.ok) throw new Error("Failed to submit guess");
  return res.json();
}
