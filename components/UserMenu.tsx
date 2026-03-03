"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  displayName: string;
  onSignOut: () => void;
}

export default function UserMenu({ displayName, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
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
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-2xl z-50
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
              Signed in
            </div>
          </div>

          {/* Actions */}
          <div className="p-1.5">
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-all"
              style={{ color: "var(--btn-danger-text)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--input-bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
