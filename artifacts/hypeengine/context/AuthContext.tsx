"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export type UserRole = "client" | "kol" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyName?: string;
  title?: string;
  twitterAccount?: string;
  twitterHandle?: string;
  website?: string;
  followers?: number;
  kolValue?: number;
  credits: number;
  setupComplete: boolean;
  agreedToTerms?: boolean;
  walletConnected?: boolean;
  bio?: string;
  country?: string;
  language?: string;
  niches?: string[];
  twitterFollowers?: number;
  twitterFollowing?: number;
  twitterScoreValue?: number;
  engagementRate?: number;
  avgLikes?: number;
  avgPostsPerDay?: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (
    email: string,
    password: string,
    role: UserRole,
    twitterHandle?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) setUser(u);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const u: User = await res.json();
      setUser(u);
      return true;
    } catch {
      return false;
    }
  };

  const signup = async (
    email: string,
    password: string,
    role: UserRole,
    twitterHandle?: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role, twitterHandle }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: (body as { error?: string }).error };
      }
      const u: User = await res.json();
      setUser(u);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    setUser(null);
    // Clear any legacy localStorage keys from the previous in-memory auth system
    try {
      localStorage.removeItem("he_user_id");
      localStorage.removeItem("he_user");
    } catch {}
  };

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const u: User = await res.json();
        setUser(u);
      }
    } catch {}
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    const optimistic = { ...user, ...updates };
    setUser(optimistic);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated: User = await res.json();
        setUser(updated);
      }
    } catch {
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
