"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import themes, { themeKeys, Theme } from "./themes";

interface ThemeContextType {
  theme: Theme;
  themeKey: string;
  setTheme: (key: string) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  const vars: Record<string, string> = {
    "--bg": t.bg,
    "--bg-light": t.bgLight,
    "--bg-dark": t.bgDark,
    "--bg-glow1": t.bgGlow1,
    "--bg-glow2": t.bgGlow2,
    "--bg-glow3": t.bgGlow3,
    "--accent": t.accent,
    "--accent-light": t.accentLight,
    "--accent-dark": t.accentDark,
    "--text-primary": t.textPrimary,
    "--text-secondary": t.textSecondary,
    "--text-muted": t.textMuted,
    "--text-on-accent": t.textOnAccent,
    "--card-face": t.cardFace,
    "--card-back": t.cardBack,
    "--card-text": t.cardText,
    "--border-subtle": t.borderSubtle,
    "--border-medium": t.borderMedium,
    "--status-active": t.statusActive,
    "--status-idle": t.statusIdle,
    "--status-offline": t.statusOffline,
    "--input-bg": t.inputBg,
    "--input-border": t.inputBorder,
    "--input-focus-border": t.inputFocusBorder,
    "--overlay-bg": t.overlayBg,
    "--header-bg": t.headerBg,
    "--header-border": t.headerBorder,
    "--vote-bar-from": t.voteBarFrom,
    "--vote-bar-to": t.voteBarTo,
    "--voted-card-bg": t.votedCardBg,
    "--voted-card-border": t.votedCardBorder,
    "--unvoted-bg": t.unvotedBg,
    "--unvoted-border": t.unvotedBorder,
    "--btn-primary-from": t.btnPrimaryFrom,
    "--btn-primary-to": t.btnPrimaryTo,
    "--btn-primary-text": t.btnPrimaryText,
    "--btn-secondary-bg": t.btnSecondaryBg,
    "--btn-secondary-text": t.btnSecondaryText,
    "--btn-secondary-border": t.btnSecondaryBorder,
    "--btn-danger-text": t.btnDangerText,
    "--btn-danger-border": t.btnDangerBorder,
    "--badge-pending-text": t.badgePendingText,
    "--badge-pending-bg": t.badgePendingBg,
    "--badge-voting-text": t.badgeVotingText,
    "--badge-voting-bg": t.badgeVotingBg,
    "--badge-revealed-text": t.badgeRevealedText,
    "--badge-revealed-bg": t.badgeRevealedBg,
    "--badge-complete-text": t.badgeCompleteText,
    "--badge-complete-bg": t.badgeCompleteBg,
    "--red-suit": t.redSuit,
  };
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  document.documentElement.className = t.bodyClass || "";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setThemeKey] = useState("felt");

  useEffect(() => {
    const saved = document.cookie
      .split("; ")
      .find(c => c.startsWith("pokerai_theme="))
      ?.split("=")[1];
    if (saved && themes[saved]) {
      setThemeKey(saved);
      applyTheme(themes[saved]);
    } else {
      applyTheme(themes.felt);
    }
  }, []);

  const setTheme = useCallback((key: string) => {
    if (!themes[key]) return;
    setThemeKey(key);
    applyTheme(themes[key]);
    document.cookie = `pokerai_theme=${key}; path=/; max-age=31536000`;
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: themes[themeKey], themeKey, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
