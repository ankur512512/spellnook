import { useEffect, useState } from "react";
import { GoogleButton } from "../auth/GoogleButton";
import { useAuth } from "../auth/authStore";
import { KeyboardView } from "../components/KeyboardView";
import { funnyLose, funnyWin } from "../messages";
import { useMp } from "./mpStore";
import { MyBoard } from "./MyBoard";
import { OpponentBoard } from "./OpponentBoard";

const LENGTHS = [4, 5, 6, 7];

export default function Multiplayer() {
  const room = useMp((s) => s.room);
  const resume = useMp((s) => s.resume);
  const fetchQuota = useMp((s) => s.fetchQuota);
  const user = useAuth((s) => s.user);

  // Reconnect to a saved session + load today's quota when signed in.
  useEffect(() => {
    resume();
    fetchQuota();
  }, [resume, fetchQuota, user]);

  if (!user) return <SignInGate />;
  if (!room) return <Lobby />;
  return <RoomView />;
}

function SignInGate() {
  return (
    <main className="main mp-lobby">
      <div className="lobby-card signin-card">
        <h2>Play with friends</h2>
        <p className="muted-text">
          Sign in to create or join multiplayer rooms, race your friends, and track your wins.
        </p>
        <GoogleButton />
      </div>
    </main>
  );
}

function GamesLeft() {
  const quota = useMp((s) => s.quota);
  if (!quota) return null;
  return (
    <p className={`games-left ${quota.remaining === 0 ? "none" : ""}`}>
      {quota.remaining} of {quota.limit} free games left today
    </p>
  );
}

function Lobby() {
  const { createRoom, joinRoom, error, connecting, quota } = useMp();
  const { user, logout } = useAuth();
  const [code, setCode] = useState("");
  const canPlay = (!quota || quota.remaining > 0) && !connecting;

  return (
    <main className="main mp-lobby">
      <div className="lobby-card">
        <div className="mp-account">
          {user?.picture && (
            <img src={user.picture} alt="" className="avatar-sm" referrerPolicy="no-referrer" />
          )}
          <span>
            Signed in as <strong>{user?.name}</strong>
          </span>
          <button className="link" onClick={logout}>
            Sign out
          </button>
        </div>

        <GamesLeft />
        {quota?.remaining === 0 && (
          <p className="muted-text">You’re out of games for today — come back tomorrow! 🌙</p>
        )}

        <div className="lobby-section">
          <h3>Join a room</h3>
          <div className="join-row">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              maxLength={4}
              className="code-input"
            />
            <button disabled={!canPlay || code.length < 4} onClick={() => joinRoom(code)}>
              Join
            </button>
          </div>
          <p className="muted-text">Got a code from a friend? Enter it to jump into their room.</p>
        </div>

        <div className="divider">or</div>

        <div className="lobby-section">
          <button className="primary big" disabled={!canPlay} onClick={() => createRoom()}>
            Create a new room
          </button>
          <p className="muted-text">
            You’ll get a room code — share it with friends so they can join and race you. 🏁
          </p>
        </div>

        {error && <p className="error">{errorText(error)}</p>}
      </div>
    </main>
  );
}

function RoomView() {
  const { room, you, message, quota, start, addLetter, removeLetter, submit, leave, myKeys } = useMp();
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
  const winnerName = room.players.find((p) => p.won)?.name;
  const opponents = room.players.filter((p) => p.id !== you);
  const focusedPlayer = opponents.find((p) => p.id === focused) ?? null;
  const outOfGames = !!quota && quota.remaining <= 0;

  const lengthPicker = (
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
  );

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
          <p className="share-hint">
            Share code <strong className="code">{room.code}</strong> with friends so they can join.
          </p>
          <GamesLeft />
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
            outOfGames ? (
              <p className="muted-text">You’re out of free games today — come back tomorrow! 🌙</p>
            ) : (
              <>
                {lengthPicker}
                <button className="primary" onClick={() => start(length)}>
                  Start race
                </button>
              </>
            )
          ) : (
            <p className="muted-text">Waiting for the host to start…</p>
          )}
        </div>
      )}

      {(room.phase === "playing" || room.phase === "finished") && (
        <div className="race">
          {message && <div className="toast">{message}</div>}

          <div className="race-body">
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

            {room.phase === "finished" && (
              <div className={`result ${me?.won ? "won" : "lost"}`}>
                <h2>
                  {me?.won
                    ? "You won! 🎉"
                    : winnerName
                      ? `${winnerName} won 😔`
                      : "Round over — nobody solved it"}
                </h2>
                <p className="result-msg">
                  {me?.won
                    ? funnyWin(me.name, me.guessCount, `${room.code}:${room.round}`)
                    : winnerName
                      ? funnyLose(winnerName, `${room.code}:${room.round}`)
                      : "Nobody cracked it — the word wins! 🤐"}
                </p>
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
                {isHost ? (
                  outOfGames ? (
                    <p className="muted-text">You’re out of free games today — come back tomorrow! 🌙</p>
                  ) : (
                    <div className="playagain">
                      {lengthPicker}
                      <button className="primary" onClick={() => start(length)}>
                        Play again
                      </button>
                    </div>
                  )
                ) : (
                  <p className="muted-text">Waiting for the host to start another round…</p>
                )}
              </div>
            )}
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
    case "auth_required":
      return "Please sign in to play multiplayer.";
    case "limit_reached":
      return "You’ve used your 3 free games today — come back tomorrow!";
    case "room_not_found":
      return "Room not found — check the code.";
    case "room_full":
      return "That room is full.";
    case "in_progress":
      return "That game already started — wait for the next round.";
    case "create_failed":
      return "Couldn’t create a room. Is the server running?";
    case "rooms_full":
      return "Servers are busy right now — try again in a moment.";
    case "connection_error":
      return "Connection error.";
    default:
      return reason;
  }
}
