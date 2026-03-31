"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import CampaignCard from "@/components/campaigns/CampaignCard";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import { Plus, TrendingUp, BarChart2, DollarSign } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const { campaigns, clientTransactions, refreshForUser } = useApp();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.id) refreshForUser(user.id, "client");
  }, [user?.id]);

  const myCampaigns = campaigns
    .filter((c) => c.clientId === user?.id)
    .slice(0, 3);

  const activeCampaigns = myCampaigns.filter((c) => c.status === "active");
  const totalReach = myCampaigns.reduce((a, c) => a + c.metrics.views, 0);
  const totalSpent = clientTransactions
    .filter((t) => t.type === "spend")
    .reduce((a, t) => a + Math.abs(t.amount), 0);

  const balance = user?.credits ?? 0;

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
            {user?.name || "Client"} 👋
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
              <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Account Balance
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: "rgba(251,172,50,0.7)" }}>$</span>
                <span style={{ fontSize: 36, fontWeight: 900, color: "#FBAC32", letterSpacing: "-0.03em" }}>
                  {balance.toLocaleString()}
                </span>
                <span style={{ fontSize: 14, color: "rgba(251,172,50,0.6)" }}>USD</span>
              </div>
            </div>
            <DollarSign size={40} style={{ color: "rgba(251,172,50,0.4)" }} />
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <Link href="/credits" style={{ flex: 1, textDecoration: "none" }}>
              <button className="btn-primary" style={{ padding: "12px" }}>
                Add Funds
              </button>
            </Link>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {[
            { label: "Active", value: activeCampaigns.length, icon: BarChart2, color: "#FBAC32" },
            { label: "Total Reach", value: formatNumber(totalReach), icon: TrendingUp, color: "#22c55e" },
            { label: "USD Spent", value: `$${formatNumber(totalSpent)}`, icon: DollarSign, color: "#8b5cf6" },
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
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-body)" }}>My Campaigns</h2>
          <Link href="/campaigns" style={{ fontSize: 13, color: "#FBAC32", fontWeight: 700, textDecoration: "none" }}>
            View All →
          </Link>
        </div>

        {myCampaigns.length === 0 ? (
          <div
            style={{
              background: "var(--bg-card-glass)",
              border: "1px dashed var(--input-border)",
              borderRadius: 16,
              padding: "32px 20px",
              textAlign: "center",
            }}
          >
            <BarChart2 size={36} style={{ color: "var(--text-faint)", marginBottom: 12, margin: "0 auto 12px" }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>
              No campaigns yet
            </p>
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 16 }}>
              Launch your first influencer campaign
            </p>
            <Link href="/campaigns/new" style={{ textDecoration: "none" }}>
              <button className="btn-primary" style={{ maxWidth: 200, margin: "0 auto" }}>
                <Plus size={16} /> New Campaign
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {myCampaigns.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                variant="client"
                href={`/campaigns/detail?id=${c.id}`}
              />
            ))}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <Link href="/campaigns/new" style={{ textDecoration: "none" }}>
            <button
              className="btn-primary"
              onClick={() => toast("Launching campaign wizard!", "info")}
            >
              <Plus size={18} /> Launch New Campaign
            </button>
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
