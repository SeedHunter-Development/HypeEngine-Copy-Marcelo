"use client";

import { useState } from "react";
import { Users, MapPin, Globe, Zap, Star, Info, ShieldCheck } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export interface MatchRow {
  matchId: string;
  kolProfileId: string;
  userId: string;
  kolName: string;
  twitterHandle: string;
  twitterFollowers: number;
  niches: string[];
  userCountry: string | null;
  primaryLanguage: string | null;
  matchScore: number | null;
  matchBreakdown: Record<string, number> | null;
  priceAgreed: number | null;
  status: string;
  engagementRate: number | null;
  authenticityScore: number | null;
  twitterScoreValue: number | null;
  campaignsCompleted: number | null;
  userBio: string | null;
  avgLikes: number | null;
  avgRetweets: number | null;
  avgReplies: number | null;
  contentVerticals: Record<string, number> | null;
  replyLangDist: Record<string, number> | null;
  followerCryptoPct: number | null;
  clientSatisfaction: number | null;
  postReliabilityRate: number | null;
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#FBAC32" : "#ef4444";
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "capitalize", fontWeight: 600 }}>
          {label.replace(/([A-Z])/g, " $1").trim()}
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, color }}>{score}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: "var(--border)" }}>
        <div style={{ height: "100%", borderRadius: 999, background: color, width: `${score}%`, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function BreakdownTooltip({ breakdown }: { breakdown: Record<string, number> }) {
  const top3 = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div style={{
      position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
      background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
      padding: "10px 14px", width: 220, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        Top Match Dimensions
      </p>
      {top3.map(([key, val]) => (
        <ScoreBar key={key} score={val} label={key} />
      ))}
    </div>
  );
}

function AuthBadge({ score }: { score: number }) {
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#FBAC32" : "#ef4444";
  const bg = score >= 75 ? "rgba(34,197,94,0.1)" : score >= 50 ? "rgba(251,172,50,0.1)" : "rgba(239,68,68,0.1)";
  const border = score >= 75 ? "rgba(34,197,94,0.25)" : score >= 50 ? "rgba(251,172,50,0.25)" : "rgba(239,68,68,0.25)";
  const label = score >= 75 ? "Authentic" : score >= 50 ? "Mixed" : "Flagged";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color, background: bg, border: `1px solid ${border}`,
      borderRadius: 999, padding: "2px 7px", display: "inline-flex", alignItems: "center", gap: 3,
    }}>
      <span style={{ fontSize: 9 }}>●</span> {score}% {label}
    </span>
  );
}

function ReliabilityBadge({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color = pct >= 95 ? "#22c55e" : pct >= 85 ? "#FBAC32" : pct >= 70 ? "#f97316" : "#ef4444";
  const bg = pct >= 95 ? "rgba(34,197,94,0.08)" : pct >= 85 ? "rgba(251,172,50,0.08)" : pct >= 70 ? "rgba(249,115,22,0.08)" : "rgba(239,68,68,0.08)";
  const border = pct >= 95 ? "rgba(34,197,94,0.2)" : pct >= 85 ? "rgba(251,172,50,0.2)" : pct >= 70 ? "rgba(249,115,22,0.2)" : "rgba(239,68,68,0.2)";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color, background: bg, border: `1px solid ${border}`,
      borderRadius: 999, padding: "2px 7px", display: "inline-flex", alignItems: "center", gap: 3,
    }}>
      <ShieldCheck size={9} /> {pct}% reliable
    </span>
  );
}

export default function KolMatchCard({
  match,
  onBook,
  onViewProfile,
}: {
  match: MatchRow;
  onBook: (matchId: string) => Promise<void>;
  onViewProfile: (match: MatchRow) => void;
}) {
  const [booking, setBooking] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const score = match.matchScore ?? 0;
  const scoreColor = score >= 75 ? "#22c55e" : score >= 50 ? "#FBAC32" : "#ef4444";
  const isBooked = match.status === "booked" || match.status === "active";

  const handleBook = async () => {
    setBooking(true);
    try {
      await onBook(match.matchId);
    } finally {
      setBooking(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-card-glass)",
        border: isBooked ? "1px solid rgba(34,197,94,0.3)" : "1px solid var(--border)",
        borderRadius: 16,
        padding: 16,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #FBAC32, #F29236)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 900, color: "#11152C", cursor: "pointer",
          }}
          onClick={() => onViewProfile(match)}
        >
          {(match.kolName || match.twitterHandle).charAt(0).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => onViewProfile(match)}
              style={{ fontSize: 15, fontWeight: 800, color: "var(--text-body)", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
            >
              {match.kolName || match.twitterHandle}
            </button>
            {isBooked && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 999, padding: "2px 8px" }}>
                ✓ Booked
              </span>
            )}
          </div>
          <a
            href={`https://twitter.com/${match.twitterHandle.replace(/^@/, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}
          >
            @{match.twitterHandle.replace(/^@/, "")}
          </a>

          <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 4 }}>
              <Users size={11} /> {formatNumber(match.twitterFollowers)}
            </span>
            {match.userCountry && (
              <span style={{ fontSize: 12, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={11} /> {match.userCountry}
              </span>
            )}
            {match.primaryLanguage && (
              <span style={{ fontSize: 12, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 4 }}>
                <Globe size={11} /> {match.primaryLanguage}
              </span>
            )}
          </div>

          {match.niches && match.niches.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              {match.niches.slice(0, 4).map((n) => (
                <span key={n} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#a78bfa" }}>
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", justifyContent: "flex-end" }}
              onClick={() => setShowBreakdown(!showBreakdown)}
            >
              <span style={{ fontSize: 22, fontWeight: 900, color: scoreColor }}>{score.toFixed(0)}%</span>
              <Info size={13} style={{ color: "var(--text-faint)" }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--text-faint)", textAlign: "right", marginTop: 2 }}>match score</div>

            <div style={{ height: 4, borderRadius: 999, background: "var(--border)", marginTop: 4, width: 70, marginLeft: "auto" }}>
              <div style={{ height: "100%", borderRadius: 999, background: scoreColor, width: `${score}%`, transition: "width 0.4s ease" }} />
            </div>

            {match.authenticityScore != null && (
              <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
                <AuthBadge score={match.authenticityScore} />
              </div>
            )}

            {match.postReliabilityRate != null && (
              <div style={{ marginTop: 4, display: "flex", justifyContent: "flex-end" }}>
                <ReliabilityBadge rate={match.postReliabilityRate} />
              </div>
            )}

            {showBreakdown && match.matchBreakdown && (
              <BreakdownTooltip breakdown={match.matchBreakdown} />
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Zap size={14} style={{ color: "#FBAC32" }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: "#FBAC32" }}>
            ${match.priceAgreed ?? "—"}<span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 400 }}>/post</span>
          </span>
        </div>

        {!isBooked ? (
          <button
            onClick={handleBook}
            disabled={booking}
            style={{
              padding: "8px 18px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #FBAC32, #F29236)",
              color: "#11152C", fontSize: 13, fontWeight: 800, cursor: booking ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: booking ? 0.7 : 1, transition: "opacity 0.2s",
            }}
          >
            {booking ? "Booking..." : "Book KOL"}
          </button>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", display: "flex", alignItems: "center", gap: 5 }}>
            <Star size={13} /> Booked
          </span>
        )}
      </div>

      {showBreakdown && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 40 }}
          onClick={() => setShowBreakdown(false)}
        />
      )}
    </div>
  );
}
