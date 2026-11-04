"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import ReconnectingWebSocket from "partysocket/ws";
import { useAuth } from "./auth-provider";
import {
  generateRoomCode,
  ROOM_CODE_PATTERN,
  type ClientMessage,
  type Participant,
  type RoomSnapshot,
  type ServerMessage,
  type Ticket,
  type Vote,
} from "@/shared/room-protocol";

// ── Types ─────────────────────────────────────────────────────────────
interface JiraData {
  key: string;
  title: string;
  description: string;
  summary: string | null;
  issueType: string | null;
  status: string | null;
  priority: string | null;
  assignee: string | null;
  labels: string[];
  url: string;
  aiEstimate: string | null;
  aiReasoning: string | null;
}

interface JiraCacheEntry {
  data: JiraData;
  fetchedAt: number;
}

interface GameState {
  roomCode: string | null;
  roomName: string | null;
  // Kept for component compatibility: set to the room code once the room is loaded.
  sessionId: string | null;
  participants: Participant[];
  tickets: Ticket[];
  currentTicketId: string | null;
  votes: Record<string, Vote[]>;
}

export type ConnectionStatus = "idle" | "connecting" | "open" | "reconnecting";

interface AddTicketOptions {
  title: string;
  description: string;
  jiraKey?: string;
  externalUrl?: string;
}

interface StoreContextType {
  gameState: GameState;
  myParticipantId: string;
  ready: boolean;
  loading: boolean;
  connection: ConnectionStatus;
  roomError: string | null;
  jiraCache: Record<string, JiraCacheEntry>;
  createRoom: (name: string) => Promise<{ code: string; name: string }>;
  checkRoom: (code: string) => Promise<{ exists: boolean; name?: string; code?: string }>;
  joinRoom: (roomCode: string, displayName: string) => Promise<void>;
  leaveRoom: () => void;
  addTicket: (options: AddTicketOptions) => Promise<void>;
  startVoting: (ticketId: string) => Promise<void>;
  castVote: (ticketId: string, value: string) => Promise<void>;
  revealVotes: (ticketId: string) => Promise<void>;
  lockEstimate: (ticketId: string, finalEstimate: string) => Promise<void>;
  revote: (ticketId: string) => Promise<void>;
  fetchJiraData: (jiraKey: string) => Promise<JiraData | null>;
  cacheJiraData: (data: JiraData) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

const ROOMS_URL = (process.env.NEXT_PUBLIC_ROOMS_URL || "http://localhost:8787").replace(/\/$/, "");
const ROOMS_WS_URL = ROOMS_URL.replace(/^http/, "ws");

const JIRA_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const JIRA_CACHE_STORAGE_KEY = "pokerai_jira_cache";

// Last-known room snapshot per room, so a reload or dropped connection renders instantly.
const ROOM_CACHE_PREFIX = "pokerai_room_";
const ROOM_CACHE_TTL = 24 * 60 * 60 * 1000; // matches the server's idle expiry
// Rooms this browser created but hasn't joined yet (survives the navigation to /session/:code).
const PENDING_CREATE_PREFIX = "pokerai_create_";

const EMPTY_STATE: GameState = {
  roomCode: null,
  roomName: null,
  sessionId: null,
  participants: [],
  tickets: [],
  currentTicketId: null,
  votes: {},
};

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// ── Storage helpers (all failures are non-fatal) ──────────────────────
function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // full or unavailable — ignore
  }
}

function removeKey(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {}
}

interface CachedRoom {
  snapshot: RoomSnapshot;
  savedAt: number;
}

function loadCachedRoom(code: string): RoomSnapshot | null {
  const cached = readJson<CachedRoom>(localStorage, ROOM_CACHE_PREFIX + code);
  if (!cached || Date.now() - cached.savedAt > ROOM_CACHE_TTL) return null;
  return cached.snapshot;
}

