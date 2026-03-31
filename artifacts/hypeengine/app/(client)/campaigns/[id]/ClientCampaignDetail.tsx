"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Modal from "@/components/ui/Modal";
import {
  getCompletionPercent,
  formatNumber,
  timeAgo,
  estimateReach,
} from "@/lib/utils";
import {
  TrendingUp,
  Eye,
  Heart,
  Repeat2,
  MessageCircle,
  Zap,
  Copy,
  AlertTriangle,
  ShoppingCart,
  Rocket,
  Users,
  RefreshCw,
  Sparkles,
  BarChart2,
  Star,
  Activity,
  Link2,
  CheckCircle,
  Clock,
  MousePointerClick,
  ArrowRightLeft,
  XCircle,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import KolMatchCard, { type MatchRow } from "./KolMatchCard";
import KolProfileModal from "./KolProfileModal";

const TOPUP_AMOUNTS = [500, 2000, 5000, 10000];

function autoSelectPackage(shortfall: number) {
  const idx = TOPUP_AMOUNTS.findIndex((a) => a >= shortfall);
  return idx >= 0 ? idx : TOPUP_AMOUNTS.length - 1;
}

interface AnalyticsData {
  totalClicks: number;
  uniqueClicks: number;
  totalConversions: number;
  totalConversionValue: number;
  conversionsByType: Record<string, { count: number; value: number }>;
  ctr: number | null;
  cpa: number | null;
  hasData: boolean;
  pixelStatus: "active" | "pending" | "not_set";
  kolData: Array<{
    kolProfileId: string;
    kolName: string;
    twitterHandle: string;
    matchId: string;
    refCode: string | null;
    trackingUrl: string | null;
    clicks: number;
    uniqueClicks: number;
    conversions: number;
    convRate: number | null;
    cpa: number | null;
    priceAgreed: number | null;
  }>;
  recentEvents: Array<{
    eventType: string;
    eventValue: number | null;
    timestamp: string | null;
    refCode: string;
  }>;
}

interface KolRating {
  matchId: string;
  kolProfileId: string;
  kolName: string;
  rating: number;
  feedback: string;
}

interface CompleteSummary {
  totalConversions: number;
  totalConversionValue: number;
  avgDeliveryScore: number | null;
  bestKolId: string | null;
  worstKolId: string | null;
  kolCount: number;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 2, color: n <= value ? "#FBAC32" : "var(--text-faint)",
          }}
        >
          <Star size={20} fill={n <= value ? "#FBAC32" : "none"} />
        </button>
      ))}
    </div>
  );
}

