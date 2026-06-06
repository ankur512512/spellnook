import type { LetterStatus } from "../types";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

interface Props {
  keyStatuses: Record<string, LetterStatus>;
  onKey: (key: string) => void; // "enter" | "back" | a-z
  disabled?: boolean;
}

export function KeyboardView({ keyStatuses, onKey, disabled }: Props) {
  const press = (key: string) => {
    if (!disabled) onKey(key);
  };

  return (
    <div className="keyboard">
      {ROWS.map((row, i) => (
        <div key={i} className="kb-row">
          {i === 2 && (
            <button className="key wide" onClick={() => press("enter")}>
              Enter
            </button>
          )}
          {row.split("").map((ch) => {
            const s: LetterStatus | undefined = keyStatuses[ch];
            return (
              <button key={ch} className={`key ${s ? `s-${s}` : ""}`} onClick={() => press(ch)}>
                {ch.toUpperCase()}
              </button>
            );
          })}
          {i === 2 && (
            <button className="key wide" onClick={() => press("back")} aria-label="Backspace">
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
