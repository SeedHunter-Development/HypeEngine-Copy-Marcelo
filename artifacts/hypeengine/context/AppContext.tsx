"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { Campaign, Post, Transaction } from "@/lib/types";
import { getTodayDateString } from "@/lib/utils";

interface AppContextType {
  campaigns: Campaign[];
  addCampaign: (c: Omit<Campaign, "id" | "createdAt" | "metrics" | "usedCredits"> & { clientId: string; status?: Campaign["status"] }) => Promise<Campaign>;
  updateCampaign: (id: string, patch: Partial<Campaign>) => Promise<Campaign>;
  refreshCampaign: (id: string) => Promise<void>;
  clientTransactions: Transaction[];
  addClientTransaction: (userId: string, t: Omit<Transaction, "id" | "createdAt">) => Promise<void>;
  kolTransactions: Transaction[];
  addKolTransaction: (userId: string, t: Omit<Transaction, "id" | "createdAt">) => Promise<void>;
  posts: Post[];
  addPost: (p: Omit<Post, "id" | "createdAt">) => Promise<Post>;
  canPostToday: (campaignId: string, kolId: string) => boolean;
  kolPostsToday: (campaignId: string, kolId: string) => number;
  kolPostsTotal: (campaignId: string, kolId: string) => number;
  getKolPosts: (kolId: string) => Post[];
  refreshForUser: (userId: string, role: "client" | "kol") => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [clientTransactions, setClientTransactions] = useState<Transaction[]>([]);
  const [kolTransactions, setKolTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then(setCampaigns)
      .catch(() => {});

    fetch("/api/posts")
      .then((r) => r.json())
      .then(setPosts)
      .catch(() => {});
  }, []);

  const refreshForUser = useCallback((userId: string, role: "client" | "kol") => {
    fetch(`/api/transactions?userId=${userId}`)
      .then((r) => r.json())
      .then((txs: Transaction[]) => {
        if (role === "client") setClientTransactions(txs);
        else setKolTransactions(txs);
      })
      .catch(() => {});
  }, []);

  const addCampaign = async (
    data: Omit<Campaign, "id" | "createdAt" | "metrics" | "usedCredits"> & { clientId: string; status?: Campaign["status"] }
  ): Promise<Campaign> => {
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create campaign");
    const campaign: Campaign = await res.json();
    setCampaigns((prev) => [campaign, ...prev]);
    return campaign;
  };

  const updateCampaign = async (id: string, patch: Partial<Campaign>): Promise<Campaign> => {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Failed to update campaign");
    const campaign: Campaign = await res.json();
    setCampaigns((prev) => prev.map((c) => (c.id === id ? campaign : c)));
    return campaign;
  };

  const refreshCampaign = async (id: string): Promise<void> => {
    const res = await fetch(`/api/campaigns/${id}`);
    if (!res.ok) return;
    const campaign: Campaign = await res.json();
    setCampaigns((prev) => prev.map((c) => (c.id === id ? campaign : c)));
  };

  const addClientTransaction = async (
    userId: string,
    t: Omit<Transaction, "id" | "createdAt">
  ) => {
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...t }),
    });
    if (!res.ok) return;
    const tx: Transaction = await res.json();
    setClientTransactions((prev) => [tx, ...prev]);
  };

  const addKolTransaction = async (
    userId: string,
    t: Omit<Transaction, "id" | "createdAt">
  ) => {
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...t }),
    });
    if (!res.ok) return;
    const tx: Transaction = await res.json();
    setKolTransactions((prev) => [tx, ...prev]);
  };

  const addPost = async (p: Omit<Post, "id" | "createdAt">): Promise<Post> => {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!res.ok) throw new Error("Failed to create post");
    const post: Post = await res.json();
    setPosts((prev) => [post, ...prev]);
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === p.campaignId
          ? { ...c, usedCredits: Math.min(c.totalCredits, c.usedCredits + (p.creditsEarned ?? 0)) }
          : c
      )
    );
    return post;
  };

  const kolPostsToday = (campaignId: string, kolId: string): number => {
    const today = getTodayDateString();
    return posts.filter(
      (p) => p.campaignId === campaignId && p.kolId === kolId && p.postedDate === today
    ).length;
  };

  const kolPostsTotal = (campaignId: string, kolId: string): number => {
    return posts.filter(
      (p) => p.campaignId === campaignId && p.kolId === kolId
    ).length;
  };

  const canPostToday = (campaignId: string, kolId: string): boolean => {
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) return false;
    const todayCount = kolPostsToday(campaignId, kolId);
    const totalCount = kolPostsTotal(campaignId, kolId);
    return todayCount < campaign.maxPostsPerKolPerDay && totalCount < campaign.maxPostsPerKolTotal;
  };

  const getKolPosts = (kolId: string): Post[] => {
    return posts.filter((p) => p.kolId === kolId);
  };

  return (
    <AppContext.Provider
      value={{
        campaigns,
        addCampaign,
        updateCampaign,
        refreshCampaign,
        clientTransactions,
        addClientTransaction,
        kolTransactions,
        addKolTransaction,
        posts,
        addPost,
        canPostToday,
        kolPostsToday,
        kolPostsTotal,
        getKolPosts,
        refreshForUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
