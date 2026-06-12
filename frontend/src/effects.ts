import confetti from "canvas-confetti";
import { buzzLose, buzzWin } from "./haptics";
import { playLose, playWin } from "./sound";

// Winner: confetti + chime + celebratory vibration. Only call for the winning client.
export function celebrateWin() {
  buzzWin();
  playWin();
  confetti({ particleCount: 130, spread: 75, origin: { y: 0.65 }, disableForReducedMotion: true });
  setTimeout(
    () => confetti({ particleCount: 80, spread: 110, scalar: 0.9, origin: { y: 0.5 }, disableForReducedMotion: true }),
    220,
  );
}

// Loser: soft sad sound + vibration (no confetti).
export function loseFeedback() {
  buzzLose();
  playLose();
}
