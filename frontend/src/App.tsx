import { useEffect, useState } from "react";
import { useTheme } from "./useTheme";
import { useAuth } from "./auth/authStore";
import Solo from "./Solo";
import Multiplayer from "./multiplayer/Multiplayer";
import Account from "./auth/Account";

type View = "solo" | "mp" | "account";

export default function App() {
  const { theme, toggle } = useTheme();
  const [view, setView] = useState<View>("solo");
  const { user, init } = useAuth();

  useEffect(() => {
    init().catch(() => {});
  }, [init]);

  return (
    <div className="app">
      <header className="header">
        <h1>Spellnook</h1>
        <nav className="tabs">
          <button className={view === "solo" ? "active" : ""} onClick={() => setView("solo")}>
            Daily
          </button>
          <button className={view === "mp" ? "active" : ""} onClick={() => setView("mp")}>
            Multiplayer
          </button>
          <button className={view === "account" ? "active" : ""} onClick={() => setView("account")}>
            Stats
          </button>
        </nav>
        <div className="header-right">
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

      {view === "solo" ? <Solo /> : view === "mp" ? <Multiplayer /> : <Account />}
    </div>
  );
}
