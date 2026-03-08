"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/theme-provider";
import themes, { themeKeys } from "@/lib/themes";

interface Props {
  displayName: string;
  isGuest?: boolean;
  onSignOut: () => void;
  onSignIn?: () => void;
}

export default function UserMenu({ displayName, isGuest = false, onSignOut, onSignIn }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { themeKey, setTheme } = useTheme();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!displayName) return null;

  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-full text-xs transition-all hover:opacity-80"
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-primary)",
        }}
      >
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
             style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}>
          {initial}
        </div>
        <span className="hidden sm:inline max-w-[80px] truncate">{displayName}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
             fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-sm shadow-2xl z-50
                        overflow-hidden animate-slide-up"
             style={{
               background: "var(--bg-light)",
               border: "1px solid var(--border-medium)",
             }}>
          {/* User info */}
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {displayName}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {isGuest ? "Guest" : "Signed in"}
            </div>
          </div>

          {/* Theme switcher */}
          <div className="px-3 pt-2.5 pb-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                 style={{ color: "var(--text-muted)" }}>
              Theme
            </div>
            <div className="space-y-0.5">
              {themeKeys.map(key => {
                const t = themes[key];
                const active = key === themeKey;
                return (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-left text-xs transition-all"
                    style={{
                      background: active ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent",
                      color: active ? "var(--accent)" : "var(--text-primary)",
                    }}
                    onMouseEnter={e => {
                      if (!active) e.currentTarget.style.background = "var(--input-bg)";
                    }}
                    onMouseLeave={e => {
                      if (!active) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span className="text-sm">{t.emoji}</span>
                    <span className="flex-1 font-medium">{t.name}</span>
                    <div className="flex gap-0.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.bg, border: `1px solid ${t.borderMedium}` }} />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.accent }} />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.cardBack }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sign in with Google (for guests) */}
          {isGuest && onSignIn && (
            <div className="p-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <button
                onClick={() => { setOpen(false); onSignIn(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-sm text-left text-sm transition-all"
                style={{ color: "var(--text-primary)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--input-bg)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
            </div>
          )}

          {/* Sign out / Leave */}
          <div className="p-1.5">
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-sm text-left text-sm transition-all"
              style={{ color: "var(--btn-danger-text)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--input-bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {isGuest ? "Leave" : "Sign Out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
