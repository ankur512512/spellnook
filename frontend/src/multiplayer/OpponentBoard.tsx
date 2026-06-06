import type { CSSProperties } from "react";
import type { MpPlayer } from "./mpStore";

interface Props {
  player: MpPlayer;
  length: number;
  maxGuesses: number;
  large?: boolean; // full board, used in the enlarge overlay
  collapsed?: boolean; // compact chip: name + latest row + progress
  onClick?: () => void;
}

function nameLabel(player: MpPlayer) {
  return (
    <div className="opp-name">
      {player.rank ? <span className="rank">#{player.rank}</span> : null}
      {player.name}
      {player.won ? " 🏆" : player.finished ? " ✓" : ""}
      {player.connected ? "" : " ⏸"}
    </div>
  );
}

export function OpponentBoard({ player, length, maxGuesses, large, collapsed, onClick }: Props) {
  const style = { "--cols": length } as CSSProperties;

  // Compact strip view: just the most recent guess's colors + N/max.
  if (collapsed) {
    const last = player.rows[player.rows.length - 1];
    return (
      <button
        className={`opp collapsed ${player.connected ? "" : "offline"}`}
        onClick={onClick}
        type="button"
        title="Tap to enlarge"
      >
        {nameLabel(player)}
        <div className="mini-board" style={style}>
          <div className="mini-row">
            {Array.from({ length }).map((_, c) => {
              const s = last?.[c];
              return <div key={c} className={`mini-tile ${s ? `s-${s}` : ""}`} />;
            })}
          </div>
        </div>
        <div className="opp-progress">
          {player.guessCount}/{maxGuesses}
        </div>
      </button>
    );
  }

  // Full board (enlarge overlay).
  return (
    <div className={`opp ${large ? "large" : ""}`}>
      {nameLabel(player)}
      <div className="mini-board" style={style}>
        {Array.from({ length: maxGuesses }).map((_, r) => (
          <div key={r} className="mini-row">
            {Array.from({ length }).map((_, c) => {
              const s = player.rows[r]?.[c];
              return <div key={c} className={`mini-tile ${s ? `s-${s}` : ""}`} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
