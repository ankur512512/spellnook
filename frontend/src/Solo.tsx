import { useEffect } from "react";
import { useGame } from "./store";
import { Board } from "./components/Board";
import { Keyboard } from "./components/Keyboard";

// Single-player daily game.
export default function Solo() {
  const { phase, message, availableLengths, length, setLength, init, addLetter, removeLetter, submit } =
    useGame();

  useEffect(() => {
    init().catch(() => {});
  }, [init]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") submit();
      else if (e.key === "Backspace") removeLetter();
      else if (/^[a-zA-Z]$/.test(e.key)) addLetter(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addLetter, removeLetter, submit]);

  return (
    <>
      {availableLengths.length > 1 && (
        <div className="controls">
          <span className="label">Letters</span>
          {availableLengths.map((n) => (
            <button
              key={n}
              className={`len-btn ${n === length ? "active" : ""}`}
              onClick={() => setLength(n)}
              aria-pressed={n === length}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      <main className="main">
        {phase === "loading" ? (
          <p className="loading">Loading…</p>
        ) : (
          <>
            {message && <div className="toast">{message}</div>}
            <Board />
          </>
        )}
      </main>

      <Keyboard />
    </>
  );
}
