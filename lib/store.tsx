"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "./supabase";
import { v4 as uuidv4 } from "uuid";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────
interface Participant {
  id: string;
  participant_id: string;
  display_name: string;
  joined_at: string;
  last_seen_at: string;
}

interface Ticket {
  id: string;
  session_id: string;
  title: string;
  description: string;
  status: "pending" | "voting" | "revealed" | "complete";
  final_estimate: string | null;
  display_order: number;
  created_by: string | null;
  jira_key: string | null;
  external_url: string | null;
}

interface Vote {
  id: string;
  ticket_id: string;
  participant_id: string;
  value: string;
}

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
  sessionId: string | null;
  participants: Participant[];
  tickets: Ticket[];
  currentTicketId: string | null;
  votes: Record<string, Vote[]>;
}

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

const JIRA_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const JIRA_CACHE_STORAGE_KEY = "pokerai_jira_cache";

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// ── Jira Cache Helpers ────────────────────────────────────────────────
function loadJiraCacheFromStorage(): Record<string, JiraCacheEntry> {
  try {
    const raw = sessionStorage.getItem(JIRA_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, JiraCacheEntry>;
    const now = Date.now();
    // Prune expired entries
    const valid: Record<string, JiraCacheEntry> = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (now - entry.fetchedAt < JIRA_CACHE_TTL) {
        valid[key] = entry;
      }
    }
    return valid;
  } catch {
    return {};
  }
}

