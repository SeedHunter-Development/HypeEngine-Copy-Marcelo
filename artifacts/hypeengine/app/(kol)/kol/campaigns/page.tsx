"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { Post } from "@/lib/types";
import CampaignCard from "@/components/campaigns/CampaignCard";
import Navbar from "@/components/layout/Navbar";
import { Search, Flame, BarChart2, ExternalLink, CheckCircle, Clock, ArrowRight, ChevronDown } from "lucide-react";
import { calculateMatchScore } from "@/lib/utils";

function FilterDropdown({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <div style={{ position: "relative", flex: 1 }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          padding: "10px 14px",
          borderRadius: 12,
          border: open ? "1px solid rgba(251,172,50,0.5)" : "1px solid var(--border)",
          background: open ? "rgba(251,172,50,0.06)" : "var(--bg-card-glass)",
          color: selected && selected.value !== "all" ? "var(--text-body)" : "var(--text-muted)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "all 0.15s",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected?.label ?? placeholder ?? "Select"}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: open ? "#FBAC32" : "var(--text-faint)",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 90 }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              zIndex: 100,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
            }}
          >
            {options.map((opt) => {
              const isActive = opt.value === value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "11px 14px",
                    border: "none",
                    background: isActive ? "rgba(251,172,50,0.1)" : "transparent",
                    color: isActive ? "#FBAC32" : "var(--text-body)",
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    borderBottom: "1px solid var(--border)",
                    transition: "background 0.1s",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

type Tab = "discover" | "my-posts";

interface MatchScoreEntry {
  campaignId: string;
  matchScore: number | null;
  matchBreakdown: Record<string, number> | null;
  status: string;
}

export default function KolCampaignsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { campaigns } = useApp();
  const [tab, setTab] = useState<Tab>("discover");
  const [search, setSearch] = useState("");
  const [dbMatchScores, setDbMatchScores] = useState<MatchScoreEntry[]>([]);

  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [filterCampaign, setFilterCampaign] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/kol/match-scores?userId=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDbMatchScores(data);
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/posts?kolId=${user.id}`)
      .then((r) => r.json())
      .then((data: Post[]) => setMyPosts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [user?.id]);

  const today = new Date().toISOString().slice(0, 10);

  function getPostStatus(campaignId: string) {
    const campaignPosts = myPosts.filter((p) => p.campaignId === campaignId);
    const postsToday = campaignPosts.filter(
      (p) => (p.createdAt ?? "").slice(0, 10) === today
    ).length;
    return { postsToday, totalPosts: campaignPosts.length };
  }

  const kolProfile = { niches: user?.niches, country: user?.country, language: user?.language };

  const getMatchScore = (campaignId: string): number => {
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (campaign?.matchScore != null) return campaign.matchScore;
    const dbEntry = dbMatchScores.find((m) => m.campaignId === campaignId);
    if (dbEntry?.matchScore != null) return dbEntry.matchScore;
    return campaign ? calculateMatchScore(campaign, kolProfile) * 100 : 0;
  };

  const filtered = campaigns
    .filter((c) => c.status === "active")
    .filter(
      (c) =>
        !search ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.hashtag.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => getMatchScore(b.id) - getMatchScore(a.id));

  const campaignsWithPosts = campaigns.filter((c) =>
    myPosts.some((p) => p.campaignId === c.id)
  );

  const filteredMyPosts = myPosts.filter((p) => {
    if (filterCampaign !== "all" && p.campaignId !== filterCampaign) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    return true;
  });

  return (
    <>
    <Navbar title="Campaigns" />
    <div className="page-container" style={{ paddingTop: 84 }}>
      <div className="animate-in">
        <h1
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: "var(--text-body)",
            letterSpacing: "-0.02em",
            marginBottom: 16,
          }}
        >
          Campaigns
        </h1>

        <div style={{ display: "flex", gap: 0, marginBottom: 24, background: "var(--bg-card-glass)", borderRadius: 12, padding: 4 }}>
          {([
            { key: "discover", label: "Discover" },
            { key: "my-posts", label: `My Posts${myPosts.length > 0 ? ` (${myPosts.length})` : ""}` },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 10,
                border: "none",
                background: tab === t.key ? "#FBAC32" : "transparent",
                color: tab === t.key ? "#11152C" : "var(--text-muted)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.2s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "discover" && (
          <>
            <div style={{ position: "relative", marginBottom: 20 }}>
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

            {filtered.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "var(--text-faint)",
                }}
              >
                <Flame size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <p style={{ fontSize: 15, fontWeight: 700 }}>No campaigns found</p>
                <p style={{ fontSize: 13, marginTop: 6 }}>
                  Try a different search or check back later
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filtered.map((c) => (
                  <CampaignCard
                    key={c.id}
                    campaign={c}
                    kolFollowers={user?.twitterFollowers ?? user?.followers ?? 50000}
                    kolProfile={kolProfile}
                    href={`/kol/campaigns/${c.id}`}
                    variant="kol"
                    postStatus={getPostStatus(c.id)}
                    dbMatchScore={c.matchScore ?? dbMatchScores.find((m) => m.campaignId === c.id)?.matchScore ?? null}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "my-posts" && (
          <>
            {myPosts.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "50px 20px",
                  color: "var(--text-faint)",
                }}
              >
                <BarChart2 size={36} style={{ margin: "0 auto 14px", opacity: 0.25 }} />
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-muted)" }}>No posts yet</p>
                <p style={{ fontSize: 13, marginTop: 6 }}>
                  Post to campaigns to see your proof of delivery here
                </p>
                <button
                  className="btn-primary"
                  onClick={() => setTab("discover")}
                  style={{ marginTop: 20, width: "auto", padding: "10px 24px" }}
                >
                  Discover Campaigns
                </button>
              </div>
            ) : (
              <>
                {/* Filters */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <FilterDropdown
                    value={filterCampaign}
                    onChange={setFilterCampaign}
                    options={[
                      { value: "all", label: "All Campaigns" },
                      ...campaignsWithPosts.map((c) => ({ value: c.id, label: c.title })),
                    ]}
                  />
                  <FilterDropdown
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={[
                      { value: "all", label: "All Statuses" },
                      { value: "approved", label: "✓ Approved" },
                      { value: "pending", label: "⏳ Pending" },
                    ]}
                  />
                </div>

                {filteredMyPosts.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 20px", color: "var(--text-faint)" }}>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>No posts match your filters</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {filteredMyPosts.map((post) => {
                      const campaign = campaigns.find((c) => c.id === post.campaignId);
                      const isApproved = post.status === "approved";
                      return (
                        <div
                          key={post.id}
                          style={{
                            background: "var(--bg-card-glass)",
                            border: "1px solid var(--border)",
                            borderRadius: 16,
                            padding: 16,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-body)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {campaign?.title ?? "Unknown Campaign"}
                              </p>
                              <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
                                {post.tweetCreatedAt
                                  ? new Date(post.tweetCreatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                                  : post.postedDate}
                              </p>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "4px 10px",
                                borderRadius: 999,
                                background: isApproved ? "rgba(34,197,94,0.1)" : "rgba(251,172,50,0.1)",
                                border: `1px solid ${isApproved ? "rgba(34,197,94,0.3)" : "rgba(251,172,50,0.3)"}`,
                                flexShrink: 0,
                              }}
                            >
                              {isApproved ? (
                                <CheckCircle size={12} style={{ color: "#22c55e" }} />
                              ) : (
                                <Clock size={12} style={{ color: "#FBAC32" }} />
                              )}
                              <span style={{ fontSize: 11, fontWeight: 700, color: isApproved ? "#22c55e" : "#FBAC32" }}>
                                {isApproved ? "Approved" : "Pending"}
                              </span>
                            </div>
                          </div>

                          {post.tweetText && (
                            <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, borderLeft: "2px solid rgba(251,172,50,0.3)", paddingLeft: 8, marginBottom: 10, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                              {post.tweetText}
                            </p>
                          )}

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#FBAC32" }}>
                              +${(post.creditsEarned ?? 0).toLocaleString()} earned
                            </span>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              {post.tweetUrl && (
                                <a
                                  href={post.tweetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}
                                >
                                  <ExternalLink size={12} /> Tweet
                                </a>
                              )}
                              <button
                                onClick={() => router.push(`/kol/campaigns/${post.campaignId}`)}
                                style={{
                                  background: "none", border: "none", fontSize: 12,
                                  color: "#FBAC32", cursor: "pointer", fontFamily: "inherit",
                                  display: "flex", alignItems: "center", gap: 4, fontWeight: 700,
                                }}
                              >
                                Campaign <ArrowRight size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
    </>
  );
}
