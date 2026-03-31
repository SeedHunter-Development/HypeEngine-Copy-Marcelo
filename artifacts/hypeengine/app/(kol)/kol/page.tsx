"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { Post } from "@/lib/types";
import CampaignCard from "@/components/campaigns/CampaignCard";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import { Zap, BarChart2, Award } from "lucide-react";
import { calculateMatchScore } from "@/lib/utils";

interface MatchScoreEntry {
  campaignId: string;
  matchScore: number | null;
}

export default function KolDashboardPage() {
  const { user } = useAuth();
  const { campaigns } = useApp();
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [dbMatchScores, setDbMatchScores] = useState<MatchScoreEntry[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/posts?kolId=${user.id}`)
      .then((r) => r.json())
      .then((data: Post[]) => setMyPosts(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch(`/api/kol/match-scores?userId=${user.id}`)
      .then((r) => r.json())
      .then((data: unknown) => { if (Array.isArray(data)) setDbMatchScores(data); })
      .catch(() => {});
  }, [user?.id]);

  const totalEarned = myPosts.filter((p) => p.status === "approved").reduce((a, p) => a + (p.creditsEarned ?? 0), 0);

  const kolProfile = { niches: user?.niches, country: user?.country, language: user?.language };

  const getDbMatchScore = (campaignId: string) => {
    return dbMatchScores.find((m) => m.campaignId === campaignId)?.matchScore ?? null;
  };

  const activeCampaigns = campaigns
    .filter((c) => c.status === "active")
    .sort((a, b) => {
      const scoreA = getDbMatchScore(a.id) ?? (calculateMatchScore(a, kolProfile) * 100);
      const scoreB = getDbMatchScore(b.id) ?? (calculateMatchScore(b, kolProfile) * 100);
      return scoreB - scoreA;
    })
    .slice(0, 4);

  return (
    <>
    <Navbar title="Dashboard" />
    <div className="page-container" style={{ paddingTop: 84 }}>
      <div className="animate-in">
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 4 }}>
            Welcome back,
          </p>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: "var(--text-body)",
              letterSpacing: "-0.03em",
            }}
          >
            {user?.name || "KOL"} 👋
          </h1>
        </div>

        <div
          style={{
            background: "linear-gradient(135deg, rgba(251,172,50,0.12), rgba(242,146,54,0.08))",
            border: "1px solid rgba(251,172,50,0.2)",
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 12, color: "rgba(251,172,50,0.7)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Total Earnings
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: "rgba(251,172,50,0.7)" }}>$</span>
                <span style={{ fontSize: 36, fontWeight: 900, color: "#FBAC32" }}>
                  {totalEarned.toLocaleString()}
                </span>
              </div>
            </div>
            <Zap size={40} style={{ color: "rgba(251,172,50,0.4)" }} />
          </div>
          <div style={{ marginTop: 16 }}>
            <Link href="/kol/credits" style={{ textDecoration: "none" }}>
              <button className="btn-primary" style={{ padding: "12px" }}>
                Withdraw
              </button>
            </Link>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {[
            { label: "Posts Made", value: myPosts.length, icon: BarChart2, color: "#FBAC32" },
            { label: "KOL Score", value: user?.kolValue ?? 0, icon: Award, color: "#8b5cf6" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                style={{
                  background: "var(--bg-card-glass)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "14px 12px",
                  textAlign: "center",
                }}
              >
                <Icon size={18} style={{ color: stat.color, marginBottom: 8 }} />
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-body)" }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{stat.label}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-body)" }}>Campaigns</h2>
          <Link href="/kol/campaigns" style={{ fontSize: 13, color: "#FBAC32", fontWeight: 700, textDecoration: "none" }}>
            View All →
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {activeCampaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              kolFollowers={user?.followers ?? 50000}
              kolProfile={kolProfile}
              href={`/kol/campaigns/${c.id}`}
              variant="kol"
              dbMatchScore={c.matchScore ?? getDbMatchScore(c.id)}
            />
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
