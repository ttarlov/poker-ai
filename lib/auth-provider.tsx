"use client";

// Guest identity only: a display name plus a random participant ID, both kept in
// localStorage so a reload or reconnect rejoins as the same person.

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface AuthContextType {
  loading: boolean;
  participantId: string;
  guestName: string | null;
  isGuest: boolean;
  displayName: string;
  continueAsGuest: (name: string) => void;
  clearGuest: () => void;
}

const AuthContext = createContext<AuthContextType>({
  loading: true,
  participantId: "",
  guestName: null,
  isGuest: false,
  displayName: "",
  continueAsGuest: () => {},
  clearGuest: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const GUEST_NAME_KEY = "pokerai_guest_name";
const GUEST_PID_KEY = "pokerai_guest_pid";

function newParticipantId(): string {
  return crypto.randomUUID();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState("");

  // Read identity on mount (localStorage is unavailable during SSR).
  useEffect(() => {
    let pid = "";
    try {
      const storedName = localStorage.getItem(GUEST_NAME_KEY);
      if (storedName) setGuestName(storedName);
      pid = localStorage.getItem(GUEST_PID_KEY) || "";
      if (!pid) {
        pid = newParticipantId();
        localStorage.setItem(GUEST_PID_KEY, pid);
      }
    } catch {
      pid = pid || newParticipantId();
    }
    setParticipantId(pid);
    setLoading(false);
  }, []);

  const continueAsGuest = useCallback((name: string) => {
    try { localStorage.setItem(GUEST_NAME_KEY, name); } catch {}
    setGuestName(name);
  }, []);

  // "Change name": forget the name and start as a new participant.
  const clearGuest = useCallback(() => {
    const pid = newParticipantId();
    try {
      localStorage.removeItem(GUEST_NAME_KEY);
      localStorage.setItem(GUEST_PID_KEY, pid);
    } catch {}
    setGuestName(null);
    setParticipantId(pid);
  }, []);

  const isGuest = !!guestName;

  return (
    <AuthContext.Provider value={{
      loading, participantId, guestName, isGuest, displayName: guestName || "",
      continueAsGuest, clearGuest,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
