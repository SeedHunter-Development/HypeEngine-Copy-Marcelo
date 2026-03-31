export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export interface KolMatchProfile {
  niches?: string[];
  country?: string;
  language?: string;
}

export interface CampaignTargeting {
  targetNiches?: string[];
  targetCountries?: string[];
  targetLanguages?: string[];
}

export function calculateMatchScore(
  campaign: CampaignTargeting,
  kol: KolMatchProfile
): number {
  let nicheScore = 1.0;
  if (campaign.targetNiches && campaign.targetNiches.length > 0) {
    if (!kol.niches || kol.niches.length === 0) {
      nicheScore = 0.2;
    } else {
      const overlap = kol.niches.filter((n) => campaign.targetNiches!.includes(n)).length;
      nicheScore = overlap > 0 ? 1.0 : 0.2;
    }
  }

  let countryScore = 1.0;
  if (campaign.targetCountries && campaign.targetCountries.length > 0) {
    if (!kol.country) {
      countryScore = 0.5;
    } else {
      countryScore = campaign.targetCountries.includes(kol.country) ? 1.0 : 0.3;
    }
  }

  let languageScore = 1.0;
  if (campaign.targetLanguages && campaign.targetLanguages.length > 0) {
    if (!kol.language) {
      languageScore = 0.5;
    } else {
      languageScore = campaign.targetLanguages.includes(kol.language) ? 1.0 : 0.3;
    }
  }

  return nicheScore * 0.5 + countryScore * 0.25 + languageScore * 0.25;
}

export function matchScoreLabel(score: number): string {
  if (score >= 0.85) return "Great Match";
  if (score >= 0.6) return "Good Match";
  if (score >= 0.35) return "Partial Match";
  return "Low Match";
}

export function matchScoreColor(score: number): string {
  if (score >= 0.85) return "#22c55e";
  if (score >= 0.6) return "#FBAC32";
  if (score >= 0.35) return "#f97316";
  return "#ef4444";
}

export function calculateKolReward(
  baseReward: number,
  followers: number,
  matchScore: number = 1.0
): number {
  const followerMultiplier = Math.min(2, Math.max(0.5, followers / 50000));
  const matchMultiplier = 0.5 + matchScore * 0.5;
  return Math.round(baseReward * followerMultiplier * matchMultiplier);
}

export function suggestHashtag(title: string): string {
  const clean = title
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return `#HE_${clean}`;
}

export function estimateReach(credits: number): number {
  return credits * 12;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatCredits(n: number): string {
  return n.toLocaleString();
}

export function getCompletionPercent(used: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

export function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}
