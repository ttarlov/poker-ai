"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import ParticipantList from "@/components/ParticipantList";
import TicketQueue from "@/components/TicketQueue";
import TicketForm from "@/components/TicketForm";
import VotingStage from "@/components/VotingStage";
import VotingCards from "@/components/VotingCards";
import SessionSummary from "@/components/SessionSummary";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import UserMenu from "@/components/UserMenu";

export default function SessionRoom() {
  const router = useRouter();
  const params = useParams();
  const roomCode = (params.room_code as string)?.toUpperCase();
  const { gameState, joinRoom, roomError, loading, ready } = useStore();
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [autoJoining, setAutoJoining] = useState(true);
  const attemptedRef = useRef(false);

  // Auto-rejoin on refresh OR show name prompt
  useEffect(() => {
    if (!ready || attemptedRef.current) return;
    attemptedRef.current = true;

    const sessionData = sessionStorage.getItem("pokerai_session_" + roomCode);
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        if (parsed.displayName) {
          joinRoom(roomCode, parsed.displayName)
            .then(() => {
              setJoined(true);
              setAutoJoining(false);
            })
            .catch(() => {
              setAutoJoining(false);
            });
          return;
        }
      } catch (e) {
        // ignore parse errors
      }
    }

    // No session data - show the prompt
    setAutoJoining(false);
    const cookies = document.cookie.split("; ");
    const nameCookie = cookies.find(function(c) { return c.startsWith("pokerai_name="); });
    if (nameCookie) setNameInput(decodeURIComponent(nameCookie.split("=")[1]));
  }, [ready, roomCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    const name = nameInput.trim();
    document.cookie = "pokerai_name=" + encodeURIComponent(name) + "; path=/; max-age=86400";
    sessionStorage.setItem("pokerai_session_" + roomCode, JSON.stringify({ displayName: name }));
    await joinRoom(roomCode, name);
    setJoined(true);
  };

  const handleSignOut = () => {
    document.cookie = "pokerai_name=; path=/; max-age=0";
    sessionStorage.removeItem("pokerai_session_" + roomCode);
    router.push("/");
  };

  const copyRoomLink = () => {
    const url = window.location.origin + "/session/" + roomCode;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayName = (() => {
    if (typeof document === "undefined") return "";
    // Check per-tab session storage FIRST
    try {
      const sd = sessionStorage.getItem("pokerai_session_" + roomCode);
      if (sd) {
        const parsed = JSON.parse(sd);
        if (parsed.displayName) return parsed.displayName;
      }
    } catch (e) {}
    // Fall back to cookie
    const cookies = document.cookie.split("; ");
    const nameCookie = cookies.find(function(c) { return c.startsWith("pokerai_name="); });
    if (nameCookie) return decodeURIComponent(nameCookie.split("=")[1]);
    return "";
  })();

  // Room error
  if (roomError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="font-display text-2xl mb-2" style={{ color: "var(--text-primary)" }}>Room Not Found</h1>
          <p className="mb-6" style={{ color: "var(--text-muted)" }}>
            The room <span className="font-mono" style={{ color: "var(--accent)" }}>{roomCode}</span> does not exist or has expired.
          </p>
          <button onClick={() => router.push("/")}
            className="px-6 py-3 font-bold rounded-xl transition-all"
            style={{ background: "linear-gradient(to right, var(--btn-primary-from), var(--btn-primary-to))", color: "var(--btn-primary-text)" }}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Auto-rejoining after refresh
  if (autoJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse-soft">🃏</div>
          <p style={{ color: "var(--text-muted)" }}>Reconnecting to {roomCode}...</p>
        </div>
      </div>
    );
  }

  // Join Prompt (fresh tab only)
  if (!joined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl mb-2" style={{ color: "var(--card-face)" }}>
              Poker<span style={{ color: "var(--accent)" }}>AI</span>
            </h1>
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Joining Room</span>
              <span className="font-mono text-sm px-2 py-0.5 rounded"
                    style={{ background: "var(--input-bg)", color: "var(--accent)", border: "1px solid var(--border-subtle)" }}>
                {roomCode}
              </span>
            </div>
          </div>
          <form onSubmit={handleJoinRoom} className="space-y-5">
            <div>
              <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Your Display Name</label>
              <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
                placeholder="Enter your name" maxLength={24} autoFocus
                className="w-full px-4 py-3 rounded-xl text-lg transition-all focus:outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                onFocus={e => { e.target.style.borderColor = "var(--input-focus-border)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--input-border)"; }} />
            </div>
            <button type="submit" disabled={!nameInput.trim() || loading}
              className="w-full py-4 font-bold text-lg rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              style={{ background: "linear-gradient(to right, var(--btn-primary-from), var(--btn-primary-to))", color: "var(--btn-primary-text)" }}>
              {loading ? "Joining..." : "Join the Table"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Loading
  if (!gameState.sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse-soft">🃏</div>
          <p style={{ color: "var(--text-muted)" }}>Loading room...</p>
        </div>
      </div>
    );
  }

  const currentTicket = gameState.tickets.find(t => t.id === gameState.currentTicketId);
  const completedCount = gameState.tickets.filter(t => t.status === "complete").length;
  const allComplete = gameState.tickets.length > 0 && completedCount === gameState.tickets.length;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="backdrop-blur-sm"
              style={{ borderBottom: "1px solid var(--header-border)", background: "var(--header-bg)" }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl cursor-pointer" style={{ color: "var(--card-face)" }}
                onClick={() => router.push("/")}>
              Poker<span style={{ color: "var(--accent)" }}>AI</span>
            </h1>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded font-mono"
                    style={{ background: "var(--input-bg)", color: "var(--accent)", border: "1px solid var(--border-subtle)" }}>
                {roomCode}
              </span>
              <button onClick={copyRoomLink} className="text-xs px-2 py-0.5 rounded transition-all"
                style={{ color: copied ? "var(--status-active)" : "var(--text-muted)", border: "1px solid " + (copied ? "var(--status-active)" : "var(--border-subtle)") }}>
                {copied ? "✓ Copied" : "Copy Link"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {gameState.roomName && (
              <span className="hidden md:block text-sm" style={{ color: "var(--text-secondary)" }}>{gameState.roomName}</span>
            )}
            {gameState.tickets.length > 0 && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <span className="font-mono" style={{ color: "var(--accent)" }}>{completedCount}/{gameState.tickets.length}</span>
                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--input-bg)" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                       style={{ width: (completedCount / gameState.tickets.length) * 100 + "%", background: "linear-gradient(to right, var(--accent-dark), var(--accent))" }} />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <ParticipantList participants={gameState.participants} />
            <UserMenu displayName={displayName} onSignOut={handleSignOut} />
          </div>
        </div>
      </header>

      <div className="sm:hidden flex items-center justify-center gap-2 py-2"
           style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--border-subtle)" }}>
        <span className="font-mono text-sm" style={{ color: "var(--accent)" }}>{roomCode}</span>
        <button onClick={copyRoomLink} className="text-xs px-2 py-0.5 rounded transition-all"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
          {copied ? "✓" : "Copy Link"}
        </button>
      </div>

      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 py-6">
        {showSummary ? (
          <SessionSummary tickets={gameState.tickets} onClose={() => setShowSummary(false)} />
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-6">
              <TicketQueue tickets={gameState.tickets} currentTicketId={gameState.currentTicketId} />
              <div className="flex gap-2 shrink-0">
                {allComplete && (
                  <button onClick={() => setShowSummary(true)}
                    className="px-4 py-2 text-sm rounded-lg transition-all"
                    style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" }}>
                    View Summary
                  </button>
                )}
                <button onClick={() => setShowTicketForm(true)}
                  className="px-4 py-2 text-sm rounded-lg transition-all"
                  style={{ background: "var(--btn-secondary-bg)", color: "var(--btn-secondary-text)", border: "1px solid var(--btn-secondary-border)" }}>
                  + Add Ticket
                </button>
              </div>
            </div>
            {showTicketForm && <TicketForm onClose={() => setShowTicketForm(false)} />}
            <VotingStage />
            {gameState.tickets.length === 0 && !showTicketForm && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                <div className="text-6xl mb-6 opacity-30">🃏</div>
                <h2 className="font-display text-2xl mb-2" style={{ color: "color-mix(in srgb, var(--text-primary) 60%, transparent)" }}>Room is ready</h2>
                <p className="mb-2 max-w-sm" style={{ color: "var(--text-muted)" }}>Share this link with your team:</p>
                <button onClick={copyRoomLink} className="font-mono text-sm px-4 py-2 rounded-lg mb-6 transition-all"
                  style={{ background: "var(--input-bg)", color: "var(--accent)", border: "1px solid var(--border-medium)" }}>
                  {copied ? "✓ Link copied!" : (typeof window !== "undefined" ? window.location.origin : "") + "/session/" + roomCode}
                </button>
                <button onClick={() => setShowTicketForm(true)}
                  className="px-6 py-3 rounded-xl font-medium transition-all"
                  style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" }}>
                  Add First Ticket
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {currentTicket && currentTicket.status === "voting" && !showSummary && (
        <VotingCards ticketId={currentTicket.id} />
      )}
    </div>
  );
}
