// Playful win/lose copy. Deterministic pick (seeded) so the message stays stable
// for a given game/round instead of changing on every re-render.

function seededIndex(seed: string, len: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % len;
}

const WIN_LINES = [
  "Nailed it — your brain’s basically a dictionary. 🎉",
  "That was chef’s-kiss. Spelling-bee champ vibes. 🏆",
  "Too easy for you? Show-off. 🔥",
  "Big-brain energy. Certified word wizard. 🧠",
  "Solved it like a legend — the letters never stood a chance. ✨",
  "Boom. Word demolished. 🪄",
];

const LOSE_LINES = [
  "Sorry — {w} already won. Better luck next time! 😅",
  "{w} snatched the win. So close… okay, not that close. 😬",
  "Out-spelled by {w} this round. Rematch? 🔁",
  "{w} got there first — blink and you missed it. ⚡",
  "{w} wins! The word gods smiled on them today. 🙃",
];

// Funny congratulations. Mentions the name if given, otherwise skips it.
export function funnyWin(name: string | undefined, seed: string): string {
  const line = WIN_LINES[seededIndex(seed, WIN_LINES.length)];
  if (!name) return line;
  return `${name}, ${line.charAt(0).toLowerCase()}${line.slice(1)}`;
}

// Nudge for players who lost a multiplayer round.
export function funnyLose(winner: string, seed: string): string {
  return LOSE_LINES[seededIndex(seed, LOSE_LINES.length)].replace(/\{w\}/g, winner);
}
