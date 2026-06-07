import { useEffect, useState } from "react";
import { useTheme } from "./useTheme";
import { useAuth } from "./auth/authStore";
import Home from "./Home";
import Solo from "./Solo";
import Multiplayer from "./multiplayer/Multiplayer";
import Account from "./auth/Account";
import { HowToPlay } from "./HowToPlay";

type View = "home" | "solo" | "mp" | "account";

const HOWTO_SEEN = "spellnook-seen-howto";

export default function App() {
  const { theme, toggle } = useTheme();
  const { user, init } = useAuth();
  const [view, setView] = useState<View>("home");
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    init().catch(() => {});
    // First-time visitors get the How-to-play automatically.
    if (!localStorage.getItem(HOWTO_SEEN)) {
      setShowHowTo(true);
      localStorage.setItem(HOWTO_SEEN, "1");
    }
  }, [init]);

  const tab = (v: View, label: string) => (
    <button className={view === v ? "active" : ""} onClick={() => setView(v)}>
      {label}
    </button>
  );

  return (
    <div className="app">
      <header className="header">
        <h1>Spellnook</h1>
        <nav className="tabs">
          {tab("home", "Home")}
          {tab("solo", "Daily")}
          {tab("mp", "Multiplayer")}
          {tab("account", "Stats")}
        </nav>
        <div className="header-right">
          <button className="theme-toggle" onClick={() => setShowHowTo(true)} title="How to play" aria-label="How to play">
            ❓
          </button>
          {user?.picture && (
            <img
              src={user.picture}
              alt={user.name}
              title={user.name}
              className="avatar-sm"
              referrerPolicy="no-referrer"
              onClick={() => setView("account")}
            />
          )}
          <button
            className="theme-toggle"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {view === "home" ? (
        <Home onPlay={() => setView("solo")} onMultiplayer={() => setView("mp")} onHowTo={() => setShowHowTo(true)} />
      ) : view === "solo" ? (
        <Solo />
      ) : view === "mp" ? (
        <Multiplayer />
      ) : (
        <Account />
      )}

      {showHowTo && <HowToPlay onClose={() => setShowHowTo(false)} />}
    </div>
  );
}
