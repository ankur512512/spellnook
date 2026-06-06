import { useEffect, useState } from "react";
import { KeyboardView } from "../components/KeyboardView";
import { useMp } from "./mpStore";
import { MyBoard } from "./MyBoard";
import { OpponentBoard } from "./OpponentBoard";

const LENGTHS = [4, 5, 6, 7];

export default function Multiplayer() {
  const room = useMp((s) => s.room);
  const resume = useMp((s) => s.resume);

  // Reconnect to a saved session on mount (survives refresh).
  useEffect(() => {
    resume();
  }, [resume]);

  if (!room) return <Lobby />;
  return <RoomView />;
}

function Lobby() {
  const { name, setName, createRoom, joinRoom, error, connecting } = useMp();
  const [code, setCode] = useState("");
  const canSubmit = name.trim().length > 0 && !connecting;

  return (
    <main className="main mp-lobby">
      <div className="lobby-card">
        <label className="field">
          <span>Display name (required)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            maxLength={20}
            autoFocus
          />
        </label>

        <button className="primary" disabled={!canSubmit} onClick={() => createRoom(name)}>
          Create room
        </button>

        <div className="divider">or join</div>

        <div className="join-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            maxLength={4}
            className="code-input"
          />
          <button disabled={!canSubmit || code.length < 4} onClick={() => joinRoom(code, name)}>
            Join
          </button>
        </div>

        {!name.trim() && <p className="hint">Enter a name so others know who they're up against.</p>}
        {error && <p className="error">{errorText(error)}</p>}
      </div>
    </main>
  );
}

function RoomView() {
  const { room, you, message, start, addLetter, removeLetter, submit, leave, myKeys } = useMp();
  const [length, setLength] = useState(5);
  const [focused, setFocused] = useState<string | null>(null);

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

  if (!room) return null;
  const isHost = you === room.hostId;
  const me = room.players.find((p) => p.id === you);
  const opponents = room.players.filter((p) => p.id !== you);
  const focusedPlayer = opponents.find((p) => p.id === focused) ?? null;

  return (
    <div className="mp-room">
      <div className="room-bar">
        <span>
          Room <strong className="code">{room.code}</strong>
        </span>
        <span className="muted-text">
          {room.players.length}/{room.maxPlayers}
        </span>
        <button className="link" onClick={() => navigator.clipboard?.writeText(room.code)}>
          Copy
        </button>
        <button className="link" onClick={leave}>
          Leave
        </button>
      </div>

      {room.phase === "waiting" && (
        <div className="waiting">
          <p>Players ({room.players.length})</p>
          <ul className="player-list">
            {room.players.map((p) => (
              <li key={p.id}>
                {p.name}
                {p.id === room.hostId ? " (host)" : ""}
                {p.id === you ? " — you" : ""}
              </li>
            ))}
          </ul>
          {isHost ? (
            <>
              <div className="controls">
                <span className="label">Letters</span>
                {LENGTHS.map((n) => (
                  <button
                    key={n}
                    className={`len-btn ${n === length ? "active" : ""}`}
                    onClick={() => setLength(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button className="primary" onClick={() => start(length)}>
                Start race
              </button>
            </>
          ) : (
            <p className="muted-text">Waiting for the host to start…</p>
          )}
        </div>
      )}

      {(room.phase === "playing" || room.phase === "finished") && (
        <div className="race">
          {message && <div className="toast">{message}</div>}

          <div className="race-body">
            {room.phase === "finished" && (
              <div className="result">
                <h2>{me?.won ? "You won! 🏆" : "Round over"}</h2>
                {room.answer && (
                  <p>
                    Answer: <strong>{room.answer.toUpperCase()}</strong>
                  </p>
                )}
                <ol className="ranking">
                  {[...room.players]
                    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                    .map((p) => (
                      <li key={p.id}>
                        #{p.rank} {p.name}
                        {p.id === you ? " (you)" : ""} — {p.won ? `${p.guessCount} guesses` : "no solve"}
                      </li>
                    ))}
                </ol>
                {isHost && (
                  <button className="primary" onClick={() => start(room.length)}>
                    Play again
                  </button>
                )}
              </div>
            )}

            {opponents.length > 0 && (
              <div className="opp-area">
                {opponents.map((p) => (
                  <OpponentBoard
                    key={p.id}
                    player={p}
                    length={room.length}
                    maxGuesses={room.maxGuesses}
                    collapsed
                    onClick={() => setFocused(p.id)}
                  />
                ))}
              </div>
            )}

            <div className="my-area">
              <div className="my-name">{me?.name ?? "You"} (you)</div>
              <MyBoard />
            </div>
          </div>

          {room.phase === "playing" && (
            <KeyboardView
              keyStatuses={myKeys}
              onKey={(k) => (k === "enter" ? submit() : k === "back" ? removeLetter() : addLetter(k))}
              disabled={me?.finished}
            />
          )}
        </div>
      )}

      {focusedPlayer && (
        <div className="overlay" onClick={() => setFocused(null)}>
          <div className="overlay-inner" onClick={(e) => e.stopPropagation()}>
            <OpponentBoard player={focusedPlayer} length={room.length} maxGuesses={room.maxGuesses} large />
            <button className="link" onClick={() => setFocused(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function errorText(reason: string): string {
  switch (reason) {
    case "room_not_found":
      return "Room not found — check the code.";
    case "room_full":
      return "That room is full.";
    case "in_progress":
      return "That game already started — wait for the next round.";
    case "create_failed":
      return "Couldn't create a room. Is the server running?";
    case "connection_error":
      return "Connection error.";
    default:
      return reason;
  }
}
