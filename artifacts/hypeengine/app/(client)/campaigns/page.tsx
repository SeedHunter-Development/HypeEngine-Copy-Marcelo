"use client";

import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import CampaignCard from "@/components/campaigns/CampaignCard";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useState } from "react";

export default function CampaignsPage() {
  const { user } = useAuth();
  const { campaigns } = useApp();
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "draft">("all");
  const [search, setSearch] = useState("");

  const myCampaigns = campaigns
    .filter((c) => c.clientId === user?.id)
    .filter((c) => filter === "all" || c.status === filter)
    .filter(
      (c) =>
        !search ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.hashtag.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <>
    <Navbar title="My Campaigns" />
    <div className="page-container" style={{ paddingTop: 84 }}>
      <div className="animate-in">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "var(--text-body)", letterSpacing: "-0.02em" }}>
            Campaigns
          </h1>
          <Link href="/campaigns/new" style={{ textDecoration: "none" }}>
            <button
              style={{
                background: "linear-gradient(135deg, #FBAC32, #F29236)",
                border: "none",
                borderRadius: 10,
                padding: "10px 14px",
                color: "#11152C",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "inherit",
              }}
            >
              <Plus size={15} /> New
            </button>
          </Link>
        </div>

        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--input-placeholder)",
            }}
          />
          <input
            className="input-field"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["all", "active", "draft", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: filter === f ? "none" : "1px solid var(--input-border)",
                background: filter === f ? "#FBAC32" : "transparent",
                color: filter === f ? "#11152C" : "var(--text-muted)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "capitalize",
                fontFamily: "inherit",
                transition: "all 0.2s",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {myCampaigns.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "var(--text-faint)",
            }}
          >
            <p style={{ fontSize: 15, fontWeight: 700 }}>No campaigns found</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>
              {filter !== "all" ? "Try changing the filter" : "Launch your first campaign"}
            </p>
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
      </div>
    </div>
    </>
  );
}
