"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-provider";
import ParticipantList from "@/components/ParticipantList";
import TicketQueue from "@/components/TicketQueue";
import TicketForm from "@/components/TicketForm";
import VotingStage from "@/components/VotingStage";
import VotingCards from "@/components/VotingCards";
import SessionSummary from "@/components/SessionSummary";
import PointsSummary from "@/components/PointsSummary";
import UserMenu from "@/components/UserMenu";

export default function SessionRoom() {
  const router = useRouter();
  const params = useParams();
  const roomCode = (params.room_code as string)?.toUpperCase();
  const { gameState, joinRoom, startVoting, roomError, loading, ready } = useStore();
  const { user, loading: authLoading, signOut } = useAuth();
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const attemptedRef = useRef(false);

  const displayName = user?.user_metadata?.full_name || user?.email || "Player";

  // Auto-join on mount with auth user's display name
  useEffect(() => {
    if (!ready || authLoading || !user || attemptedRef.current) return;
    attemptedRef.current = true;

    joinRoom(roomCode, displayName);
  }, [ready, authLoading, user, roomCode, displayName]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = async () => {
    await signOut();
  };

  const copyRoomLink = () => {
    const url = window.location.origin + "/session/" + roomCode;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            className="px-6 py-3 font-bold rounded-full transition-all"
            style={{ background: "linear-gradient(to right, var(--btn-primary-from), var(--btn-primary-to))", color: "var(--btn-primary-text)" }}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Loading / connecting
  if (authLoading || !ready || !gameState.sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse-soft">🃏</div>
          <p style={{ color: "var(--text-muted)" }}>
            {authLoading ? "Authenticating..." : "Joining room..."}
          </p>
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
            <h1 className="font-display text-xl cursor-pointer" style={{ color: "var(--text-primary)" }}
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
            <div className="flex items-start justify-between gap-4 mb-4">
              <TicketQueue
                tickets={gameState.tickets}
                currentTicketId={gameState.currentTicketId}
                onTicketClick={startVoting}
              />
              <div className="flex gap-2 shrink-0">
                {allComplete && (
                  <button onClick={() => setShowSummary(true)}
                    className="px-4 py-2 text-sm rounded-full transition-all"
                    style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" }}>
                    View Summary
                  </button>
                )}
                <button onClick={() => setShowTicketForm(true)}
                  className="px-4 py-2 text-sm rounded-full transition-all"
                  style={{ background: "var(--btn-secondary-bg)", color: "var(--btn-secondary-text)", border: "1px solid var(--btn-secondary-border)" }}>
                  + Add Ticket
                </button>
              </div>
            </div>
            <div className="mb-6">
              <PointsSummary />
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
                  className="px-6 py-3 rounded-full font-medium transition-all"
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
