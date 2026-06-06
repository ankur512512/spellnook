import { create } from "zustand";
import { API_URL, GOOGLE_CLIENT_ID } from "../config";

const API_BASE = API_URL;
export { GOOGLE_CLIENT_ID };
const TOKEN_KEY = "spellnook-auth-token";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture: string | null;
}

export interface UserStats {
  played: number;
  wins: number;
  winPct: number;
  currentStreak: number;
  maxStreak: number;
  distribution: Record<string, number>;
  multiPlayed: number;
  multiWins: number;
}

export interface ResultPayload {
  mode: "daily" | "practice";
  length: number;
  won: boolean;
  guesses: number;
  durationMs?: number;
  puzzleDate?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  stats: UserStats | null;
  configured: boolean;
  busy: boolean;

  init: () => Promise<void>;
  login: (credential: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  recordResult: (r: ResultPayload) => Promise<void>;
}

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export const useAuth = create<AuthState>((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  stats: null,
  configured: !!GOOGLE_CLIENT_ID,
  busy: false,

  init: async () => {
    if (get().token) await get().refresh();
  },

  login: async (credential) => {
    set({ busy: true });
    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      if (!res.ok) throw new Error("auth_failed");
      const { token, user } = await res.json();
      localStorage.setItem(TOKEN_KEY, token);
      set({ token, user });
      await get().refresh();
    } finally {
      set({ busy: false });
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, stats: null });
  },

  refresh: async () => {
    const token = get().token;
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/me`, { headers: authHeaders(token) });
    if (res.status === 401) {
      get().logout();
      return;
    }
    if (!res.ok) return;
    const { user, stats } = await res.json();
    set({ user, stats });
  },

  recordResult: async (r) => {
    const token = get().token;
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/results`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(r),
      });
      await get().refresh();
    } catch {
      /* stats recording is best-effort; never block gameplay */
    }
  },
}));
