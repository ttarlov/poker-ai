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
}

interface Vote {
  id: string;
  ticket_id: string;
  participant_id: string;
  value: string;
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

interface StoreContextType {
  gameState: GameState;
  myParticipantId: string;
  ready: boolean;
  loading: boolean;
  roomError: string | null;
  createRoom: (name: string) => Promise<{ code: string; name: string }>;
  checkRoom: (code: string) => Promise<{ exists: boolean; name?: string; code?: string }>;
  joinRoom: (roomCode: string, displayName: string) => Promise<void>;
  leaveRoom: () => void;
  addTicket: (title: string, description: string) => Promise<void>;
  startVoting: (ticketId: string) => Promise<void>;
  castVote: (ticketId: string, value: string) => Promise<void>;
  revealVotes: (ticketId: string) => Promise<void>;
  lockEstimate: (ticketId: string, finalEstimate: string) => Promise<void>;
  revote: (ticketId: string) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
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

  // Stable participant ID — generated once on mount, stored in ref
  const pidRef = useRef<string>("");
  const [myParticipantId, setMyParticipantId] = useState("");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize participant ID on client mount
  useEffect(() => {
    const key = "pokerai_pid";
    let pid = sessionStorage.getItem(key);
    if (!pid) {
      pid = uuidv4();
      sessionStorage.setItem(key, pid);
    }
    pidRef.current = pid;
    setMyParticipantId(pid);
    setReady(true);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  // ── Load full room state from DB ──────────────────────────────────
  const loadRoomState = useCallback(async (sessionId: string) => {
    const [participantsRes, ticketsRes, votesRes] = await Promise.all([
      supabase.from("session_participants").select("*").eq("session_id", sessionId).order("joined_at"),
      supabase.from("tickets").select("*").eq("session_id", sessionId).order("display_order"),
      supabase.from("votes").select("*").eq("session_id", sessionId),
    ]);

    const tickets = ticketsRes.data || [];
    const currentTicket = tickets.find(t => t.status === "voting" || t.status === "revealed");

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

  // ── Subscribe to Realtime changes ─────────────────────────────────
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
          .then(({ data }) => {
            if (data) setGameState(prev => ({ ...prev, participants: data }));
          });
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "tickets",
        filter: `session_id=eq.${sessionId}`,
      }, () => {
        supabase.from("tickets")
          .select("*").eq("session_id", sessionId).order("display_order")
          .then(({ data }) => {
            if (data) {
              const currentTicket = data.find(t => t.status === "voting" || t.status === "revealed");
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
          .then(({ data }) => {
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

  // ── Heartbeat ─────────────────────────────────────────────────────
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

  // ── Create Room ───────────────────────────────────────────────────
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

  // ── Check Room ────────────────────────────────────────────────────
  const checkRoom = useCallback(async (code: string) => {
    const { data } = await supabase
      .from("sessions")
      .select("id, room_code, name")
      .eq("room_code", code.toUpperCase())
      .single();

    if (data) return { exists: true, name: data.name, code: data.room_code };
    return { exists: false };
  }, []);

  // ── Join Room ─────────────────────────────────────────────────────
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

  // ── Leave Room ────────────────────────────────────────────────────
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

  // ── Add Ticket ────────────────────────────────────────────────────
  const addTicket = useCallback(async (title: string, description: string) => {
    const sid = gameState.sessionId;
    if (!sid) return;
    const order = gameState.tickets.length;
    await supabase.from("tickets").insert({
      session_id: sid,
      title,
      description,
      display_order: order,
    });
  }, [gameState.sessionId, gameState.tickets.length]);

  // ── Start Voting ──────────────────────────────────────────────────
  const startVoting = useCallback(async (ticketId: string) => {
    const sid = gameState.sessionId;
    if (!sid) return;
    await supabase.from("votes").delete().eq("ticket_id", ticketId);
    await supabase.from("tickets").update({ status: "voting" }).eq("id", ticketId);
    await supabase.from("sessions").update({ current_ticket_id: ticketId }).eq("id", sid);
  }, [gameState.sessionId]);

  // ── Cast Vote ─────────────────────────────────────────────────────
  const castVote = useCallback(async (ticketId: string, value: string) => {
    const sid = gameState.sessionId;
    const pid = pidRef.current;
    if (!sid || !pid) return;
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

  // ── Reveal Votes ──────────────────────────────────────────────────
  const revealVotes = useCallback(async (ticketId: string) => {
    await supabase.from("tickets").update({ status: "revealed" }).eq("id", ticketId);
  }, []);

  // ── Lock Estimate ─────────────────────────────────────────────────
  const lockEstimate = useCallback(async (ticketId: string, finalEstimate: string) => {
    await supabase.from("tickets").update({
      status: "complete",
      final_estimate: finalEstimate,
    }).eq("id", ticketId);
  }, []);

  // ── Re-vote ───────────────────────────────────────────────────────
  const revote = useCallback(async (ticketId: string) => {
    await supabase.from("votes").delete().eq("ticket_id", ticketId);
    await supabase.from("tickets").update({ status: "voting" }).eq("id", ticketId);
  }, []);

  return (
    <StoreContext.Provider value={{
      gameState, myParticipantId, ready, loading, roomError,
      createRoom, checkRoom, joinRoom, leaveRoom,
      addTicket, startVoting, castVote, revealVotes, lockEstimate, revote,
    }}>
      {children}
    </StoreContext.Provider>
  );
}