function saveJiraCacheToStorage(cache: Record<string, JiraCacheEntry>) {
  try {
    sessionStorage.setItem(JIRA_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

// ── Provider ──────────────────────────────────────────────────────────
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    roomCode: null,
    roomName: null,
    sessionId: null,
    participants: [],
    tickets: [],
    currentTicketId: null,
    votes: {},
  });

  const [jiraCache, setJiraCache] = useState<Record<string, JiraCacheEntry>>({});

  const pidRef = useRef<string>("");
  const [myParticipantId, setMyParticipantId] = useState("");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize participant ID and load Jira cache from sessionStorage
  useEffect(() => {
    const key = "pokerai_pid";
    let pid = sessionStorage.getItem(key);
    if (!pid) {
      pid = uuidv4();
      sessionStorage.setItem(key, pid);
    }
    pidRef.current = pid;
    setMyParticipantId(pid);

    // Load cached Jira data
    setJiraCache(loadJiraCacheFromStorage());

    setReady(true);
  }, []);

  // Periodic TTL cleanup (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      setJiraCache(prev => {
        const now = Date.now();
        const valid: Record<string, JiraCacheEntry> = {};
        let changed = false;
        for (const [key, entry] of Object.entries(prev)) {
          if (now - entry.fetchedAt < JIRA_CACHE_TTL) {
            valid[key] = entry;
          } else {
            changed = true;
          }
        }
        if (changed) {
          saveJiraCacheToStorage(valid);
          return valid;
        }
        return prev;
      });
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  // ── Jira Cache Operations ─────────────────────────────────────────
  const cacheJiraData = useCallback((data: JiraData) => {
    const entry: JiraCacheEntry = { data, fetchedAt: Date.now() };
    setJiraCache(prev => {
      const updated = { ...prev, [data.key]: entry };
      saveJiraCacheToStorage(updated);
      return updated;
    });
  }, []);

  const fetchJiraData = useCallback(async (jiraKey: string): Promise<JiraData | null> => {
    const key = jiraKey.toUpperCase();

    // Check in-memory cache first
    const cached = jiraCache[key];
    if (cached && Date.now() - cached.fetchedAt < JIRA_CACHE_TTL) {
      return cached.data;
    }

    // Fetch from API
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

  // ── Load full room state from DB ──────────────────────────────────
  const loadRoomState = useCallback(async (sessionId: string) => {
    const [participantsRes, ticketsRes, votesRes] = await Promise.all([
      supabase.from("session_participants").select("*").eq("session_id", sessionId).order("joined_at"),
      supabase.from("tickets").select("*").eq("session_id", sessionId).order("display_order"),
      supabase.from("votes").select("*").eq("session_id", sessionId),
    ]);

    const tickets = ticketsRes.data || [];
    const currentTicket = tickets.find((t: any) => t.status === "voting" || t.status === "revealed");

    const votesByTicket: Record<string, Vote[]> = {};
    for (const v of (votesRes.data || [])) {
      if (!votesByTicket[v.ticket_id]) votesByTicket[v.ticket_id] = [];
      votesByTicket[v.ticket_id].push(v);
    }

    setGameState(prev => ({
      ...prev,
      participants: participantsRes.data || [],
      tickets,
      currentTicketId: currentTicket?.id || null,
      votes: votesByTicket,
    }));
  }, []);

  const subscribeToRoom = useCallback((sessionId: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`room:${sessionId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "session_participants",
        filter: `session_id=eq.${sessionId}`,
      }, () => {
        supabase.from("session_participants")
          .select("*").eq("session_id", sessionId).order("joined_at")
          .then(({ data }: { data: any }) => {
            if (data) setGameState(prev => ({ ...prev, participants: data }));
          });
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "tickets",
        filter: `session_id=eq.${sessionId}`,
      }, () => {
        supabase.from("tickets")
          .select("*").eq("session_id", sessionId).order("display_order")
          .then(({ data }: { data: any }) => {
            if (data) {
              const currentTicket = data.find((t: any) => t.status === "voting" || t.status === "revealed");
              setGameState(prev => ({
                ...prev,
                tickets: data,
                currentTicketId: currentTicket?.id || prev.currentTicketId,
              }));
            }
          });
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "votes",
        filter: `session_id=eq.${sessionId}`,
      }, () => {
        supabase.from("votes")
          .select("*").eq("session_id", sessionId)
          .then(({ data }: { data: any }) => {
            if (data) {
              const votesByTicket: Record<string, Vote[]> = {};
              for (const v of data) {
                if (!votesByTicket[v.ticket_id]) votesByTicket[v.ticket_id] = [];
                votesByTicket[v.ticket_id].push(v);
              }
              setGameState(prev => ({ ...prev, votes: votesByTicket }));
            }
          });
      })
      .subscribe();

    channelRef.current = channel;
  }, []);

  const startHeartbeat = useCallback((sessionId: string) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      const pid = pidRef.current;
      if (!pid) return;
      supabase.from("session_participants")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("participant_id", pid)
        .then(() => {});
    }, 30000);
  }, []);

  const createRoom = useCallback(async (name: string) => {
    const { data: codeData } = await supabase.rpc("generate_room_code");
    const roomCode = codeData as string;

    const { data, error } = await supabase
      .from("sessions")
      .insert({ room_code: roomCode, name: name || "Planning Session" })
      .select()
      .single();

    if (error) throw error;
    return { code: data.room_code, name: data.name };
  }, []);

  const checkRoom = useCallback(async (code: string) => {
    const { data } = await supabase
      .from("sessions")
      .select("id, room_code, name")
      .eq("room_code", code.toUpperCase())
      .single();

    if (data) return { exists: true, name: data.name, code: data.room_code };
    return { exists: false };
  }, []);

  const joinRoom = useCallback(async (roomCode: string, displayName: string) => {
    const pid = pidRef.current;
    if (!pid) return;

    setLoading(true);
    setRoomError(null);

    const { data: session } = await supabase
      .from("sessions")
      .select("*")
      .eq("room_code", roomCode.toUpperCase())
      .single();

    if (!session) {
      setRoomError("Room not found");
      setLoading(false);
      return;
    }

    await supabase
      .from("session_participants")
      .upsert({
        session_id: session.id,
        participant_id: pid,
        display_name: displayName,
        last_seen_at: new Date().toISOString(),
      }, {
        onConflict: "session_id,participant_id",
      });

    setGameState(prev => ({
      ...prev,
      roomCode: session.room_code,
      roomName: session.name,
      sessionId: session.id,
    }));

    await loadRoomState(session.id);
    subscribeToRoom(session.id);
    startHeartbeat(session.id);

    setLoading(false);
  }, [loadRoomState, subscribeToRoom, startHeartbeat]);

  const leaveRoom = useCallback(() => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    setGameState(prev => {
      if (prev.sessionId) {
        supabase.from("session_participants")
          .delete()
          .eq("session_id", prev.sessionId)
          .eq("participant_id", pidRef.current)
          .then(() => {});
      }
      return {
        roomCode: null, roomName: null, sessionId: null,
        participants: [], tickets: [], currentTicketId: null, votes: {},
      };
    });
  }, []);

  // ── Add Ticket — Jira tickets save NO description to DB ───────────
  const addTicket = useCallback(async (options: AddTicketOptions) => {
    const sid = gameState.sessionId;
    const pid = pidRef.current;
    if (!sid || !pid) return;
    const order = gameState.tickets.length;

    const isJira = !!options.jiraKey;

    await supabase.from("tickets").insert({
      session_id: sid,
      title: options.title,
      // Only persist description for manual tickets — Jira descriptions stay in browser cache only
      description: isJira ? "" : options.description,
      display_order: order,
      created_by: pid,
      jira_key: options.jiraKey || null,
      external_url: options.externalUrl || null,
    });
  }, [gameState.sessionId, gameState.tickets.length]);

  const startVoting = useCallback(async (ticketId: string) => {
    const sid = gameState.sessionId;
    if (!sid) return;
    // Optimistic update — instant UI response
    setGameState(prev => ({
      ...prev,
      currentTicketId: ticketId,
      tickets: prev.tickets.map(t =>
        t.id === ticketId ? { ...t, status: "voting" as const } : t
      ),
      votes: { ...prev.votes, [ticketId]: [] },
    }));
    await supabase.from("votes").delete().eq("ticket_id", ticketId);
    await supabase.from("tickets").update({ status: "voting" }).eq("id", ticketId);
    await supabase.from("sessions").update({ current_ticket_id: ticketId }).eq("id", sid);
  }, [gameState.sessionId]);

  const castVote = useCallback(async (ticketId: string, value: string) => {
    const sid = gameState.sessionId;
    const pid = pidRef.current;
    if (!sid || !pid) return;
    // Optimistic update — instant UI response
    setGameState(prev => {
      const existing = (prev.votes[ticketId] || []).filter(v => v.participant_id !== pid);
      return {
        ...prev,
        votes: {
          ...prev.votes,
          [ticketId]: [...existing, { id: "optimistic-" + pid, ticket_id: ticketId, participant_id: pid, value }],
        },
      };
    });
    await supabase.from("votes").upsert({
      ticket_id: ticketId,
      session_id: sid,
      participant_id: pid,
      value,
      submitted_at: new Date().toISOString(),
    }, {
      onConflict: "ticket_id,participant_id",
    });
  }, [gameState.sessionId]);

  const revealVotes = useCallback(async (ticketId: string) => {
    // Optimistic update — instant UI response
    setGameState(prev => ({
      ...prev,
      tickets: prev.tickets.map(t =>
        t.id === ticketId ? { ...t, status: "revealed" as const } : t
      ),
    }));
    await supabase.from("tickets").update({ status: "revealed" }).eq("id", ticketId);
  }, []);

  const lockEstimate = useCallback(async (ticketId: string, finalEstimate: string) => {
    // Optimistic update — instant UI response
    setGameState(prev => ({
      ...prev,
      tickets: prev.tickets.map(t =>
        t.id === ticketId ? { ...t, status: "complete" as const, final_estimate: finalEstimate } : t
      ),
    }));
    await supabase.from("tickets").update({
      status: "complete",
      final_estimate: finalEstimate,
    }).eq("id", ticketId);
  }, []);

  const revote = useCallback(async (ticketId: string) => {
    // Optimistic update — instant UI response
    setGameState(prev => ({
      ...prev,
      tickets: prev.tickets.map(t =>
        t.id === ticketId ? { ...t, status: "voting" as const } : t
      ),
      votes: { ...prev.votes, [ticketId]: [] },
    }));
    await supabase.from("votes").delete().eq("ticket_id", ticketId);
    await supabase.from("tickets").update({ status: "voting" }).eq("id", ticketId);
  }, []);

  return (
    <StoreContext.Provider value={{
      gameState, myParticipantId, ready, loading, roomError, jiraCache,
      createRoom, checkRoom, joinRoom, leaveRoom,
      addTicket, startVoting, castVote, revealVotes, lockEstimate, revote,
      fetchJiraData, cacheJiraData,
    }}>
      {children}
    </StoreContext.Provider>
  );
}
