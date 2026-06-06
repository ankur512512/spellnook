import { create } from "zustand";
import { useAuth } from "../auth/authStore";
import { API_URL } from "../config";
import type { LetterStatus } from "../types";

const API_BASE = API_URL;
const RANK: Record<string, number> = { correct: 3, present: 2, absent: 1 };

const CID_KEY = "spellnook-mp-cid";
const NAME_KEY = "spellnook-mp-name";
const SESSION_KEY = "spellnook-mp-session";

export interface MpPlayer {
  id: string;
  name: string;
  connected: boolean;
  rows: LetterStatus[][];
  guessCount: number;
  finished: boolean;
  won: boolean;
  rank: number | null;
}

export interface MpRoom {
  code: string;
  phase: "waiting" | "playing" | "finished";
  round: number;
  length: number;
  maxGuesses: number;
  maxPlayers: number;
  hostId: string | null;
  answer: string | null;
  players: MpPlayer[];
}

interface MyRow {
  letters: string;
  statuses: LetterStatus[];
}

interface MpState {
  ws: WebSocket | null;
  you: string | null;
  room: MpRoom | null;
  error: string | null;
  message: string | null;
  connecting: boolean;
  name: string;
  round: number;

  myRows: MyRow[];
  current: string;
  myKeys: Record<string, LetterStatus>;

  setName: (name: string) => void;
  resume: () => void;
  createRoom: (name: string) => Promise<void>;
  joinRoom: (code: string, name: string) => void;
  leave: () => void;
  start: (length: number) => void;
  addLetter: (ch: string) => void;
  removeLetter: () => void;
  submit: () => void;
}

let msgTimer: ReturnType<typeof setTimeout> | undefined;

function clientId(): string {
  let id = localStorage.getItem(CID_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "");
    localStorage.setItem(CID_KEY, id);
  }
  return id;
}

function wsUrl(code: string, name: string): string {
  const cid = clientId();
  const token = useAuth.getState().token;
  let q = `name=${encodeURIComponent(name)}&cid=${encodeURIComponent(cid)}`;
  if (token) q += `&token=${encodeURIComponent(token)}`;
  if (API_BASE) {
    const u = new URL(API_BASE);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}/ws/room/${code}?${q}`;
  }
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws/room/${code}?${q}`;
}

interface SavedSession {
  code: string;
  name: string;
  round: number;
  myRows: MyRow[];
  current: string;
}

function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SavedSession) : null;
  } catch {
    return null;
  }
}

export const useMp = create<MpState>((set, get) => {
  const flash = (m: string, ms = 1500) => {
    clearTimeout(msgTimer);
    set({ message: m });
    msgTimer = setTimeout(() => set({ message: null }), ms);
  };

  const persist = () => {
    const { room, name, round, myRows, current } = get();
    if (!room) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    const session: SavedSession = { code: room.code, name, round, myRows, current };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  };

  const keysFromRows = (rows: MyRow[]): Record<string, LetterStatus> => {
    const keys: Record<string, LetterStatus> = {};
    for (const row of rows) {
      row.letters.split("").forEach((ch, i) => {
        const s = row.statuses[i];
        if (!keys[ch] || RANK[s] > (RANK[keys[ch]] ?? 0)) keys[ch] = s;
      });
    }
    return keys;
  };

  const connect = (code: string, name: string) => {
    set({ connecting: true, error: null });
    const ws = new WebSocket(wsUrl(code, name));

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "welcome") {
        set({ you: msg.you });
      } else if (msg.type === "state") {
        const room: MpRoom = msg.room;
        // Reset my local board only on a genuinely new round (not on reconnect).
        if (room.round !== get().round) {
          set({ round: room.round, myRows: [], current: "", myKeys: {} });
        }
        set({ room });
        persist();
      } else if (msg.type === "guess_result") {
        if (msg.valid) {
          const { current, myRows } = get();
          const rows = [...myRows, { letters: current, statuses: msg.statuses }];
          set({ myRows: rows, current: "", myKeys: keysFromRows(rows) });
          persist();
          if (msg.won) flash("You got it! 🎉", 4000);
          else if (msg.answer) flash(`Answer: ${String(msg.answer).toUpperCase()}`, 5000);
        } else {
          flash(
            msg.reason === "not_in_word_list"
              ? "Not in word list"
              : msg.reason === "wrong_length"
                ? "Not enough letters"
                : "Can't guess now",
          );
        }
      } else if (msg.type === "error") {
        set({ error: msg.reason, connecting: false });
        if (msg.reason === "room_not_found") localStorage.removeItem(SESSION_KEY);
      }
    };

    ws.onclose = () => set({ connecting: false, ws: null });
    ws.onerror = () => set({ error: "connection_error", connecting: false });
    ws.onopen = () => set({ connecting: false });

    set({ ws });
  };

  return {
    ws: null,
    you: null,
    room: null,
    error: null,
    message: null,
    connecting: false,
    name: localStorage.getItem(NAME_KEY) || "",
    round: 0,
    myRows: [],
    current: "",
    myKeys: {},

    setName: (name) => {
      localStorage.setItem(NAME_KEY, name);
      set({ name });
    },

    resume: () => {
      if (get().ws || get().room) return;
      const s = loadSession();
      if (!s?.code) return;
      // Restore local board first so the round check below preserves it.
      set({
        name: s.name || get().name,
        round: s.round,
        myRows: s.myRows || [],
        current: s.current || "",
        myKeys: keysFromRows(s.myRows || []),
      });
      connect(s.code, s.name || get().name || "Player");
    },

    createRoom: async (name) => {
      set({ error: null });
      const res = await fetch(`${API_BASE}/api/room`, { method: "POST" });
      if (!res.ok) {
        set({ error: "create_failed" });
        return;
      }
      const { code } = await res.json();
      set({ round: 0, myRows: [], current: "", myKeys: {} });
      connect(code, name || "Player");
    },

    joinRoom: (code, name) => {
      set({ round: 0, myRows: [], current: "", myKeys: {} });
      connect(code.trim().toUpperCase(), name || "Player");
    },

    leave: () => {
      const ws = get().ws;
      try {
        ws?.send(JSON.stringify({ type: "leave" }));
      } catch {
        /* socket may already be closed */
      }
      ws?.close();
      localStorage.removeItem(SESSION_KEY);
      set({
        ws: null,
        you: null,
        room: null,
        error: null,
        round: 0,
        myRows: [],
        current: "",
        myKeys: {},
      });
    },

    start: (length) => {
      get().ws?.send(JSON.stringify({ type: "start", length }));
    },

    addLetter: (ch) => {
      const { room, current, myRows, you } = get();
      if (!room || room.phase !== "playing") return;
      const me = room.players.find((p) => p.id === you);
      if (me?.finished) return;
      if (current.length >= room.length) return;
      if (myRows.length >= room.maxGuesses) return;
      if (!/^[a-zA-Z]$/.test(ch)) return;
      set({ current: current + ch.toLowerCase() });
    },

    removeLetter: () => {
      const { room } = get();
      if (!room || room.phase !== "playing") return;
      set({ current: get().current.slice(0, -1) });
    },

    submit: () => {
      const { room, current, ws } = get();
      if (!room || room.phase !== "playing") return;
      if (current.length !== room.length) {
        flash("Not enough letters");
        return;
      }
      ws?.send(JSON.stringify({ type: "guess", guess: current }));
    },
  };
});