function PixelStatusDot({ status }: { status: string }) {
  const color = status === "active" ? "#22c55e" : status === "pending" ? "#FBAC32" : "#6b7280";
  const label = status === "active" ? "Receiving data" : status === "pending" ? "Awaiting first event" : "Not installed";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

export default function ClientCampaignDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { campaigns, posts, updateCampaign, addClientTransaction } = useApp();
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(0);
  const [topUpCustom, setTopUpCustom] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [activateLoading, setActivateLoading] = useState(false);

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [refreshingMatches, setRefreshingMatches] = useState(false);
  const [selectedKol, setSelectedKol] = useState<MatchRow | null>(null);

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingCampaign, setCompletingCampaign] = useState(false);
  const [ratings, setRatings] = useState<KolRating[]>([]);
  const [completeSummary, setCompleteSummary] = useState<CompleteSummary | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const [pixelTestLog, setPixelTestLog] = useState<string[]>([]);
  const [testingPixel, setTestingPixel] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const campaign = campaigns.find((c) => c.id === id);
  const campaignPosts = posts.filter((p) => p.campaignId === id);
  const completion = campaign
    ? getCompletionPercent(campaign.usedCredits, campaign.totalCredits)
    : 0;

  const balance = user?.credits ?? 0;
  const shortfall = campaign ? Math.max(0, campaign.totalCredits - balance) : 0;
  const canActivate = campaign ? balance >= campaign.totalCredits : false;

  const fetchMatches = useCallback(async () => {
    setMatchesLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/matches`);
      if (res.ok) {
        const data = await res.json() as MatchRow[];
        setMatches(data);
      }
    } catch {
    } finally {
      setMatchesLoading(false);
    }
  }, [id]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/analytics`);
      if (res.ok) {
        const data = await res.json() as AnalyticsData;
        setAnalytics(data);
        if (data.kolData.length > 0 && ratings.length === 0) {
          setRatings(
            data.kolData.map((k) => ({
              matchId: k.matchId,
              kolProfileId: k.kolProfileId,
              kolName: k.kolName,
              rating: 0,
              feedback: "",
            })),
          );
        }
      }
    } catch {
    } finally {
      setAnalyticsLoading(false);
    }
  }, [id, ratings.length]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    if (campaign && campaign.status !== "draft") {
      fetchAnalytics();
      const interval = setInterval(fetchAnalytics, 30000);
      return () => clearInterval(interval);
    }
  }, [campaign?.status, fetchAnalytics]);

  const handleRefreshMatches = async () => {
    setRefreshingMatches(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/matches/generate`, { method: "POST" });
      if (res.ok) {
        await fetchMatches();
        toast("Matches refreshed!", "success");
      } else {
        toast("Failed to refresh matches", "error");
      }
    } catch {
      toast("Error refreshing matches", "error");
    } finally {
      setRefreshingMatches(false);
    }
  };

  const handleBookKol = async (matchId: string) => {
    const res = await fetch(`/api/campaigns/${id}/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "booked" }),
    });
    if (res.ok) {
      setMatches((prev) => prev.map((m) => m.matchId === matchId ? { ...m, status: "booked" } : m));
      toast("KOL booked! Tracking link generated automatically.", "success");
      setTimeout(() => fetchAnalytics(), 1500);
    } else {
      toast("Failed to book KOL", "error");
    }
  };

  const openTopUpModal = () => {
    setSelectedPkg(autoSelectPackage(shortfall));
    setShowTopUpModal(true);
  };

  const getTopUpAmount = (): number => {
    const custom = parseFloat(topUpCustom);
    if (!isNaN(custom) && custom > 0) return custom;
    return TOPUP_AMOUNTS[selectedPkg] ?? 0;
  };

  const handleTopUp = async () => {
    if (!user || !campaign) return;
    const amount = getTopUpAmount();
    if (amount < 100) { toast("Minimum deposit is $100", "error"); return; }
    setTopUpLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    await updateUser({ credits: balance + amount });
    await addClientTransaction(user.id, {
      type: "deposit",
      amount,
      description: `Added $${amount.toLocaleString()} to account balance`,
    });
    toast(`$${amount.toLocaleString()} added to your balance!`, "success");
    setShowTopUpModal(false);
    setTopUpCustom("");
    setTopUpLoading(false);
  };

  const handleActivate = async () => {
    if (!user || !campaign) return;
    setActivateLoading(true);
    try {
      await updateCampaign(campaign.id, { status: "active" });
      await addClientTransaction(user.id, {
        type: "spend",
        amount: -campaign.totalCredits,
        description: `Activated campaign: ${campaign.title}`,
      });
      await updateUser({ credits: balance - campaign.totalCredits });
      toast("Campaign activated! It's now live for KOLs.", "success");
    } catch {
      toast("Failed to activate. Please try again.", "error");
    } finally {
      setActivateLoading(false);
    }
  };

  const handleCompleteCampaign = async () => {
    setCompletingCampaign(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratings: ratings.filter((r) => r.rating > 0) }),
      });
      if (res.ok) {
        const data = await res.json() as { summary: CompleteSummary };
        setCompleteSummary(data.summary);
        setShowCompleteModal(false);
        setShowSummary(true);
        await fetchAnalytics();
        toast("Campaign completed! Delivery scores calculated.", "success");
      } else {
        toast("Failed to complete campaign", "error");
      }
    } catch {
      toast("Error completing campaign", "error");
    } finally {
      setCompletingCampaign(false);
    }
  };

  const handleTestPixel = async () => {
    if (!analytics?.kolData[0]?.refCode) {
      setPixelTestLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] No tracking link found — book a KOL first`]);
      return;
    }
    setTestingPixel(true);
    const refCode = analytics.kolData[0].refCode;
    try {
      const res = await fetch(`/api/track/conversion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refCode, eventType: "custom", metadata: { source: "pixel_test" } }),
      });
      const ok = res.ok;
      setPixelTestLog((prev) => [
        `[${new Date().toLocaleTimeString()}] Test conversion fired — ${ok ? "SUCCESS ✓" : "FAILED ✗"}`,
        ...prev,
      ].slice(0, 10));
      if (ok) {
        setTimeout(() => fetchAnalytics(), 800);
      }
    } catch {
      setPixelTestLog((prev) => [`[${new Date().toLocaleTimeString()}] Network error`, ...prev].slice(0, 10));
    } finally {
      setTestingPixel(false);
    }
  };

  const copyPixelScript = (refCode: string | null) => {
    const domain = window.location.origin;
    const script = `<script src="${domain}/api/track/pixel.js"><\/script>\n<script>HypeEngine.trackConversion('signup');<\/script>`;
    navigator.clipboard?.writeText(script);
    setCopiedScript(true);
    toast("Pixel script copied!", "success");
    setTimeout(() => setCopiedScript(false), 2000);
  };

  if (!campaign) {
    return (
      <>
        <Navbar showBack onBack={() => router.replace("/campaigns")} />
        <div className="page-container" style={{ paddingTop: 84, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", marginTop: 40 }}>Campaign not found</p>
        </div>
      </>
    );
  }

  const bookedKols = analytics?.kolData ?? [];
  const hasTracking = bookedKols.length > 0;
  const domain = typeof window !== "undefined" ? window.location.origin : "";
  const pixelScriptTag = `<script src="${domain}/api/track/pixel.js"><\/script>`;
  const pixelConvTag = `<script>HypeEngine.trackConversion('signup');<\/script>`;

  return (
    <>
      <Navbar title={campaign.title} showBack onBack={() => router.replace("/campaigns")} />
      <div className="page-container animate-in" style={{ paddingTop: 84 }}>
        {campaign.status === "draft" && (
          <div style={{ background: canActivate ? "rgba(34,197,94,0.06)" : "rgba(251,172,50,0.08)", border: `1px solid ${canActivate ? "rgba(34,197,94,0.25)" : "rgba(251,172,50,0.3)"}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
              {canActivate
                ? <Rocket size={18} style={{ color: "#22c55e", flexShrink: 0, marginTop: 1 }} />
                : <AlertTriangle size={18} style={{ color: "#FBAC32", flexShrink: 0, marginTop: 1 }} />
              }
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: canActivate ? "#22c55e" : "#FBAC32", marginBottom: 4 }}>
                  {canActivate ? "Ready to activate!" : "Campaign is inactive - not yet funded"}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.5 }}>
                  {canActivate
                    ? <>Your balance <strong style={{ color: "var(--text-body)" }}>${balance.toLocaleString()}</strong> covers the <strong style={{ color: "var(--text-body)" }}>${campaign.totalCredits.toLocaleString()}</strong> budget. Activate now to go live.</>
                    : <>Balance: <strong style={{ color: "#FBAC32" }}>${balance.toLocaleString()}</strong>. You need <strong style={{ color: "#ef4444" }}>${shortfall.toLocaleString()} more</strong> to activate this campaign.</>
                  }
                </p>
              </div>
            </div>
            {canActivate ? (
              <button className="btn-primary" onClick={handleActivate} disabled={activateLoading} style={{ width: "100%", background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                {activateLoading ? "Activating..." : <><Rocket size={15} /> Activate Campaign Now</>}
              </button>
            ) : (
              <button className="btn-primary" onClick={openTopUpModal} style={{ width: "100%" }}>
                <ShoppingCart size={15} /> Add Funds & Activate (${shortfall.toLocaleString()} needed)
              </button>
            )}
          </div>
        )}

        {campaign.status === "active" && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button
              onClick={() => setShowCompleteModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "9px 16px",
                borderRadius: 10, border: "1px solid rgba(139,92,246,0.35)",
                background: "rgba(139,92,246,0.08)", color: "#8b5cf6",
                fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <CheckCircle size={14} /> Complete Campaign
            </button>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <span className={`badge ${campaign.status === "active" ? "badge-green" : campaign.status === "draft" ? "badge-orange" : "badge-gray"}`}>
              {campaign.status === "active" ? "● Active" : campaign.status === "draft" ? "⏸ Draft" : "Completed"}
            </span>
            {campaign.trending && <span className="badge badge-trending">🔥 Trending</span>}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--text-body)", letterSpacing: "-0.02em", marginBottom: 8 }}>
            {campaign.title}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
            {campaign.description}
          </p>
        </div>

        <div className="card-elevated" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>Budget Progress</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: completion >= 80 ? "#FBAC32" : "var(--text-body)" }}>{completion}%</span>
          </div>
          <div className="progress-bar" style={{ height: 8, marginBottom: 8 }}>
            <div className="progress-fill" style={{ width: `${completion}%` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Used: ${(campaign.usedCredits ?? 0).toLocaleString()}</span>
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Budget: ${(campaign.totalCredits ?? 0).toLocaleString()}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total Views", value: formatNumber(campaign.metrics.views), icon: Eye, color: "#8b5cf6" },
            { label: "Likes", value: formatNumber(campaign.metrics.likes), icon: Heart, color: "#ef4444" },
            { label: "Reposts", value: formatNumber(campaign.metrics.reposts), icon: Repeat2, color: "#22c55e" },
            { label: "Replies", value: formatNumber(campaign.metrics.replies), icon: MessageCircle, color: "#3b82f6" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px" }}>
                <Icon size={16} style={{ color: stat.color, marginBottom: 8 }} />
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-body)" }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{stat.label}</div>
              </div>
            );
          })}
        </div>

        {campaign.status !== "draft" && (
          <>
            {/* ── Campaign Performance Analytics ─────────────────────────── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <BarChart2 size={16} style={{ color: "#8b5cf6" }} />
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-body)" }}>Campaign Performance</h3>
                </div>
                <button
                  onClick={fetchAnalytics}
                  disabled={analyticsLoading}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 4 }}
                >
                  <RefreshCw size={13} style={{ animation: analyticsLoading ? "spin 1s linear infinite" : "none" }} />
                </button>
              </div>

              {!analytics || (!analytics.hasData && analytics.pixelStatus === "not_set") ? (
                <div style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, textAlign: "center" }}>
                  <Activity size={24} style={{ color: "var(--text-faint)", margin: "0 auto 10px", opacity: 0.4 }} />
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>No tracking data yet</p>
                  <p style={{ fontSize: 12, color: "var(--text-faint)" }}>Book KOLs to generate tracking links, then install the pixel on your landing page.</p>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 12 }}>
                    {[
                      { label: "Total Clicks", value: analytics.totalClicks.toLocaleString(), sub: `${analytics.uniqueClicks.toLocaleString()} unique`, icon: MousePointerClick, color: "#3b82f6" },
                      { label: "Conversions", value: analytics.totalConversions.toLocaleString(), sub: Object.keys(analytics.conversionsByType).join(", ") || "—", icon: ArrowRightLeft, color: "#22c55e" },
                      { label: "Conv. Rate", value: analytics.ctr !== null ? `${(analytics.ctr * 100).toFixed(1)}%` : "—", sub: "clicks → conversions", icon: TrendingUp, color: "#FBAC32" },
                      { label: "Avg CPA", value: analytics.cpa !== null ? `$${analytics.cpa.toFixed(2)}` : "—", sub: "cost per acquisition", icon: Zap, color: "#8b5cf6" },
                    ].map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <div key={stat.label} style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px" }}>
                          <Icon size={15} style={{ color: stat.color, marginBottom: 8 }} />
                          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-body)" }}>{stat.value}</div>
                          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{stat.label}</div>
                          <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 1, opacity: 0.7 }}>{stat.sub}</div>
                        </div>
                      );
                    })}
                  </div>

                  {analytics.totalConversionValue > 0 && (
                    <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Total Conversion Value</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: "#22c55e" }}>${analytics.totalConversionValue.toFixed(2)}</span>
                    </div>
                  )}

                  {bookedKols.length > 0 && (
                    <div style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-body)" }}>KOL Performance Breakdown</h4>
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                              {["KOL", "Link", "Clicks", "Conv.", "Rate", "CPA"].map((h) => (
                                <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-faint)", whiteSpace: "nowrap", fontSize: 11 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {bookedKols.map((k, i) => {
                              const barWidth = analytics.totalClicks > 0 ? Math.round((k.clicks / analytics.totalClicks) * 100) : 0;
                              return (
                                <tr key={k.kolProfileId} style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-body)" }}>{k.kolName}</div>
                                    <div style={{ fontSize: 11, color: "var(--text-faint)" }}>@{k.twitterHandle}</div>
                                  </td>
                                  <td style={{ padding: "10px 12px" }}>
                                    {k.trackingUrl ? (
                                      <button
                                        onClick={() => { navigator.clipboard?.writeText(k.trackingUrl!); toast("Link copied!", "success"); }}
                                        style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", cursor: "pointer", color: "var(--text-muted)", fontSize: 11, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}
                                      >
                                        <Link2 size={10} /> Copy
                                      </button>
                                    ) : <span style={{ color: "var(--text-faint)" }}>—</span>}
                                  </td>
                                  <td style={{ padding: "10px 12px" }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-body)" }}>{k.clicks}</div>
                                    <div style={{ height: 3, width: 48, background: "var(--border)", borderRadius: 999, marginTop: 4 }}>
                                      <div style={{ height: "100%", width: `${barWidth}%`, background: "#3b82f6", borderRadius: 999 }} />
                                    </div>
                                  </td>
                                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-body)" }}>{k.conversions}</td>
                                  <td style={{ padding: "10px 12px", color: k.convRate !== null ? "#22c55e" : "var(--text-faint)" }}>
                                    {k.convRate !== null ? `${(k.convRate * 100).toFixed(1)}%` : "—"}
                                  </td>
                                  <td style={{ padding: "10px 12px", color: k.cpa !== null ? "#FBAC32" : "var(--text-faint)" }}>
                                    {k.cpa !== null ? `$${k.cpa.toFixed(2)}` : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Tracking Setup ──────────────────────────────────────────── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Activity size={16} style={{ color: "#3b82f6" }} />
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-body)" }}>Tracking Setup</h3>
                {analytics && <PixelStatusDot status={analytics.pixelStatus} />}
              </div>

              <div className="card-elevated" style={{ padding: 16, marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
                  1. Add this to your landing page &lt;head&gt;:
                </p>
                <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 8, padding: 12, fontFamily: "monospace", fontSize: 11, color: "#22c55e", marginBottom: 10, wordBreak: "break-all", lineHeight: 1.6 }}>
                  {pixelScriptTag}
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
                  2. Call this on your conversion page (e.g. after sign-up):
                </p>
                <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 8, padding: 12, fontFamily: "monospace", fontSize: 11, color: "#FBAC32", marginBottom: 12, wordBreak: "break-all", lineHeight: 1.6 }}>
                  {pixelConvTag}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => copyPixelScript(analytics?.kolData[0]?.refCode ?? null)}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card-glass)", color: "var(--text-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <Copy size={12} /> {copiedScript ? "Copied!" : "Copy Full Script"}
                  </button>
                  <button
                    onClick={handleTestPixel}
                    disabled={testingPixel}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px 0", borderRadius: 8, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.06)", color: "#3b82f6", fontSize: 12, fontWeight: 700, cursor: testingPixel ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: testingPixel ? 0.6 : 1 }}
                  >
                    <Activity size={12} /> {testingPixel ? "Testing..." : "Test Pixel"}
                  </button>
                </div>
              </div>

              {pixelTestLog.length > 0 && (
                <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Live Event Log</p>
                  {pixelTestLog.map((entry, i) => (
                    <div key={i} style={{ fontSize: 11, fontFamily: "monospace", color: entry.includes("SUCCESS") ? "#22c55e" : entry.includes("FAIL") ? "#ef4444" : "var(--text-muted)", lineHeight: 1.7 }}>
                      {entry}
                    </div>
                  ))}
                </div>
              )}

              {analytics?.recentEvents && analytics.recentEvents.length > 0 && (
                <div style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginTop: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10 }}>Recent Events (last 10)</p>
                  {analytics.recentEvents.map((ev, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "2px 7px",
                          background: ev.eventType === "signup" ? "rgba(34,197,94,0.1)" : ev.eventType === "deposit" ? "rgba(251,172,50,0.1)" : "rgba(139,92,246,0.1)",
                          color: ev.eventType === "signup" ? "#22c55e" : ev.eventType === "deposit" ? "#FBAC32" : "#8b5cf6",
                          border: `1px solid ${ev.eventType === "signup" ? "rgba(34,197,94,0.2)" : ev.eventType === "deposit" ? "rgba(251,172,50,0.2)" : "rgba(139,92,246,0.2)"}`,
                        }}>
                          {ev.eventType}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>via {ev.refCode}</span>
                        {ev.eventValue && <span style={{ fontSize: 11, color: "#22c55e" }}>${ev.eventValue}</span>}
                      </div>
                      <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
                        {ev.timestamp ? timeAgo(ev.timestamp) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="card-elevated" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-body)" }}>Post Template</h3>
            <span className="badge badge-orange">{campaign.hashtag}</span>
          </div>
          <div style={{ background: "var(--bg-card-glass)", borderRadius: 10, padding: 14, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 10, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {campaign.postTemplate}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="badge badge-orange">{campaign.hashtag}</span>
            <button
              onClick={() => { navigator.clipboard?.writeText(campaign.postTemplate); toast("Post template copied!", "success"); }}
              style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}
            >
              <Copy size={12} /> Copy
            </button>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-body)" }}>Posts ({campaignPosts.length})</h3>
          </div>
          {campaignPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", color: "var(--text-faint)", fontSize: 14 }}>
              No posts yet. KOLs will appear here once they post.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {campaignPosts.map((post) => (
                <div key={post.id} style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #FBAC32, #F29236)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#11152C" }}>
                        {(post.kolName ?? "K").charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-body)" }}>{post.kolName ?? "Unknown KOL"}</div>
                        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{timeAgo(post.createdAt)}</div>
                      </div>
                    </div>
                    <span
                      className={`badge ${post.status === "approved" ? "badge-green" : post.status === "rejected" ? "" : "badge-orange"}`}
                      style={post.status === "rejected" ? { background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700 } : {}}
                    >
                      {post.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    {[
                      { icon: Eye, value: formatNumber(post.metrics.views), label: "views" },
                      { icon: Heart, value: formatNumber(post.metrics.likes), label: "likes" },
                      { icon: TrendingUp, value: `${post.metrics.engagement}%`, label: "engagement" },
                      { icon: Zap, value: `$${post.creditsEarned}`, label: "earned", color: "#FBAC32" },
                    ].map((m) => (
                      <div key={m.label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: m.color || "var(--text-muted)" }}>{m.value}</div>
                        <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {campaign.status !== "draft" && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={16} style={{ color: "#FBAC32" }} />
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-body)" }}>Recommended KOLs</h3>
                {matches.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 999, padding: "2px 8px" }}>
                    {matches.length}
                  </span>
                )}
              </div>
              <button
                onClick={handleRefreshMatches}
                disabled={refreshingMatches}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card-glass)", color: "var(--text-muted)", fontSize: 12, fontWeight: 700, cursor: refreshingMatches ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: refreshingMatches ? 0.6 : 1 }}
              >
                <RefreshCw size={13} style={{ animation: refreshingMatches ? "spin 1s linear infinite" : "none" }} />
                {refreshingMatches ? "Finding..." : "Refresh Matches"}
              </button>
            </div>

            {matchesLoading ? (
              <div style={{ textAlign: "center", padding: "30px", color: "var(--text-faint)", fontSize: 14 }}>
                <Users size={28} style={{ margin: "0 auto 10px", opacity: 0.3 }} />
                <p>Loading recommendations...</p>
              </div>
            ) : matches.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "var(--text-faint)", fontSize: 14, background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 14 }}>
                <Users size={28} style={{ margin: "0 auto 10px", opacity: 0.3 }} />
                <p style={{ fontWeight: 700, marginBottom: 4 }}>No recommendations yet</p>
                <p style={{ fontSize: 13 }}>Click &quot;Refresh Matches&quot; to find the best KOLs for this campaign</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {matches.map((match) => (
                  <KolMatchCard
                    key={match.matchId}
                    match={match}
                    onBook={handleBookKol}
                    onViewProfile={setSelectedKol}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <KolProfileModal
        match={selectedKol}
        campaignId={id}
        isOpen={!!selectedKol}
        onClose={() => setSelectedKol(null)}
        onRefresh={fetchMatches}
      />

      {/* ── Complete Campaign Modal ──────────────────────────────── */}
      <Modal isOpen={showCompleteModal} onClose={() => !completingCampaign && setShowCompleteModal(false)} title="Complete Campaign">
        <div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
            Rate each KOL's performance. Ratings feed into the matching engine to improve future recommendations.
          </p>

          {ratings.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text-faint)", fontSize: 14 }}>
              No booked KOLs found. Delivery scores will still be calculated from tracking data.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              {ratings.map((r, i) => (
                <div key={r.kolProfileId} style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-body)" }}>{r.kolName}</div>
                      {analytics?.kolData.find((k) => k.kolProfileId === r.kolProfileId) && (() => {
                        const kd = analytics.kolData.find((k) => k.kolProfileId === r.kolProfileId)!;
                        return (
                          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                            {kd.clicks} clicks · {kd.conversions} conversions
                          </div>
                        );
                      })()}
                    </div>
                    <StarRating
                      value={r.rating}
                      onChange={(v) => setRatings((prev) => prev.map((item, idx) => idx === i ? { ...item, rating: v } : item))}
                    />
                  </div>
                  <input
                    className="input-field"
                    placeholder="Optional feedback..."
                    value={r.feedback}
                    onChange={(e) => setRatings((prev) => prev.map((item, idx) => idx === i ? { ...item, feedback: e.target.value } : item))}
                    style={{ fontSize: 12 }}
                  />
                </div>
              ))}
            </div>
          )}

          <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12, color: "var(--text-faint)", lineHeight: 1.5 }}>
            After completing: delivery scores are calculated, KOL profiles are updated with historical CPA data, and future match scores will reflect this campaign's results.
          </div>

          <button
            className="btn-primary"
            onClick={handleCompleteCampaign}
            disabled={completingCampaign}
            style={{ width: "100%", background: "linear-gradient(135deg, #8b5cf6, #6d28d9)" }}
          >
            <CheckCircle size={16} />
            {completingCampaign ? "Calculating scores..." : "Complete Campaign & Score Delivery"}
          </button>
        </div>
      </Modal>

      {/* ── Completion Summary Modal ─────────────────────────────── */}
      <Modal isOpen={showSummary} onClose={() => setShowSummary(false)} title="Campaign Complete!">
        {completeSummary && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <CheckCircle size={40} style={{ color: "#22c55e", margin: "0 auto 10px" }} />
              <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-body)" }}>Campaign Wrapped Up</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Delivery scores have been calculated and KOL profiles updated.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Total Conversions", value: completeSummary.totalConversions.toLocaleString(), color: "#22c55e" },
                { label: "Conversion Value", value: `$${completeSummary.totalConversionValue.toFixed(2)}`, color: "#FBAC32" },
                { label: "Avg Delivery Score", value: completeSummary.avgDeliveryScore !== null ? `${completeSummary.avgDeliveryScore.toFixed(0)}/100` : "—", color: "#8b5cf6" },
                { label: "KOLs Scored", value: completeSummary.kolCount.toLocaleString(), color: "var(--text-body)" },
              ].map((s) => (
                <div key={s.label} style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <button className="btn-primary" onClick={() => setShowSummary(false)} style={{ width: "100%" }}>
              Done
            </button>
          </div>
        )}
      </Modal>

      {/* ── Top-Up Modal ─────────────────────────────────────────── */}
      <Modal isOpen={showTopUpModal} onClose={() => !topUpLoading && setShowTopUpModal(false)} title="Add Funds">
        <div>
          <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 14, marginTop: -12 }}>
            Balance: <strong style={{ color: "#FBAC32" }}>${balance.toLocaleString()}</strong>
            {shortfall > 0 && <> · Need <strong style={{ color: "#ef4444" }}>${shortfall.toLocaleString()} more</strong> to activate</>}
          </p>

          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Select Amount
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {TOPUP_AMOUNTS.map((amt, i) => {
              const active = topUpCustom === "" && selectedPkg === i;
              const coversShortfall = amt >= shortfall && shortfall > 0;
              return (
                <button
                  key={i}
                  onClick={() => { setSelectedPkg(i); setTopUpCustom(""); }}
                  style={{ padding: "12px 10px", borderRadius: 12, border: active ? "2px solid #FBAC32" : "1px solid var(--input-border)", background: active ? "rgba(251,172,50,0.08)" : "var(--bg-card-glass)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", textAlign: "left", position: "relative" }}
                >
                  <div style={{ fontSize: 17, fontWeight: 900, color: active ? "#FBAC32" : "var(--text-body)" }}>
                    ${amt.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>
                    ≈ {formatNumber(estimateReach(amt))} reach
                  </div>
                  {coversShortfall && (
                    <span style={{ position: "absolute", top: 6, right: 8, fontSize: 9, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 999, padding: "1px 5px" }}>
                      ✓ Covers
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Or Custom Amount
          </p>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18, fontWeight: 700, color: "var(--text-muted)" }}>$</span>
            <input
              className="input-field"
              type="number"
              placeholder="100"
              min="100"
              value={topUpCustom}
              onChange={(e) => setTopUpCustom(e.target.value)}
              style={{ paddingLeft: 28, fontSize: 16, fontWeight: 700, border: topUpCustom ? "1px solid #FBAC32" : undefined }}
            />
          </div>

          {getTopUpAmount() > 0 && (
            <div style={{ background: "rgba(251,172,50,0.06)", border: "1px solid rgba(251,172,50,0.15)", borderRadius: 10, padding: "8px 12px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
              <span style={{ color: "var(--text-faint)" }}>New balance after deposit</span>
              <span style={{ fontWeight: 900, color: "#FBAC32" }}>
                ${(balance + getTopUpAmount()).toLocaleString()}
                {balance + getTopUpAmount() >= (campaign?.totalCredits ?? 0) && <span style={{ color: "#22c55e", marginLeft: 6 }}>✓ Ready!</span>}
              </span>
            </div>
          )}

          <button className="btn-primary" onClick={handleTopUp} disabled={topUpLoading || getTopUpAmount() <= 0} style={{ width: "100%" }}>
            <ShoppingCart size={16} />
            {topUpLoading ? "Processing..." : `Add $${getTopUpAmount() > 0 ? getTopUpAmount().toLocaleString() : "—"} to Balance`}
          </button>
        </div>
      </Modal>
    </>
  );
}
