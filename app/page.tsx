"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function Home() {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"home" | "create" | "join">("home");
  const [sessionName, setSessionName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { createRoom, checkRoom } = useStore();

  useEffect(() => {
    const saved = document.cookie
      .split("; ")
      .find(c => c.startsWith("pokerai_name="))
      ?.split("=")[1];
    if (saved) setName(decodeURIComponent(saved));
  }, []);

  const saveName = () => {
    document.cookie = `pokerai_name=${encodeURIComponent(name.trim())}; path=/; max-age=86400`;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Enter your display name"); return; }
    setError("");
    setLoading(true);
    saveName();
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
    if (!name.trim()) { setError("Enter your display name"); return; }
    if (!joinCode.trim()) { setError("Enter a room code"); return; }
    setError("");
    setLoading(true);
    saveName();
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

        {/* Name input */}
        <div className="mb-6">
          <label className="block text-xs mb-1.5 uppercase tracking-wider"
                 style={{ color: "var(--text-muted)" }}>Display Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Your name" maxLength={24} autoFocus
            className="w-full px-4 py-3 rounded-full text-lg transition-all focus:outline-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
            onFocus={e => e.target.style.borderColor = "var(--input-focus-border)"}
            onBlur={e => e.target.style.borderColor = "var(--input-border)"} />
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
                placeholder="e.g. Sprint 43 Planning" maxLength={60}
                className="w-full px-4 py-3 rounded-full transition-all focus:outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                onFocus={e => e.target.style.borderColor = "var(--input-focus-border)"}
                onBlur={e => e.target.style.borderColor = "var(--input-border)"} />
            </div>
            {error && <p className="text-sm" style={{ color: "var(--red-suit)" }}>{error}</p>}
            <button type="submit" disabled={!name.trim() || loading}
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
                placeholder="ABC-123" maxLength={7}
                className="w-full px-4 py-3 rounded-full text-center text-2xl font-mono tracking-widest transition-all focus:outline-none uppercase"
                style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--accent)" }}
                onFocus={e => e.target.style.borderColor = "var(--input-focus-border)"}
                onBlur={e => e.target.style.borderColor = "var(--input-border)"} />
            </div>
            {error && <p className="text-sm" style={{ color: "var(--red-suit)" }}>{error}</p>}
            <button type="submit" disabled={!name.trim() || joinCode.length < 7 || loading}
              className="w-full py-4 font-bold text-lg rounded-full hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              style={{ background: `linear-gradient(to right, var(--btn-primary-from), var(--btn-primary-to))`, color: "var(--btn-primary-text)" }}>
              {loading ? "Joining..." : "Join Room"}
            </button>
            <button type="button" onClick={() => { setMode("home"); setError(""); }}
              className="w-full py-2 text-sm transition-all" style={{ color: "var(--text-secondary)" }}>← Back</button>
          </form>
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
