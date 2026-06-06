// Mobile haptics. No-op where unsupported (e.g. iOS Safari doesn't implement it).
function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}

// Short error buzz — invalid / non-existent word.
export const buzzInvalid = () => vibrate([55, 35, 55]);

// Celebratory pattern — a win (daily or multiplayer).
export const buzzWin = () => vibrate([60, 50, 90, 50, 180]);
