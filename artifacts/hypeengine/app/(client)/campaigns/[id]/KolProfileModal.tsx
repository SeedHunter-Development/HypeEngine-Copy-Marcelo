"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Users, MapPin, Globe, Twitter, Zap, Star, BarChart2, RefreshCw, Activity } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { MatchRow } from "./KolMatchCard";

interface SignalDetail {
  score: number;
  weight: number;
  label: string;
}

interface AuthenticityResult {
  authenticityScore: number;
  details: string;
  signalBreakdown: {
    engagementRate: SignalDetail;
    consistency: SignalDetail;
    replyQuality: SignalDetail;
    followerSample: SignalDetail;
    growthPattern: SignalDetail;
  };
}

interface PriceBreakdown {
  finalPrice: number;
  breakdown: {
    base: number;
    followerTier: number;
    performanceMultiplier: number;
    matchModifier: number;
    reliabilityModifier?: number;
  };
  kolHistory: {
    campaignsCompleted: number;
    avgDeliveryScore: number | null;
    avgCpa: number | null;
    postReliabilityRate?: number | null;
  };
}

const SIGNAL_NAMES: Record<string, string> = {
  engagementRate: "Engagement Rate",
  consistency: "Consistency",
  replyQuality: "Reply Quality",
  followerSample: "Follower Sample",
  growthPattern: "Growth Pattern",
};

