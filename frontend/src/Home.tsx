import { GoogleButton } from "./auth/GoogleButton";
import { useAuth } from "./auth/authStore";

interface Props {
  onPlay: () => void;
  onMultiplayer: () => void;
  onHowTo: () => void;
}

export default function Home({ onPlay, onMultiplayer, onHowTo }: Props) {
  const { user, logout } = useAuth();

  return (
    <main className="main home">
      <div className="home-card">
        <p className="home-tagline">A daily word puzzle. Race friends. Climb the leaderboard.</p>

        <button className="primary big" onClick={onPlay}>
          Play daily
        </button>
        <button className="secondary big" onClick={onMultiplayer}>
          Multiplayer
        </button>
        <button className="link how-to-link" onClick={onHowTo}>
          How to play
        </button>

        <div className="divider">account</div>

        {user ? (
          <div className="home-account">
            {user.picture && (
              <img src={user.picture} alt="" className="avatar-sm" referrerPolicy="no-referrer" />
            )}
            <span>
              Signed in as <strong>{user.name}</strong>
            </span>
            <button className="link" onClick={logout}>
              Sign out
            </button>
          </div>
        ) : (
          <div className="home-signin">
            <p className="muted-text">Sign in to track your stats, streaks &amp; achievements.</p>
            <GoogleButton />
          </div>
        )}

        <footer className="home-footer">
          <a href="/privacy.html" target="_blank" rel="noreferrer">
            Privacy
          </a>
        </footer>
      </div>
    </main>
  );
}
