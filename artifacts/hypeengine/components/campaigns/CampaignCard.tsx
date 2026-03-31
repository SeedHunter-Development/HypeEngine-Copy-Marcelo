"use client";

import Link from "next/link";
import { Campaign } from "@/lib/types";
import {
  getCompletionPercent,
  calculateKolReward,
  calculateMatchScore,
  matchScoreColor,
  formatNumber,
  KolMatchProfile,
} from "@/lib/utils";

import { ArrowRight, Target, CheckCircle, RefreshCw } from "lucide-react";

function calcCPE(usedCredits: number, likes: number) {
  return likes > 0 ? `$${(usedCredits / likes).toFixed(2)}` : "$—";
}
function calcCPM(usedCredits: number, views: number) {
  return views > 0 ? `$${((usedCredits / views) * 1000).toFixed(2)}` : "$—";
}

interface PostStatus {
  postsToday: number;
  totalPosts: number;
}

interface CampaignCardProps {
  campaign: Campaign;
  kolFollowers?: number;
  kolProfile?: KolMatchProfile;
  href?: string;
  variant?: "kol" | "client";
  postStatus?: PostStatus;
  dbMatchScore?: number | null;
}

const XIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
  </svg>
);

const pill = (content: React.ReactNode, extraStyle?: React.CSSProperties, key?: string) => (
  <span key={key} style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    fontSize: 11, fontWeight: 600,
    borderRadius: 999, padding: "2px 8px",
    whiteSpace: "nowrap" as const,
    ...extraStyle,
  }}>
    {content}
  </span>
);

export default function CampaignCard({
  campaign,
  kolFollowers = 50000,
  kolProfile,
  href,
  variant = "kol",
  postStatus,
  dbMatchScore,
}: CampaignCardProps) {
  const completion = getCompletionPercent(campaign.usedCredits, campaign.totalCredits);

  const hasCampaignTargeting =
    (campaign.targetNiches?.length ?? 0) > 0 ||
    (campaign.targetCountries?.length ?? 0) > 0 ||
    (campaign.targetLanguages?.length ?? 0) > 0;

  const matchScore = dbMatchScore != null
    ? dbMatchScore / 100
    : kolProfile && hasCampaignTargeting
      ? calculateMatchScore(campaign, kolProfile)
      : null;

  const matchPct = matchScore !== null ? Math.round(matchScore * 100) : null;
  const mColor = matchScore !== null ? matchScoreColor(matchScore) : "#8b5cf6";

  const reward = campaign.calculatedPrice ?? calculateKolReward(
    campaign.maxPricePerPost,
    kolFollowers,
    matchScore ?? 1.0
  );

  const targetLanguage = campaign.targetLanguages?.[0] ?? null;

  const doneForDay = !!postStatus && postStatus.postsToday >= campaign.maxPostsPerKolPerDay;
  const postedSome = !!postStatus && postStatus.postsToday > 0 && !doneForDay;
  const slotsLeft = campaign.maxPostsPerKolPerDay - (postStatus?.postsToday ?? 0);

  function renderPostButton() {
    if (!href) return null;

    if (doneForDay) {
      return (
        <div style={{
          width: "100%", padding: "10px 0", borderRadius: 10,
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          color: "#22c55e", fontSize: 13, fontWeight: 700,
        }}>
          <CheckCircle size={13} /> Done for today · back tomorrow
        </div>
      );
    }

    if (postedSome) {
      return (
        <div style={{
          width: "100%", padding: "10px 0", borderRadius: 10,
          background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          color: "#a78bfa", fontSize: 13, fontWeight: 700,
        }}>
          <RefreshCw size={12} />
          Post Again
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: "rgba(139,92,246,0.2)", borderRadius: 999,
            padding: "2px 6px", color: "#c4b5fd",
          }}>
            {slotsLeft} slot{slotsLeft !== 1 ? "s" : ""} left today
          </span>
        </div>
      );
    }

    return (
      <div style={{
        width: "100%", padding: "10px 0", borderRadius: 10,
        background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        color: "#a78bfa", fontSize: 13, fontWeight: 700,
      }}>
        Post Now <ArrowRight size={13} />
      </div>
    );
  }

  const card = (
    <div
      style={{
        background: "var(--bg-card-glass)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "14px 14px 14px 14px",
        cursor: href ? "pointer" : "default",
        transition: "border-color 0.18s",
      }}
      onMouseEnter={(e) => {
        if (href) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(251,172,50,0.3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
      }}
    >
      {variant === "kol" ? (
        <>
          {/* Top section: content left + reward right — share the same row */}
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>

            {/* Left: title + description tight together */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                fontSize: 15, fontWeight: 800, color: "var(--text-body)",
                marginBottom: 4, lineHeight: 1.25,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {campaign.title}
              </h3>
              <p style={{
                fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.45,
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical", overflow: "hidden",
                margin: 0,
              }}>
                {campaign.description}
              </p>
            </div>

            {/* Right: reward box + match badge */}
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
              <div style={{
                background: "rgba(251,172,50,0.1)",
                border: "1px solid rgba(251,172,50,0.28)",
                borderRadius: 10, padding: "6px 10px",
                textAlign: "center", minWidth: 64,
              }}>
                <div style={{ fontSize: 9.5, color: "rgba(251,172,50,0.65)", fontWeight: 700, marginBottom: 1, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Reward
                </div>
                <div style={{ fontSize: 19, fontWeight: 900, color: "#FBAC32", lineHeight: 1 }}>
                  ${reward}
                </div>
              </div>
              {matchPct !== null && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  fontSize: 10.5, fontWeight: 800,
                  color: mColor, background: `${mColor}15`,
                  border: `1.5px solid ${mColor}38`,
                  borderRadius: 999, padding: "2px 7px",
                }}>
                  <Target size={8} /> {matchPct}% match
                </span>
              )}
            </div>
          </div>

          {/* Pills: platform + niches + language */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {pill(<><XIcon /> Twitter</>, {
              color: "var(--text-muted)",
              background: "var(--bg-card-glass)",
              border: "1px solid var(--border)",
            })}
            {campaign.targetNiches?.map((n) => (
              pill(n, {
                color: "var(--text-faint)",
                background: "transparent",
                border: "1px solid var(--border)",
              }, n)
            ))}
            {targetLanguage && pill(targetLanguage, {
              color: "rgba(251,172,50,0.75)",
              background: "rgba(251,172,50,0.07)",
              border: "1px solid rgba(251,172,50,0.18)",
            })}
          </div>

          {/* Progress */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>Budget used</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: completion >= 80 ? "#FBAC32" : "var(--text-faint)" }}>
                {completion}%
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${completion}%` }} />
            </div>
          </div>

          {renderPostButton()}
        </>
      ) : (
        <>
          {campaign.status === "draft" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(251,172,50,0.08)", border: "1px solid rgba(251,172,50,0.25)", borderRadius: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#FBAC32" }}>⏸ Draft - not yet funded</span>
            </div>
          )}
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-body)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {campaign.title}
          </h3>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 12 }}>
            {campaign.description}
          </p>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Budget used</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: completion >= 80 ? "#FBAC32" : "var(--text-muted)" }}>{completion}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${completion}%` }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "Views", value: formatNumber(campaign.metrics.views) },
              { label: "CPE", value: calcCPE(campaign.usedCredits, campaign.metrics.likes) },
              { label: "CPM", value: calcCPM(campaign.usedCredits, campaign.metrics.views) },
            ].map((m) => (
              <div key={m.label} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-body)" }}>{m.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{m.label}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", display: "block" }}>
        {card}
      </Link>
    );
  }

  return card;
}
