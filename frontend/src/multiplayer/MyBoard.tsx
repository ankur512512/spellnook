import type { CSSProperties } from "react";
import { Tile } from "../components/Tile";
import type { LetterStatus } from "../types";
import { useMp } from "./mpStore";

// The local player's full board (letters known locally; statuses from server).
export function MyBoard() {
  const { room, myRows, current } = useMp();
  if (!room) return null;

  const rows = room.maxGuesses;
  const cols = room.length;
  const activeRow = myRows.length;
  const boardStyle = { "--rows": rows, "--cols": cols } as CSSProperties;

  return (
    <div className="board" style={boardStyle}>
      {Array.from({ length: rows }).map((_, r) => {
        const submitted = r < myRows.length;
        const word = submitted ? myRows[r].letters : r === activeRow ? current : "";
        const statuses = submitted ? myRows[r].statuses : null;
        return (
          <div key={r} className="row">
            {Array.from({ length: cols }).map((_, c) => {
              const letter = word[c] ?? "";
              let status: LetterStatus = "empty";
              if (statuses) status = statuses[c];
              else if (letter) status = "tbd";
              return (
                <Tile
                  key={c}
                  letter={letter}
                  status={status}
                  revealed={!!statuses}
                  revealDelay={statuses ? c * 380 : 0}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
