// Playful win/lose copy. Deterministic pick (seeded) so the message stays stable
// for a given game/round instead of changing on every re-render.

function seededIndex(seed: string, len: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % len;
}

// Praise scales with how few guesses it took: index 0 = solved in 1 guess (max
// hype) … later indexes = more guesses (cooler praise). Bodies are lowercase so
// they read after "Congrats <name>, ..." or "Congrats! ..." (then capitalized).
const WIN_TIERS: string[][] = [
  // 1 guess — absurd praise
  [
    "a ONE-guess miracle — are you reading my mind?! 🤯👑",
    "first try?! certified word psychic. 🔮👑",
  ],
  // 2 guesses
  ["two guesses — absolutely elite. 🏆", "solved in two. big-brain energy. 🧠"],
  // 3 guesses
  ["three guesses — smooth operator. 😎", "a tidy three-guess win. classy. ✨"],
  // 4 guesses
  ["four guesses — solid work. 👏", "got there in four, nicely done. 🙂"],
  // 5 guesses
  ["five guesses — cut it a little close! 😅", "five tries… but a win’s a win. 👍"],
  // 6+ guesses — last-gasp
  ["phew — a last-gasp win! 😮‍💨", "right at the buzzer… that was sweaty. 😅"],
];

const LOSE_LINES = [
  "Sorry — {w} already won. Better luck next time! 😅",
  "{w} snatched the win. So close… okay, not that close. 😬",
  "Out-spelled by {w} this round. Rematch? 🔁",
  "{w} got there first — blink and you missed it. ⚡",
  "{w} wins! The word gods smiled on them today. 🙃",
];

// Funny congratulations, scaled by guess count. Addresses the player by name if
// given ("Congrats Ankur, two guesses — elite."), else a generic "Congrats! ...".
export function funnyWin(name: string | undefined, guesses: number, seed: string): string {
  const tier = WIN_TIERS[Math.min(Math.max(guesses, 1), WIN_TIERS.length) - 1];
  const body = tier[seededIndex(seed, tier.length)];
  if (name) return `Congrats ${name}, ${body}`;
  return `Congrats! ${body.charAt(0).toUpperCase()}${body.slice(1)}`;
}

// Nudge for players who lost a multiplayer round.
export function funnyLose(winner: string, seed: string): string {
  return LOSE_LINES[seededIndex(seed, LOSE_LINES.length)].replace(/\{w\}/g, winner);
}
