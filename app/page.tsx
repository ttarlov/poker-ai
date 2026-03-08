"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-provider";

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-3xl animate-pulse-soft">🃏</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const [mode, setMode] = useState<"home" | "create" | "join">("home");
  const [sessionName, setSessionName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { createRoom, checkRoom } = useStore();
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();

  const redirectTo = searchParams.get("redirect");

  const handleSignIn = () => {
    signInWithGoogle(redirectTo || undefined);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const room = await createRoom(sessionName.trim() || "Planning Session");
      router.push(`/session/${room.code}`);
    } catch {
      setError("Failed to create room");
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) { setError("Enter a room code"); return; }
    setError("");
    setLoading(true);
    try {
      const result = await checkRoom(joinCode.trim());
      if (result.exists) {
        router.push(`/session/${result.code}`);
      } else {
        setError("Room not found — check the code and try again");
        setLoading(false);
      }
    } catch {
      setError("Failed to check room");
      setLoading(false);
    }
  };

  const formatCode = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length > 3) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
    return clean;
  };

  const displayName = user?.user_metadata?.full_name || user?.email || "Player";
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="flex gap-1.5">
              <span className="text-3xl">♠</span>
              <span className="text-3xl" style={{ color: "var(--red-suit)" }}>♥</span>
              <span className="text-3xl">♣</span>
              <span className="text-3xl" style={{ color: "var(--red-suit)" }}>♦</span>
            </div>
          </div>
          <h1 className="font-display text-5xl tracking-tight mb-2"
              style={{ color: "var(--text-primary)" }}>
            Poker<span style={{ color: "var(--accent)" }}>AI</span>
          </h1>
          <p className="text-sm tracking-widest uppercase"
             style={{ color: "var(--text-secondary)" }}>
            Pointing Poker for Dev Teams
          </p>
        </div>

        {/* Auth loading state */}
        {authLoading && (
          <div className="text-center py-8">
            <div className="text-3xl mb-3 animate-pulse-soft">🃏</div>
            <p style={{ color: "var(--text-muted)" }}>Loading...</p>
          </div>
        )}

        {/* Unauthenticated: Sign in with Google */}
        {!authLoading && !user && (
          <div className="space-y-4 animate-fade-in">
            <button onClick={handleSignIn}
              className="w-full py-4 font-bold text-lg rounded-full hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-3"
              style={{ background: "var(--btn-secondary-bg)", color: "var(--btn-secondary-text)", border: "1px solid var(--btn-secondary-border)" }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>
            {redirectTo && (
              <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
                Sign in to join the session
              </p>
            )}
          </div>
        )}

        {/* Authenticated: User info + Room actions */}
        {!authLoading && user && (
          <>
            {/* User identity bar */}
            <div className="flex items-center justify-center gap-3 mb-8 py-3 px-4 rounded-full"
                 style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)" }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                     style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{displayName}</span>
              <button onClick={() => signOut()}
                className="text-xs ml-auto transition-all hover:opacity-70"
                style={{ color: "var(--text-muted)" }}>
                Sign out
              </button>
            </div>

            {mode === "home" && (
              <div className="space-y-3 animate-fade-in">
                <button onClick={() => setMode("create")}
                  className="w-full py-4 font-bold text-lg rounded-full hover:shadow-lg transition-all duration-200"
                  style={{ background: `linear-gradient(to right, var(--btn-primary-from), var(--btn-primary-to))`, color: "var(--btn-primary-text)" }}>
                  Create a Room
                </button>
                <button onClick={() => setMode("join")}
                  className="w-full py-4 font-bold text-lg rounded-full transition-all duration-200"
                  style={{ background: "var(--btn-secondary-bg)", color: "var(--btn-secondary-text)", border: "1px solid var(--btn-secondary-border)" }}>
                  Join with Code
                </button>
              </div>
            )}

            {mode === "create" && (
              <form onSubmit={handleCreate} className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Session Name <span style={{ opacity: 0.5 }}>(optional)</span>
                  </label>
                  <input type="text" value={sessionName} onChange={e => setSessionName(e.target.value)}
                    placeholder="e.g. Sprint 43 Planning" maxLength={60} autoFocus
                    className="w-full px-4 py-3 rounded-full transition-all focus:outline-none"
                    style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                    onFocus={e => e.target.style.borderColor = "var(--input-focus-border)"}
                    onBlur={e => e.target.style.borderColor = "var(--input-border)"} />
                </div>
                {error && <p className="text-sm" style={{ color: "var(--red-suit)" }}>{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-4 font-bold text-lg rounded-full hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                  style={{ background: `linear-gradient(to right, var(--btn-primary-from), var(--btn-primary-to))`, color: "var(--btn-primary-text)" }}>
                  {loading ? "Creating..." : "Create & Join"}
                </button>
                <button type="button" onClick={() => { setMode("home"); setError(""); }}
                  className="w-full py-2 text-sm transition-all" style={{ color: "var(--text-secondary)" }}>← Back</button>
              </form>
            )}

            {mode === "join" && (
              <form onSubmit={handleJoin} className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Room Code</label>
                  <input type="text" value={joinCode} onChange={e => setJoinCode(formatCode(e.target.value))}
                    placeholder="ABC-123" maxLength={7} autoFocus
                    className="w-full px-4 py-3 rounded-full text-center text-2xl font-mono tracking-widest transition-all focus:outline-none uppercase"
                    style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--accent)" }}
                    onFocus={e => e.target.style.borderColor = "var(--input-focus-border)"}
                    onBlur={e => e.target.style.borderColor = "var(--input-border)"} />
                </div>
                {error && <p className="text-sm" style={{ color: "var(--red-suit)" }}>{error}</p>}
                <button type="submit" disabled={joinCode.length < 7 || loading}
                  className="w-full py-4 font-bold text-lg rounded-full hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                  style={{ background: `linear-gradient(to right, var(--btn-primary-from), var(--btn-primary-to))`, color: "var(--btn-primary-text)" }}>
                  {loading ? "Joining..." : "Join Room"}
                </button>
                <button type="button" onClick={() => { setMode("home"); setError(""); }}
                  className="w-full py-2 text-sm transition-all" style={{ color: "var(--text-secondary)" }}>← Back</button>
              </form>
            )}
          </>
        )}

        <div className="text-center mt-10">
          <span className="inline-block px-3 py-1 text-[10px] tracking-widest uppercase rounded-full"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
            V1 — Supabase
          </span>
        </div>
      </div>
    </div>
  );
}
