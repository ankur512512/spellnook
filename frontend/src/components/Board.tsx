import type { CSSProperties } from "react";
import { useGame } from "../store";
import { Tile } from "./Tile";
import type { LetterStatus } from "../types";

export function Board() {
  const { game, guesses, statuses, current, shake } = useGame();
  if (!game) return null;

  const rows = game.maxGuesses;
  const cols = game.wordLength;
  const activeRow = guesses.length;
  const boardStyle = { "--rows": rows, "--cols": cols } as CSSProperties;

  return (
    <div className="board" style={boardStyle}>
      {Array.from({ length: rows }).map((_, r) => {
        const isCurrent = r === activeRow;
        const word = r < guesses.length ? guesses[r] : isCurrent ? current : "";
        const rowStatuses = statuses[r];
        return (
          <div key={r} className={`row ${isCurrent && shake ? "shake" : ""}`}>
            {Array.from({ length: cols }).map((_, c) => {
              const letter = word[c] ?? "";
              let status: LetterStatus = "empty";
              if (rowStatuses) status = rowStatuses[c];
              else if (letter) status = "tbd";
              return (
                <Tile
                  key={c}
                  letter={letter}
                  status={status}
                  revealed={!!rowStatuses}
                  revealDelay={rowStatuses ? c * 380 : 0}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
