"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/theme-provider";
import themes, { themeKeys } from "@/lib/themes";

export default function ThemeSwitcher() {
  const { themeKey, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs
                   transition-all hover:opacity-80"
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-secondary)",
        }}
      >
        <span>{themes[themeKey].emoji}</span>
        <span className="hidden sm:inline">{themes[themeKey].name}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
             fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-2xl z-50
                     overflow-hidden animate-slide-up"
          style={{
            background: "var(--bg-light)",
            border: "1px solid var(--border-medium)",
          }}
        >
          <div className="p-1.5">
            {themeKeys.map(key => {
              const t = themes[key];
              const active = key === themeKey;
              return (
                <button
                  key={key}
                  onClick={() => { setTheme(key); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                             text-left text-sm transition-all"
                  style={{
                    background: active ? "var(--accent)" : "transparent",
                    color: active ? "var(--text-on-accent)" : "var(--text-primary)",
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.target as HTMLElement).style.background = "var(--input-bg)";
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.target as HTMLElement).style.background = "transparent";
                  }}
                >
                  <span className="text-base">{t.emoji}</span>
                  <span className="flex-1 font-medium">{t.name}</span>
                  {/* Color preview dots */}
                  <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ background: t.bg, border: `1px solid ${t.borderMedium}` }} />
                    <div className="w-3 h-3 rounded-full" style={{ background: t.accent }} />
                    <div className="w-3 h-3 rounded-full" style={{ background: t.cardFace }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