function pruneRoomCache() {
  try {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith(ROOM_CACHE_PREFIX)) continue;
      const cached = readJson<CachedRoom>(localStorage, key);
      if (!cached || now - cached.savedAt > ROOM_CACHE_TTL) localStorage.removeItem(key);
    }
  } catch {}
}

function loadJiraCacheFromStorage(): Record<string, JiraCacheEntry> {
  const parsed = readJson<Record<string, JiraCacheEntry>>(sessionStorage, JIRA_CACHE_STORAGE_KEY) ?? {};
  const now = Date.now();
  const valid: Record<string, JiraCacheEntry> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (now - entry.fetchedAt < JIRA_CACHE_TTL) valid[key] = entry;
  }
  return valid;
}

function toGameState(s: RoomSnapshot): GameState {
  return {
    roomCode: s.roomCode,
    roomName: s.roomName,
    sessionId: s.roomCode,
    participants: s.participants,
    tickets: s.tickets,
    currentTicketId: s.currentTicketId,
    votes: s.votes,
  };
}

// ── Provider ──────────────────────────────────────────────────────────
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { participantId, loading: identityLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<ConnectionStatus>("idle");
  const [roomError, setRoomError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>(EMPTY_STATE);
  const [jiraCache, setJiraCache] = useState<Record<string, JiraCacheEntry>>({});

  const socketRef = useRef<ReconnectingWebSocket | null>(null);
  const roomCodeRef = useRef<string | null>(null);
  const nameRef = useRef<string>("");
  // True once the server has accepted our join on the current connection.
  const joinedRef = useRef(false);
  // Actions issued while (re)connecting; flushed after the join is accepted.
  const outboxRef = useRef<ClientMessage[]>([]);

  const ready = !identityLoading && !!participantId;

  useEffect(() => {
    setJiraCache(loadJiraCacheFromStorage());
    pruneRoomCache();
  }, []);

  // Periodic Jira cache TTL cleanup (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      setJiraCache(prev => {
        const now = Date.now();
        const valid: Record<string, JiraCacheEntry> = {};
        let changed = false;
        for (const [key, entry] of Object.entries(prev)) {
          if (now - entry.fetchedAt < JIRA_CACHE_TTL) valid[key] = entry;
          else changed = true;
        }
        if (!changed) return prev;
        writeJson(sessionStorage, JIRA_CACHE_STORAGE_KEY, valid);
        return valid;
      });
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const closeSocket = useCallback(() => {
    socketRef.current?.close(1000, "client closed");
    socketRef.current = null;
    joinedRef.current = false;
    outboxRef.current = [];
  }, []);

  useEffect(() => closeSocket, [closeSocket]);

  // Retry right away when the network returns or the tab comes back, instead of
  // waiting out the backoff (laptops waking from sleep, flaky office Wi-Fi).
  useEffect(() => {
    const kick = () => {
      const ws = socketRef.current;
      if (!ws || document.visibilityState === "hidden") return;
      if (ws.readyState === ReconnectingWebSocket.CLOSED || ws.readyState === ReconnectingWebSocket.CLOSING) ws.reconnect();
    };
    window.addEventListener("online", kick);
    document.addEventListener("visibilitychange", kick);
    return () => {
      window.removeEventListener("online", kick);
      document.removeEventListener("visibilitychange", kick);
    };
  }, []);

  // ── Jira cache ──────────────────────────────────────────────────────
  const cacheJiraData = useCallback((data: JiraData) => {
    const entry: JiraCacheEntry = { data, fetchedAt: Date.now() };
    setJiraCache(prev => {
      const updated = { ...prev, [data.key]: entry };
      writeJson(sessionStorage, JIRA_CACHE_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const fetchJiraData = useCallback(async (jiraKey: string): Promise<JiraData | null> => {
    const key = jiraKey.toUpperCase();
    const cached = jiraCache[key];
    if (cached && Date.now() - cached.fetchedAt < JIRA_CACHE_TTL) return cached.data;
    try {
      const res = await fetch("/api/jira/" + encodeURIComponent(key));
      if (!res.ok) return null;
      const data: JiraData = await res.json();
      cacheJiraData(data);
      return data;
    } catch {
      return null;
    }
  }, [jiraCache, cacheJiraData]);

  // ── Messaging ───────────────────────────────────────────────────────
  const send = useCallback((msg: ClientMessage) => {
    const ws = socketRef.current;
    if (ws && joinedRef.current && ws.readyState === ReconnectingWebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      outboxRef.current.push(msg);
    }
  }, []);

  const sendJoin = useCallback(() => {
    const ws = socketRef.current;
    const code = roomCodeRef.current;
    if (!ws || !code) return;
    const pendingName = readJson<string>(sessionStorage, PENDING_CREATE_PREFIX + code);
    const join: ClientMessage = {
      t: "join",
      pid: participantId,
      name: nameRef.current,
      ...(pendingName !== null ? { create: { roomName: pendingName } } : {}),
    };
    ws.send(JSON.stringify(join));
  }, [participantId]);

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    const code = roomCodeRef.current;
    if (!code) return;

    if (msg.t === "state") {
      if (!joinedRef.current) {
        joinedRef.current = true;
        removeKey(sessionStorage, PENDING_CREATE_PREFIX + code);
        const queued = outboxRef.current;
        outboxRef.current = [];
        for (const m of queued) socketRef.current?.send(JSON.stringify(m));
      }
      setGameState(toGameState(msg.state));
      writeJson(localStorage, ROOM_CACHE_PREFIX + code, { snapshot: msg.state, savedAt: Date.now() } satisfies CachedRoom);
      setLoading(false);
      return;
    }

    if (msg.code === "not_found" || msg.code === "room_full") {
      removeKey(localStorage, ROOM_CACHE_PREFIX + code);
      setRoomError(msg.code === "room_full" ? "This room is full" : "Room not found");
      setGameState(EMPTY_STATE);
      setLoading(false);
      closeSocket();
      setConnection("idle");
    } else if (msg.code === "not_joined") {
      // Server lost track of us (e.g. we were removed); re-announce.
      joinedRef.current = false;
      sendJoin();
    } else {
      console.warn("[rooms]", msg.message);
    }
  }, [closeSocket, sendJoin]);

  // ── Room lifecycle ──────────────────────────────────────────────────
  const createRoom = useCallback(async (name: string) => {
    const code = generateRoomCode();
    const roomName = name || "Planning Session";
    writeJson(sessionStorage, PENDING_CREATE_PREFIX + code, roomName);
    return { code, name: roomName };
  }, []);

  const checkRoom = useCallback(async (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!ROOM_CODE_PATTERN.test(code)) return { exists: false };
    const res = await fetch(`${ROOMS_URL}/rooms/${encodeURIComponent(code)}/exists`);
    if (!res.ok) throw new Error(`Room lookup failed (${res.status})`);
    return (await res.json()) as { exists: boolean; name?: string; code?: string };
  }, []);

  const joinRoom = useCallback(async (raw: string, displayName: string) => {
    if (!participantId) return;
    const code = raw.toUpperCase();
    setRoomError(null);

    if (!ROOM_CODE_PATTERN.test(code)) {
      setRoomError("Room not found");
      return;
    }

    closeSocket();
    roomCodeRef.current = code;
    nameRef.current = displayName;

    // Render the last-known state immediately; the server snapshot replaces it on connect.
    const cached = loadCachedRoom(code);
    if (cached) {
      setGameState(toGameState(cached));
    } else {
      setGameState(EMPTY_STATE);
      setLoading(true);
    }

    setConnection("connecting");
    const ws = new ReconnectingWebSocket(`${ROOMS_WS_URL}/rooms/${encodeURIComponent(code)}`, [], {
      maxReconnectionDelay: 10_000,
      minReconnectionDelay: 500,
      // 4004/4009 = room missing / full. Our own close() already stops reconnects.
      shouldReconnectOnClose: e => ![4004, 4009].includes(e.code),
    });
    socketRef.current = ws;

    ws.addEventListener("open", () => {
      setConnection("open");
      joinedRef.current = false;
      sendJoin();
    });
    ws.addEventListener("close", () => {
      joinedRef.current = false;
      if (socketRef.current === ws) setConnection("reconnecting");
    });
    ws.addEventListener("message", (ev: MessageEvent) => {
      try {
        handleServerMessage(JSON.parse(ev.data as string) as ServerMessage);
      } catch {
        // ignore malformed frames
      }
    });
  }, [participantId, closeSocket, sendJoin, handleServerMessage]);

  const leaveRoom = useCallback(() => {
    const code = roomCodeRef.current;
    const ws = socketRef.current;
    if (ws && joinedRef.current && ws.readyState === ReconnectingWebSocket.OPEN) {
      ws.send(JSON.stringify({ t: "leave" } satisfies ClientMessage));
    }
    closeSocket();
    if (code) removeKey(localStorage, ROOM_CACHE_PREFIX + code);
    roomCodeRef.current = null;
    setConnection("idle");
    setGameState(EMPTY_STATE);
  }, [closeSocket]);

  // ── Actions (optimistic locally, authoritative on the server) ───────
  const addTicket = useCallback(async (options: AddTicketOptions) => {
    send({
      t: "addTicket",
      title: options.title,
      // Jira descriptions stay in this browser's cache; only manual descriptions are shared.
      description: options.jiraKey ? "" : options.description,
      jiraKey: options.jiraKey,
      externalUrl: options.externalUrl,
    });
  }, [send]);

  const startVoting = useCallback(async (ticketId: string) => {
    setGameState(prev => ({
      ...prev,
      currentTicketId: ticketId,
      tickets: prev.tickets.map(t => (t.id === ticketId ? { ...t, status: "voting" as const } : t)),
      votes: { ...prev.votes, [ticketId]: [] },
    }));
    send({ t: "startVoting", ticketId });
  }, [send]);

  const castVote = useCallback(async (ticketId: string, value: string) => {
    const pid = participantId;
    setGameState(prev => {
      const others = (prev.votes[ticketId] || []).filter(v => v.participant_id !== pid);
      return {
        ...prev,
        votes: {
          ...prev.votes,
          [ticketId]: [...others, { id: `${ticketId}:${pid}`, ticket_id: ticketId, participant_id: pid, value }],
        },
      };
    });
    send({ t: "vote", ticketId, value });
  }, [participantId, send]);

  const revealVotes = useCallback(async (ticketId: string) => {
    // No optimistic flip: other people's values only arrive with the server's reveal.
    send({ t: "reveal", ticketId });
  }, [send]);

  const lockEstimate = useCallback(async (ticketId: string, finalEstimate: string) => {
    setGameState(prev => ({
      ...prev,
      tickets: prev.tickets.map(t =>
        t.id === ticketId ? { ...t, status: "complete" as const, final_estimate: finalEstimate } : t
      ),
    }));
    send({ t: "lock", ticketId, estimate: finalEstimate });
  }, [send]);

  const revote = useCallback(async (ticketId: string) => {
    setGameState(prev => ({
      ...prev,
      tickets: prev.tickets.map(t => (t.id === ticketId ? { ...t, status: "voting" as const } : t)),
      votes: { ...prev.votes, [ticketId]: [] },
    }));
    send({ t: "revote", ticketId });
  }, [send]);

  return (
    <StoreContext.Provider value={{
      gameState, myParticipantId: participantId, ready, loading, connection, roomError, jiraCache,
      createRoom, checkRoom, joinRoom, leaveRoom,
      addTicket, startVoting, castVote, revealVotes, lockEstimate, revote,
      fetchJiraData, cacheJiraData,
    }}>
      {children}
    </StoreContext.Provider>
  );
}
