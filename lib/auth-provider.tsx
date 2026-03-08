"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  guestName: string | null;
  isGuest: boolean;
  displayName: string;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: (name: string) => void;
  clearGuest: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  guestName: null,
  isGuest: false,
  displayName: "",
  signInWithGoogle: async () => {},
  signOut: async () => {},
  continueAsGuest: () => {},
  clearGuest: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const isLocalMock = process.env.NEXT_PUBLIC_SUPABASE_URL === "http://localhost:mock";

const GUEST_NAME_KEY = "pokerai_guest_name";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState<string | null>(null);
  const router = useRouter();

  // Read guest name from localStorage on mount (avoids SSR hydration mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GUEST_NAME_KEY);
      if (stored) setGuestName(stored);
    } catch {}
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // Get initial user
    supabase.auth.getUser().then(({ data }: { data: any }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });

    if (isLocalMock) return; // Mock mode: no auth state changes to listen for

    // Listen for auth state changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setUser(session?.user ?? null);
      setLoading(false);
      router.refresh(); // Re-run server components with updated cookies
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isGuest = !user && !!guestName;
  const displayName = user?.user_metadata?.full_name || user?.email || guestName || "";

  const continueAsGuest = (name: string) => {
    try { localStorage.setItem(GUEST_NAME_KEY, name); } catch {}
    setGuestName(name);
  };

  const clearGuest = () => {
    try { localStorage.removeItem(GUEST_NAME_KEY); } catch {}
    setGuestName(null);
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    if (isLocalMock) return; // Mock mode: already "signed in"
    clearGuest(); // Upgrading from guest to auth
    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (redirectTo) callbackUrl.searchParams.set("next", redirectTo);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });
  };

  const signOut = async () => {
    clearGuest();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <AuthContext.Provider value={{
      user, loading, guestName, isGuest, displayName,
      signInWithGoogle, signOut, continueAsGuest, clearGuest,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
