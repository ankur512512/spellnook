import { useEffect, useState } from "react";
import { API_URL } from "../config";
import { GoogleButton } from "./GoogleButton";
import { useAuth } from "./authStore";

const API_BASE = API_URL;

interface LbEntry {
  name: string;
  picture: string | null;
  played: number;
  wins: number;
  winPct: number;
}

export default function Account() {
  const { user, stats, logout } = useAuth();
  const [leaders, setLeaders] = useState<LbEntry[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/leaderboard`)
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => setLeaders(d.entries ?? []))
      .catch(() => {});
  }, [stats]);

  if (!user) {
    return (
      <main className="main account account-centered">
        <div className="account-card">
          <h2>Sign in</h2>
          <p className="muted-text">Track your stats, streaks, and climb the leaderboard.</p>
          <GoogleButton />
        </div>
      </main>
    );
  }

  const dist = stats?.distribution ?? {};
  const maxDist = Math.max(1, ...Object.values(dist));

  return (
    <main className="main account">
      <div className="account-card">
        <div className="profile">
          {user.picture && <img src={user.picture} alt="" className="avatar-lg" referrerPolicy="no-referrer" />}
          <div>
            <div className="profile-name">{user.name}</div>
            <button className="link" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>

        {stats && (
          <>
            <div className="stat-row">
              <Stat label="Played" value={stats.played} />
              <Stat label="Win %" value={stats.winPct} />
              <Stat label="Streak" value={stats.currentStreak} />
              <Stat label="Max" value={stats.maxStreak} />
            </div>

            <h3>Guess distribution</h3>
            <div className="dist">
              {Array.from({ length: 8 }, (_, i) => i + 1)
                .filter((g) => dist[g])
                .map((g) => (
                  <div key={g} className="dist-row">
                    <span className="dist-g">{g}</span>
                    <div className="dist-bar" style={{ width: `${(100 * dist[g]) / maxDist}%` }}>
                      {dist[g]}
                    </div>
                  </div>
                ))}
              {Object.keys(dist).length === 0 && <p className="muted-text">No wins yet — go play!</p>}
            </div>

            {stats.multiPlayed > 0 && (
              <p className="muted-text">
                Multiplayer: {stats.multiWins}/{stats.multiPlayed} won
              </p>
            )}
          </>
        )}

        <h3>Leaderboard</h3>
        <ol className="leaderboard">
          {leaders.map((e, i) => (
            <li key={i}>
              <span className="lb-rank">#{i + 1}</span>
              {e.picture && <img src={e.picture} alt="" className="avatar-sm" referrerPolicy="no-referrer" />}
              <span className="lb-name">{e.name}</span>
              <span className="lb-wins">{e.wins}W · {e.winPct}%</span>
            </li>
          ))}
          {leaders.length === 0 && <p className="muted-text">No players ranked yet.</p>}
        </ol>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