function AuthSignalBar({ name, signal }: { name: string; signal: SignalDetail }) {
  const color = signal.score >= 75 ? "#22c55e" : signal.score >= 50 ? "#FBAC32" : "#ef4444";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
            {SIGNAL_NAMES[name] ?? name}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: 6 }}>
            ×{signal.weight}%
          </span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{signal.score}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: "var(--border)" }}>
        <div style={{ height: "100%", borderRadius: 999, background: color, width: `${signal.score}%`, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>{signal.label}</div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: color ?? "var(--text-body)" }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function VerticalBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-body)" }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--border)" }}>
        <div style={{ height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #8b5cf6, #a78bfa)", width: `${pct}%`, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

export default function KolProfileModal({
  match,
  campaignId,
  isOpen,
  onClose,
  onRefresh,
}: {
  match: MatchRow | null;
  campaignId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const [pricing, setPricing] = useState<PriceBreakdown | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [authData, setAuthData] = useState<AuthenticityResult | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(false);

  useEffect(() => {
    if (!isOpen || !match) return;
    setLoadingPrice(true);
    fetch(`/api/kol/pricing?kolProfileId=${match.kolProfileId}&campaignId=${campaignId}`)
      .then((r) => r.json())
      .then((data) => setPricing(data))
      .catch(() => setPricing(null))
      .finally(() => setLoadingPrice(false));

    setLoadingAuth(true);
    fetch(`/api/kol/authenticity?kolProfileId=${match.kolProfileId}`)
      .then((r) => r.json())
      .then((data: AuthenticityResult) => setAuthData(data))
      .catch(() => setAuthData(null))
      .finally(() => setLoadingAuth(false));
  }, [isOpen, match, campaignId]);

  const handleRefreshData = async () => {
    if (!match?.kolProfileId) return;
    setRefreshing(true);
    setRefreshStatus(null);
    try {
      const res = await fetch("/api/admin/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kolProfileId: match.kolProfileId }),
      });
      const data = await res.json() as { success: boolean; steps?: Record<string, string> };
      if (data.success) {
        const steps = data.steps ? Object.entries(data.steps as Record<string, string>)
          .filter(([, v]) => v === "ok")
          .map(([k]) => k)
          .join(", ") : "";
        setRefreshStatus(steps ? `Updated: ${steps}` : "Data refreshed");
        onRefresh?.();
      } else {
        setRefreshStatus("Refresh failed - check API keys");
      }
    } catch {
      setRefreshStatus("Network error during refresh");
    } finally {
      setRefreshing(false);
    }
  };

  if (!match) return null;

  const score = match.matchScore ?? 0;
  const scoreColor = score >= 75 ? "#22c55e" : score >= 50 ? "#FBAC32" : "#ef4444";
  const authColor = (match.authenticityScore ?? 0) >= 70 ? "#22c55e" : (match.authenticityScore ?? 0) >= 40 ? "#FBAC32" : "#ef4444";
  const verticals = match.contentVerticals ?? {};
  const langDist = match.replyLangDist ?? {};
  const topVerticals = Object.entries(verticals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topLangs = Object.entries(langDist).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="KOL Profile">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #FBAC32, #F29236)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: "#11152C", flexShrink: 0 }}>
            {(match.kolName || match.twitterHandle).charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: "var(--text-body)", marginBottom: 2 }}>{match.kolName}</h3>
            <a href={`https://twitter.com/${match.twitterHandle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#1da1f2", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
              <Twitter size={13} /> @{match.twitterHandle.replace(/^@/, "")}
            </a>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: scoreColor }}>{score.toFixed(0)}%</div>
              <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 700 }}>MATCH SCORE</div>
            </div>
            <button
              onClick={handleRefreshData}
              disabled={refreshing}
              title="Re-run data enrichment pipeline for this KOL"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-card-glass)",
                color: "var(--text-muted)",
                fontSize: 11,
                fontWeight: 700,
                cursor: refreshing ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: refreshing ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              <RefreshCw size={11} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
              {refreshing ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>
        </div>

        {refreshStatus && (
          <div style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: refreshStatus.includes("fail") || refreshStatus.includes("error")
              ? "rgba(239,68,68,0.08)"
              : "rgba(34,197,94,0.08)",
            border: refreshStatus.includes("fail") || refreshStatus.includes("error")
              ? "1px solid rgba(239,68,68,0.2)"
              : "1px solid rgba(34,197,94,0.2)",
            fontSize: 12,
            color: refreshStatus.includes("fail") || refreshStatus.includes("error") ? "#ef4444" : "#22c55e",
            fontWeight: 600,
          }}>
            {refreshStatus}
          </div>
        )}

        {match.userBio && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>{match.userBio}</p>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {match.userCountry && (
            <span style={{ fontSize: 12, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={12} /> {match.userCountry}
            </span>
          )}
          {match.primaryLanguage && (
            <span style={{ fontSize: 12, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 4 }}>
              <Globe size={12} /> {match.primaryLanguage}
            </span>
          )}
          <span style={{ fontSize: 12, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 4 }}>
            <Users size={12} /> {formatNumber(match.twitterFollowers)} followers
          </span>
        </div>

        {match.niches && match.niches.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {match.niches.map((n) => (
              <span key={n} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#a78bfa" }}>{n}</span>
            ))}
          </div>
        )}

        <div>
          <p style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            <BarChart2 size={12} style={{ display: "inline", marginRight: 5 }} />
            Engagement Stats
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            <StatBox label="Avg Likes" value={match.avgLikes != null ? formatNumber(Math.round(match.avgLikes)) : "—"} color="#ef4444" />
            <StatBox label="Avg RT" value={match.avgRetweets != null ? formatNumber(Math.round(match.avgRetweets)) : "—"} color="#22c55e" />
            <StatBox label="Avg Replies" value={match.avgReplies != null ? formatNumber(Math.round(match.avgReplies)) : "—"} color="#3b82f6" />
            <StatBox label="Eng Rate" value={match.engagementRate != null ? `${match.engagementRate.toFixed(1)}%` : "—"} color="#FBAC32" />
          </div>
        </div>

        <div style={{ background: "var(--bg-card-glass)", border: `1px solid ${authColor === "#22c55e" ? "rgba(34,197,94,0.25)" : authColor === "#FBAC32" ? "rgba(251,172,50,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Activity size={14} style={{ color: authColor }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Bot Detection · Authenticity
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              {loadingAuth ? (
                <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Computing...</span>
              ) : authData ? (
                <div>
                  <span style={{ fontSize: 26, fontWeight: 900, color: authColor }}>{authData.authenticityScore}%</span>
                </div>
              ) : (
                <span style={{ fontSize: 22, fontWeight: 900, color: authColor }}>{match.authenticityScore?.toFixed(0) ?? "—"}%</span>
              )}
            </div>
          </div>

          {authData && (
            <>
              <p style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 12, lineHeight: 1.5 }}>
                {authData.details}
              </p>
              <div>
                {Object.entries(authData.signalBreakdown).map(([name, signal]) => (
                  <AuthSignalBar key={name} name={name} signal={signal} />
                ))}
              </div>
            </>
          )}

          {!loadingAuth && !authData && (
            <p style={{ fontSize: 11, color: "var(--text-faint)" }}>
              Run data enrichment to compute signal breakdown.
            </p>
          )}
        </div>

        <div style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Star size={14} style={{ color: "#FBAC32" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>TwitterScore</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#FBAC32" }}>{match.twitterScoreValue?.toFixed(0) ?? "—"}</div>
        </div>

        {topVerticals.length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Content Verticals</p>
            {topVerticals.map(([key, val]) => (
              <VerticalBar key={key} label={key} value={Number(val)} />
            ))}
          </div>
        )}

        {topLangs.length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Audience Language Distribution</p>
            {topLangs.map(([lang, pct]) => (
              <VerticalBar key={lang} label={lang.toUpperCase()} value={Number(pct)} />
            ))}
          </div>
        )}

        <div style={{ background: "rgba(251,172,50,0.06)", border: "1px solid rgba(251,172,50,0.2)", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <Zap size={14} style={{ color: "#FBAC32" }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Price Breakdown</span>
          </div>
          {loadingPrice ? (
            <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Calculating...</p>
          ) : pricing ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--text-faint)" }}>Estimated Price / Post</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#FBAC32" }}>${pricing.finalPrice}</span>
              </div>
              {[
                { label: "Base (max budget)", value: `$${pricing.breakdown.base}` },
                { label: "Follower tier", value: `×${pricing.breakdown.followerTier.toFixed(1)}` },
                { label: "Performance", value: `×${pricing.breakdown.performanceMultiplier.toFixed(2)}` },
                { label: "Match modifier", value: `×${pricing.breakdown.matchModifier.toFixed(2)}` },
                ...(pricing.breakdown.reliabilityModifier != null && pricing.breakdown.reliabilityModifier < 1.0
                  ? [{ label: "Reliability penalty", value: `×${pricing.breakdown.reliabilityModifier.toFixed(2)}`, warn: true }]
                  : []),
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ fontSize: 12, color: (row as { warn?: boolean }).warn ? "#f97316" : "var(--text-faint)" }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: (row as { warn?: boolean }).warn ? "#f97316" : "var(--text-body)" }}>{row.value}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 10, paddingTop: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Campaign History</p>
                {[
                  { label: "Campaigns Completed", value: String(pricing.kolHistory.campaignsCompleted) },
                  { label: "Avg Delivery Score", value: pricing.kolHistory.avgDeliveryScore != null ? `${pricing.kolHistory.avgDeliveryScore.toFixed(1)}/100` : "No data" },
                  { label: "Avg CPA (this goal)", value: pricing.kolHistory.avgCpa != null ? `$${pricing.kolHistory.avgCpa.toFixed(2)}` : "No data" },
                  { label: "Post Reliability", value: pricing.kolHistory.postReliabilityRate != null ? `${Math.round(pricing.kolHistory.postReliabilityRate * 100)}%` : "New KOL" },
                ].map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                    <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-body)" }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-faint)" }}>
              Price: <strong style={{ color: "#FBAC32" }}>${match.priceAgreed ?? "—"}</strong>/post
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
