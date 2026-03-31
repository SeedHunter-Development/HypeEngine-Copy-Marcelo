"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator, ChevronDown, ChevronUp, Target, TrendingUp,
  Users, Star, BarChart2, Globe,
  Activity, DollarSign, Info, Search, Loader2,
  CheckCircle2, XCircle, MinusCircle, Download, RefreshCw, LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// ─── Types ──────────────────────────────────────────────────────────────────

type CampaignGoal = "awareness" | "conversion" | "trust";

interface CampaignInputs {
  maxPricePerPost: number;
  campaignGoal: CampaignGoal;
  targetCountry: string;
  targetLanguage: string;
  targetNiches: string;
}

interface KolInputs {
  twitterFollowers: number;
  engagementRate: number;
  authenticityScore: number;
  twitterScoreValue: number;
  primaryLanguage: string;
  niches: string;
  campaignsCompleted: number;
  avgDeliveryScore: number;
  postReliabilityRate: number;
  shillFrequency: number;
  avgRetweets: number;
  rtToLikeRatio: number;
  quoteTweetRatio: number;
  avgPostsPerDay: number;
  replyQualityScore: number;
  followerCryptoPct: number;
  vcFollowerCount: number;
  originalVsRtRatio: number;
  threadFrequency: number;
  engagementConsistency: number;
  clientSatisfaction: number;
  geoMatchScore: number;
  langMatchScore: number;
  avgCpa: number;
}

type StepStatus = "ok" | "failed" | "skipped" | "pending";

interface ApifyData {
  twitterFollowers: number;
  twitterFollowing: number;
  avgPostsPerDay: number;
  avgLikes: number;
  avgRetweets: number;
  avgReplies: number;
  engagementRate: number;
  rtToLikeRatio: number;
  quoteTweetRatio: number;
  originalVsRtRatio: number;
  threadFrequency: number;
  engagementConsistency: number;
  followerSampleGeo: Record<string, number>;
  followerSampleFlag: number;
  tweetCount: number;
  followerSampleCount: number;
  repliesScraped: number;
}

interface TwitterScoreData {
  twitterScoreValue: number;
  twitterFollowers: number;
  twitterId: string;
  displayName: string;
  description: string;
  notableFollowers: Array<{ username: string; type: string; followersCount?: number }>;
  vcFollowerCount: number;
  exchangeFollowerCount: number;
  followerGrowthTrend: string;
}

interface LLMData {
  contentVerticals?: Record<string, number>;
  primaryLanguage?: string;
  secondaryLanguages?: string[];
  shillFrequency?: number;
  projectMentions?: string[];
  replyQualityScore?: number;
  followerCryptoPct?: number;
}

interface FetchState {
  handle: string;
  statusMessage: string;
  steps: { apify: StepStatus; twitterScore: StepStatus; llm: StepStatus };
  apify: ApifyData | null;
  twitterScore: TwitterScoreData | null;
  llm: LLMData | null;
  done: boolean;
}

// ─── Pure Calculation Logic (mirrors engine.ts + pricing.ts) ────────────────

function minMax01(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function log10safe(n: number): number {
  return n > 0 ? Math.log10(n) : 0;
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0.5;
  const setA = new Set(a.map((s) => s.toLowerCase().trim()).filter(Boolean));
  const setB = new Set(b.map((s) => s.toLowerCase().trim()).filter(Boolean));
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0.5 : intersection / union;
}

interface DimEntry { score: number; weight: number; label: string }

interface CalcResult {
  matchScore: number;
  dimensions: Record<string, DimEntry>;
  priceBreakdown: {
    base: number;
    followerTier: number;
    followerTierLabel: string;
    performanceMultiplier: number;
    matchModifier: number;
    reliabilityModifier: number;
    reliabilityLabel: string;
    finalPrice: number;
  };
}

function calculate(c: CampaignInputs, k: KolInputs): CalcResult {
  const campaignNicheArr = c.targetNiches.split(",").map((s) => s.trim()).filter(Boolean);
  const kolNicheArr = k.niches.split(",").map((s) => s.trim()).filter(Boolean);
  const vertScore = jaccardSimilarity(campaignNicheArr, kolNicheArr);

  const s_follower      = minMax01(log10safe(k.twitterFollowers), 0, 7);
  const s_engRate       = minMax01(Math.min(k.engagementRate, 20), 0, 20);
  const s_authenticity  = k.authenticityScore / 100;
  const s_twitter       = minMax01(k.twitterScoreValue, 0, 100);
  const s_replyQuality  = minMax01(k.replyQualityScore, 0, 100);
  const s_shillRaw      = minMax01(k.shillFrequency, 0, 1);
  const s_shill         = 1 - s_shillRaw;
  const s_postsPerDay   = minMax01(k.avgPostsPerDay, 0, 20);
  const s_retweets      = minMax01(k.avgRetweets, 0, 5000);
  const s_rtLike        = minMax01(k.rtToLikeRatio, 0, 1);
  const s_quoteTweet    = minMax01(k.quoteTweetRatio, 0, 1);
  const viralScore      = s_retweets * 0.4 + s_rtLike * 0.3 + s_quoteTweet * 0.3;
  const s_cryptoPct     = minMax01(k.followerCryptoPct, 0, 100);
  const s_vcFollower    = minMax01(k.vcFollowerCount, 0, 200);
  const s_originalRatio = minMax01(k.originalVsRtRatio, 0, 1);
  const s_threadDepth   = (minMax01(k.threadFrequency, 0, 0.5) + s_originalRatio) / 2;
  const s_postReliability = k.postReliabilityRate;
  const s_cryptoCred    = (s_twitter + s_vcFollower) / 2;
  const cv = k.engagementConsistency;
  const modScore = cv >= 0.7 && cv <= 1.0 ? 1.0 : cv < 0.7 ? cv / 0.7 : Math.max(0, 1.0 - (cv - 1.0) / 2);
  const s_engConsistency = Math.max(0, Math.min(1, modScore));
  const cpaScore = k.avgCpa > 0 ? Math.max(0, 1 - k.avgCpa / 200) : 0.5;

  let dimensions: Record<string, DimEntry>;
  const goal = c.campaignGoal;

  if (goal === "awareness") {
    dimensions = {
      followerCount:     { score: s_follower,         weight: 5, label: "Follower Count" },
      viralCoefficient:  { score: viralScore,         weight: 5, label: "Viral Coefficient" },
      audienceGeoMatch:  { score: k.geoMatchScore,    weight: 4, label: "Geo Match" },
      cryptoCredibility: { score: s_twitter,          weight: 4, label: "Crypto Credibility" },
      verticalMatch:     { score: vertScore,          weight: 3, label: "Vertical Match" },
      postingFrequency:  { score: s_postsPerDay,      weight: 3, label: "Posting Frequency" },
      engagementRate:    { score: s_engRate,          weight: 3, label: "Engagement Rate" },
      shillFatigue:      { score: s_shill,            weight: 3, label: "Shill Fatigue" },
      authenticity:      { score: s_authenticity,     weight: 2, label: "Authenticity" },
      audienceLangMatch: { score: k.langMatchScore,   weight: 2, label: "Language Match" },
      postReliability:   { score: s_postReliability,  weight: 2, label: "Post Reliability" },
    };
  } else if (goal === "conversion") {
    dimensions = {
      audienceGeoMatch:  { score: k.geoMatchScore,   weight: 5, label: "Geo Match" },
      audienceLangMatch: { score: k.langMatchScore,  weight: 5, label: "Language Match" },
      verticalMatch:     { score: vertScore,         weight: 4, label: "Vertical Match" },
      replyQuality:      { score: s_replyQuality,    weight: 4, label: "Reply Quality" },
      historicalCpa:     { score: cpaScore,          weight: 5, label: "Historical CPA" },
      authenticity:      { score: s_authenticity,    weight: 4, label: "Authenticity" },
      cryptoCredibility: { score: s_twitter,         weight: 3, label: "Crypto Credibility" },
      engagementRate:    { score: s_engRate,         weight: 3, label: "Engagement Rate" },
      threadDepth:       { score: s_threadDepth,     weight: 3, label: "Thread Depth" },
      postReliability:   { score: s_postReliability, weight: 3, label: "Post Reliability" },
      followerCount:     { score: s_follower,        weight: 1, label: "Follower Count" },
    };
  } else {
    dimensions = {
      replyQuality:            { score: s_replyQuality,    weight: 5, label: "Reply Quality" },
      followerCryptoRelevance: { score: s_cryptoPct,       weight: 5, label: "Crypto Relevance" },
      audienceGeoMatch:        { score: k.geoMatchScore,   weight: 4, label: "Geo Match" },
      cryptoCredibility:       { score: s_cryptoCred,      weight: 4, label: "Crypto Credibility" },
      verticalMatch:           { score: vertScore,         weight: 4, label: "Vertical Match" },
      threadDepth:             { score: s_threadDepth,     weight: 3, label: "Thread Depth" },
      originalContentRatio:    { score: s_originalRatio,   weight: 3, label: "Original Content" },
      authenticity:            { score: s_authenticity,    weight: 3, label: "Authenticity" },
      engagementConsistency:   { score: s_engConsistency,  weight: 2, label: "Eng. Consistency" },
      postReliability:         { score: s_postReliability, weight: 2, label: "Post Reliability" },
      followerCount:           { score: s_follower,        weight: 1, label: "Follower Count" },
    };
  }

  const totalWeight = Object.values(dimensions).reduce((s, d) => s + d.weight, 0);
  const weightedSum = Object.values(dimensions).reduce((s, d) => s + d.score * d.weight, 0);
  let matchScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
  matchScore = Math.round(matchScore * 10) / 10;

  const sat = k.clientSatisfaction;
  if (sat > 0) {
    if (sat > 4.0) matchScore = Math.min(100, Math.round(matchScore * 1.05 * 10) / 10);
    else if (sat < 2.5) matchScore = Math.max(0, Math.round(matchScore * 0.90 * 10) / 10);
  }

  const base = c.maxPricePerPost;
  const followers = k.twitterFollowers;
  let followerTierLabel: string;
  let followerTier: number;
  if (followers < 5_000)        { followerTier = 0.4; followerTierLabel = "Nano (<5k)"; }
  else if (followers < 25_000)  { followerTier = 0.6; followerTierLabel = "Micro (<25k)"; }
  else if (followers < 100_000) { followerTier = 0.8; followerTierLabel = "Mid (<100k)"; }
  else if (followers < 500_000) { followerTier = 1.0; followerTierLabel = "Macro (<500k)"; }
  else                          { followerTier = 1.2; followerTierLabel = "Mega (≥500k)"; }

  const completed = k.campaignsCompleted;
  let performanceMultiplier: number;
  if (completed === 0) performanceMultiplier = 0.7;
  else if (completed <= 2) performanceMultiplier = 0.5 + (k.avgDeliveryScore / 100) * 0.5;
  else performanceMultiplier = Math.min(1.3, 0.3 + (k.avgDeliveryScore / 100) * 1.0);

  const matchModifier = 0.7 + (matchScore / 100) * 0.3;

  const reliabilityRate = k.postReliabilityRate;
  let reliabilityModifier: number;
  let reliabilityLabel: string;
  if (reliabilityRate >= 0.95)      { reliabilityModifier = 1.0;  reliabilityLabel = "Excellent (≥95%)"; }
  else if (reliabilityRate >= 0.85) { reliabilityModifier = 0.9;  reliabilityLabel = "Good (85–95%)"; }
  else if (reliabilityRate >= 0.70) { reliabilityModifier = 0.75; reliabilityLabel = "Fair (70–85%)"; }
  else                               { reliabilityModifier = 0.5;  reliabilityLabel = "Poor (<70%)"; }

  const finalPrice = Math.max(1, Math.round(base * followerTier * performanceMultiplier * matchModifier * reliabilityModifier));

  return {
    matchScore,
    dimensions,
    priceBreakdown: { base, followerTier, followerTierLabel, performanceMultiplier, matchModifier, reliabilityModifier, reliabilityLabel, finalPrice },
  };
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_CAMPAIGN: CampaignInputs = {
  maxPricePerPost: 500,
  campaignGoal: "awareness",
  targetCountry: "US",
  targetLanguage: "english",
  targetNiches: "defi, crypto",
};

const DEFAULT_KOL: KolInputs = {
  // Auto-fetched by TwitterScore button
  twitterFollowers:    0,
  twitterScoreValue:   0,
  vcFollowerCount:     0,
  // Auto-fetched by Apify button
  engagementRate:      0,
  avgRetweets:         0,
  rtToLikeRatio:       0,
  quoteTweetRatio:     0,
  avgPostsPerDay:      0,
  originalVsRtRatio:   0,
  // Auto-fetched by LLM button
  shillFrequency:      0,
  replyQualityScore:   0,
  followerCryptoPct:   0,
  primaryLanguage:     "",
  niches:              "",
  // Manual entry only
  authenticityScore:   0,
  campaignsCompleted:  0,
  avgDeliveryScore:    0,
  postReliabilityRate: 0,
  threadFrequency:     0,
  engagementConsistency: 0,
  clientSatisfaction:  0,
  geoMatchScore:       0,
  langMatchScore:      0,
  avgCpa:              0,
};

// ─── UI Helpers ─────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-8 text-right text-white/70">{pct}%</span>
    </div>
  );
}

function NumInput({ label, value, onChange, min = 0, max, step = 1, hint }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-white/50 mb-1">
        {label}{hint && <span className="ml-1 text-white/30">({hint})</span>}
      </label>
      <input
        type="number"
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/60"
        value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function TextInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label className="block text-xs text-white/50 mb-1">
        {label}{hint && <span className="ml-1 text-white/30">({hint})</span>}
      </label>
      <input
        type="text"
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/8 transition-colors" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-2 text-sm font-medium text-white/80">
          <Icon className="w-4 h-4 text-indigo-400" />
          {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>
      {open && <div className="p-4 grid grid-cols-2 gap-3">{children}</div>}
    </div>
  );
}

function StepBadge({ status }: { status: StepStatus | undefined }) {
  if (status === "ok")      return <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />ok</span>;
  if (status === "failed")  return <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3.5 h-3.5" />failed</span>;
  if (status === "pending") return <span className="flex items-center gap-1 text-xs text-indigo-400"><Loader2 className="w-3.5 h-3.5 animate-spin" />running</span>;
  return <span className="flex items-center gap-1 text-xs text-white/30"><MinusCircle className="w-3.5 h-3.5" />skipped</span>;
}

function RawDataRow({ label, value }: { label: string; value: unknown }) {
  const display = typeof value === "object" && value !== null
    ? JSON.stringify(value, null, 2)
    : String(value ?? "—");
  const isLong = display.length > 60;
  return (
    <div className="flex gap-3 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/40 w-44 shrink-0 font-mono pt-0.5">{label}</span>
      {isLong
        ? <pre className="text-xs text-white/80 font-mono whitespace-pre-wrap break-all">{display}</pre>
        : <span className="text-xs text-white/80 font-mono">{display}</span>
      }
    </div>
  );
}

// ─── Live DB Match Tab ────────────────────────────────────────────────────────

interface AdminKol {
  userId: string;
  name: string | null;
  email: string;
  country: string | null;
  language: string | null;
  kolProfileId: string;
  twitterHandle: string;
  twitterFollowers: number | null;
  twitterScoreValue: number | null;
  engagementRate: number | null;
  niches: string[] | null;
  primaryLanguage: string | null;
  campaignsCompleted: number | null;
  clientSatisfaction: number | null;
  postReliabilityRate: number | null;
  lastDataRefresh: string | null;
}

interface AdminCampaign {
  id: string;
  title: string;
  campaignGoal: string | null;
  targetCountries: string[] | null;
  targetLanguages: string[] | null;
  targetNiches: string[] | null;
  maxPricePerPost: number | null;
  status: string | null;
}

interface MatchTestResult {
  campaign: AdminCampaign;
  kol: {
    kolProfileId: string;
    twitterHandle: string;
    twitterFollowers: number | null;
    primaryLanguage: string | null;
    secondaryLanguages: string[] | null;
    niches: string[] | null;
    followerSampleGeo: Record<string, number> | null;
    twitterScoreValue: number | null;
    engagementRate: number | null;
    authenticityScore: number | null;
    campaignsCompleted: number | null;
    clientSatisfaction: number | null;
    postReliabilityRate: number | null;
    shillFrequency: number | null;
    avgRetweets: number | null;
    rtToLikeRatio: number | null;
    quoteTweetRatio: number | null;
    avgPostsPerDay: number | null;
    replyQualityScore: number | null;
    followerCryptoPct: number | null;
    vcFollowerCount: number | null;
    originalVsRtRatio: number | null;
    threadFrequency: number | null;
    engagementConsistency: number | null;
    country: string | null;
    language: string | null;
    name: string | null;
    lastDataRefresh: string | null;
  };
  scoringInputs: Record<string, number | string | string[]>;
  result: {
    matchScore: number;
    dimensions: Record<string, { score: number; weight: number; label: string }>;
    priceBreakdown: {
      base: number; followerTier: number; followerTierLabel: string;
      performanceMultiplier: number; matchModifier: number;
      reliabilityModifier: number; reliabilityLabel: string; finalPrice: number;
    };
  };
}

function LiveMatchTab() {
  const [kols, setKols] = useState<AdminKol[]>([]);
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedKolId, setSelectedKolId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchTestResult | null>(null);
  const [showRawInputs, setShowRawInputs] = useState(false);
  const [showRawGeo, setShowRawGeo] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/kols").then((r) => r.json()).catch(() => []),
      fetch("/api/campaigns").then((r) => r.json()).catch(() => []),
    ]).then(([k, c]) => {
      if (Array.isArray(k)) setKols(k);
      if (Array.isArray(c)) setCampaigns(c);
    });
  }, []);

  async function runMatch() {
    if (!selectedCampaignId || !selectedKolId) return;
    setLoading(true);
    setError(null);
    setMatchResult(null);
    try {
      const res = await fetch(`/api/admin/match-test?campaignId=${selectedCampaignId}&kolProfileId=${selectedKolId}`);
      if (!res.ok) {
        const e = await res.json() as { error?: string };
        throw new Error(e.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as MatchTestResult;
      setMatchResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const r = matchResult?.result;
  const scoreColor = !r ? "" : r.matchScore >= 70 ? "text-emerald-400" : r.matchScore >= 40 ? "text-amber-400" : "text-red-400";
  const sortedDims = r ? Object.entries(r.dimensions).sort((a, b) => b[1].score - a[1].score) : [];

  return (
    <div className="space-y-5">
      {/* Selectors */}
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-white/80">Select Campaign + KOL</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Campaign</label>
            <select
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
            >
              <option value="">— Select a campaign —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} [{c.status ?? "?"}] · {c.campaignGoal ?? "?"} · ${c.maxPricePerPost ?? "?"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">KOL</label>
            <select
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60"
              value={selectedKolId}
              onChange={(e) => setSelectedKolId(e.target.value)}
            >
              <option value="">— Select a KOL —</option>
              {kols.map((k) => (
                <option key={k.kolProfileId} value={k.kolProfileId}>
                  @{k.twitterHandle} · {k.twitterFollowers?.toLocaleString() ?? "?"} followers
                  {k.twitterScoreValue ? ` · TS:${Math.round(k.twitterScoreValue)}` : ""}
                  {k.niches?.length ? ` · [${k.niches.slice(0, 2).join(",")}]` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={runMatch}
          disabled={!selectedCampaignId || !selectedKolId || loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Computing…</> : <><Activity className="w-4 h-4" />Run Match</>}
        </button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      {matchResult && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
          {/* Left: KOL + Campaign info + Raw inputs */}
          <div className="space-y-4">
            {/* KOL Info */}
            <div className="rounded-xl border border-white/10 bg-white/3 p-5">
              <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
                <Users className="w-4 h-4 text-indigo-400" />
                <span className="font-medium">KOL Profile</span>
                <span className="ml-auto text-xs text-white/30">
                  {matchResult.kol.lastDataRefresh
                    ? `Last refresh: ${new Date(matchResult.kol.lastDataRefresh).toLocaleDateString()}`
                    : "No data refresh recorded"}
                </span>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-600/30 flex items-center justify-center text-sm font-bold text-indigo-300">
                  {matchResult.kol.twitterHandle.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">@{matchResult.kol.twitterHandle}</p>
                  <p className="text-xs text-white/40">{matchResult.kol.name ?? matchResult.kol.twitterHandle}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-lg font-bold text-white">{matchResult.kol.twitterFollowers?.toLocaleString() ?? "—"}</p>
                  <p className="text-xs text-white/40">followers</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                {[
                  ["TwitterScore", matchResult.kol.twitterScoreValue?.toFixed(1)],
                  ["Engagement %", matchResult.kol.engagementRate?.toFixed(2)],
                  ["Authenticity", (matchResult.kol.authenticityScore ?? 0).toFixed(0)],
                  ["Shill Freq.", matchResult.kol.shillFrequency?.toFixed(3)],
                  ["Reply Quality", matchResult.kol.replyQualityScore?.toFixed(0)],
                  ["Crypto %", matchResult.kol.followerCryptoPct?.toFixed(1)],
                  ["Avg Posts/Day", matchResult.kol.avgPostsPerDay?.toFixed(2)],
                  ["Avg Retweets", matchResult.kol.avgRetweets?.toFixed(1)],
                  ["Orig vs RT", matchResult.kol.originalVsRtRatio?.toFixed(3)],
                  ["RT:Like Ratio", matchResult.kol.rtToLikeRatio?.toFixed(3)],
                  ["Quote Tweet", matchResult.kol.quoteTweetRatio?.toFixed(3)],
                  ["Thread Freq.", matchResult.kol.threadFrequency?.toFixed(3)],
                  ["Eng. Consistency", matchResult.kol.engagementConsistency?.toFixed(3)],
                  ["VC Followers", matchResult.kol.vcFollowerCount?.toLocaleString()],
                  ["Post Reliability", matchResult.kol.postReliabilityRate?.toFixed(3)],
                  ["Campaigns Done", matchResult.kol.campaignsCompleted],
                  ["Client Sat.", matchResult.kol.clientSatisfaction?.toFixed(1)],
                ].map(([label, val]) => (
                  <div key={String(label)} className="bg-white/5 rounded-lg p-2.5">
                    <p className="text-white/35 text-[10px] uppercase tracking-wide mb-1">{label}</p>
                    <p className="font-mono text-white/80">{val ?? "—"}</p>
                  </div>
                ))}
              </div>
              {/* Niches */}
              {matchResult.kol.niches && matchResult.kol.niches.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wide text-white/35 mb-1.5">Niches</p>
                  <div className="flex flex-wrap gap-1.5">
                    {matchResult.kol.niches.map((n) => {
                      const campNiches = (matchResult.campaign.targetNiches ?? []).map((x) => x.toLowerCase().trim());
                      const isMatch = campNiches.includes(n.toLowerCase().trim());
                      return (
                        <span key={n} className={`px-2 py-0.5 rounded-full text-xs font-medium ${isMatch ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300" : "bg-indigo-500/15 border border-indigo-500/25 text-indigo-300"}`}>
                          {n}{isMatch && " ✓"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Match Basis Validation */}
            {(() => {
              const kol = matchResult.kol;
              const camp = matchResult.campaign;
              const hasGeoSample = !!kol.followerSampleGeo && Object.keys(kol.followerSampleGeo).length > 0;
              const targetCode = camp.targetCountries?.[0] ?? "";
              const geoScore = typeof matchResult.scoringInputs.geoMatchScore === "number" ? matchResult.scoringInputs.geoMatchScore : null;
              const langScore = typeof matchResult.scoringInputs.langMatchScore === "number" ? matchResult.scoringInputs.langMatchScore : null;
              let geoSource: string;
              if (hasGeoSample) {
                const pct = (kol.followerSampleGeo![targetCode] ?? 0) as number;
                const frac = pct > 1 ? pct / 100 : pct;
                geoSource = `Apify geo sample — ${(frac * 100).toFixed(1)}% of followers in ${targetCode || "target"}`;
              } else if (kol.country) {
                geoSource = kol.country === targetCode
                  ? `User country "${kol.country}" = target → exact match`
                  : `User country "${kol.country}" ≠ target "${targetCode}" → 0%`;
              } else {
                geoSource = "No geo data → neutral 50%";
              }
              const kolLang = kol.primaryLanguage ?? kol.language ?? null;
              const campLang = camp.targetLanguages?.[0] ?? "";
              const targetLang = campLang.toLowerCase().trim();
              let langSource: string;
              if (kolLang && kolLang.toLowerCase().trim() === targetLang) {
                langSource = `Primary language "${kolLang}" = target → 100%`;
              } else if ((kol.secondaryLanguages ?? []).some((l) => l.toLowerCase().trim() === targetLang)) {
                langSource = `Secondary language match → 70%`;
              } else if (kolLang) {
                langSource = `Primary language "${kolLang}" ≠ target "${campLang}" → 10%`;
              } else {
                langSource = "No language data → neutral 50%";
              }
              const kolNiches = (kol.niches ?? []).map((n) => n.toLowerCase().trim());
              const campNiches = (camp.targetNiches ?? []).map((n) => n.toLowerCase().trim());
              const intersection = kolNiches.filter((n) => campNiches.includes(n));
              const union = Array.from(new Set([...kolNiches, ...campNiches]));
              const jaccard = union.length > 0 ? intersection.length / union.length : 0.5;

              return (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/4 p-5">
                  <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
                    <Globe className="w-4 h-4 text-amber-400" />
                    <span className="font-medium text-amber-300/80">Match Basis</span>
                    <span className="ml-auto text-xs text-white/25">how each score was derived</span>
                  </div>
                  <div className="space-y-4 text-xs">
                    {/* GEO */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-white/40 uppercase tracking-wide text-[10px]">Geo Match</span>
                        <span className="font-mono text-amber-300">{geoScore != null ? `${(geoScore * 100).toFixed(0)}%` : "—"}</span>
                      </div>
                      <div className="flex gap-3 mb-1.5">
                        <div className="flex-1 bg-white/5 rounded p-2">
                          <p className="text-white/30 text-[10px] mb-0.5">KOL</p>
                          <p className="font-mono text-white/70">{kol.country ?? "—"}{hasGeoSample ? " + geo sample" : ""}</p>
                        </div>
                        <div className="flex items-center text-white/20">→</div>
                        <div className="flex-1 bg-white/5 rounded p-2">
                          <p className="text-white/30 text-[10px] mb-0.5">Campaign target</p>
                          <p className="font-mono text-white/70">{camp.targetCountries?.[0] ?? "—"}</p>
                        </div>
                      </div>
                      <p className="text-white/35 font-mono text-[11px] italic">{geoSource}</p>
                    </div>
                    {/* LANG */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-white/40 uppercase tracking-wide text-[10px]">Language Match</span>
                        <span className="font-mono text-amber-300">{langScore != null ? `${(langScore * 100).toFixed(0)}%` : "—"}</span>
                      </div>
                      <div className="flex gap-3 mb-1.5">
                        <div className="flex-1 bg-white/5 rounded p-2">
                          <p className="text-white/30 text-[10px] mb-0.5">KOL</p>
                          <p className="font-mono text-white/70">
                            primary: {kol.primaryLanguage ?? kol.language ?? "—"}
                            {(kol.secondaryLanguages ?? []).length > 0 && (
                              <span className="text-white/40"> · sec: {kol.secondaryLanguages!.join(", ")}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center text-white/20">→</div>
                        <div className="flex-1 bg-white/5 rounded p-2">
                          <p className="text-white/30 text-[10px] mb-0.5">Campaign target</p>
                          <p className="font-mono text-white/70">{camp.targetLanguages?.[0] ?? "—"}</p>
                        </div>
                      </div>
                      <p className="text-white/35 font-mono text-[11px] italic">{langSource}</p>
                    </div>
                    {/* NICHES */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-white/40 uppercase tracking-wide text-[10px]">Niche Match (Jaccard)</span>
                        <span className="font-mono text-amber-300">{(jaccard * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1 bg-white/5 rounded p-2">
                          <p className="text-white/30 text-[10px] mb-1">KOL niches ({kolNiches.length})</p>
                          <p className="font-mono text-white/60">{kolNiches.length ? kolNiches.join(", ") : "none"}</p>
                        </div>
                        <div className="flex items-center text-white/20">∩</div>
                        <div className="flex-1 bg-white/5 rounded p-2">
                          <p className="text-white/30 text-[10px] mb-1">Campaign niches ({campNiches.length})</p>
                          <p className="font-mono text-white/60">{campNiches.length ? campNiches.join(", ") : "none"}</p>
                        </div>
                      </div>
                      {intersection.length > 0 && (
                        <p className="mt-1.5 text-emerald-400/70 font-mono text-[11px]">Overlap: {intersection.join(", ")}</p>
                      )}
                      {intersection.length === 0 && kolNiches.length > 0 && campNiches.length > 0 && (
                        <p className="mt-1.5 text-red-400/60 font-mono text-[11px]">No niche overlap</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Campaign Info */}
            <div className="rounded-xl border border-white/10 bg-white/3 p-5">
              <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="font-medium">Campaign</span>
              </div>
              <p className="text-base font-semibold text-white mb-3">{matchResult.campaign.title}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mb-3">
                {[
                  ["Goal", matchResult.campaign.campaignGoal],
                  ["Max Price", `$${matchResult.campaign.maxPricePerPost}`],
                  ["Status", matchResult.campaign.status],
                  ["Target Country", matchResult.campaign.targetCountries?.[0]],
                  ["Target Language", matchResult.campaign.targetLanguages?.[0]],
                  ["Niches", (matchResult.campaign.targetNiches ?? []).join(", ") || "—"],
                ].map(([label, val]) => (
                  <div key={String(label)} className="bg-white/5 rounded-lg p-2.5">
                    <p className="text-white/35 text-[10px] uppercase tracking-wide mb-1">{label}</p>
                    <p className="font-mono text-white/80 capitalize">{val ?? "—"}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Geo Data */}
            {matchResult.kol.followerSampleGeo && (
              <div className="rounded-xl border border-white/10 bg-white/3 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-3 bg-white/5 hover:bg-white/8 transition-colors"
                  onClick={() => setShowRawGeo((o) => !o)}
                >
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span>Follower Geo Distribution</span>
                  </div>
                  {showRawGeo ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                </button>
                {showRawGeo && (
                  <div className="px-5 py-4">
                    <div className="space-y-2">
                      {Object.entries(matchResult.kol.followerSampleGeo)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .slice(0, 15)
                        .map(([code, pct]) => {
                          const pctNum = typeof pct === "number" ? pct : 0;
                          const frac = pctNum > 1 ? pctNum / 100 : pctNum;
                          const campTarget = matchResult.campaign.targetCountries?.[0] ?? "";
                          const isTarget = code === campTarget ||
                            code.toLowerCase() === campTarget.toLowerCase();
                          return (
                            <div key={code} className="flex items-center gap-3">
                              <span className={`text-xs font-mono w-10 shrink-0 ${isTarget ? "text-amber-400 font-bold" : "text-white/50"}`}>{code}</span>
                              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isTarget ? "bg-amber-400" : "bg-indigo-500/50"}`}
                                  style={{ width: `${Math.min(100, frac * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-white/50 font-mono w-12 text-right">{(frac * 100).toFixed(1)}%</span>
                              {isTarget && <span className="text-xs text-amber-400 font-medium">← target</span>}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Raw Scoring Inputs */}
            <div className="rounded-xl border border-white/10 bg-white/3 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-3 bg-white/5 hover:bg-white/8 transition-colors"
                onClick={() => setShowRawInputs((o) => !o)}
              >
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  <span>Raw Scoring Inputs</span>
                  <span className="text-xs text-white/25">(exactly what the engine sees)</span>
                </div>
                {showRawInputs ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
              </button>
              {showRawInputs && (
                <div className="px-5 py-4 grid grid-cols-2 gap-x-6">
                  {Object.entries(matchResult.scoringInputs).map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
                      <span className="text-xs text-white/40 font-mono">{key}</span>
                      <span className="text-xs text-white/80 font-mono">
                        {Array.isArray(val) ? (val.length ? val.join(", ") : "[]") : String(val ?? "—")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Results */}
          <div className="space-y-4">
            {/* Match Score */}
            <div className="rounded-xl border border-white/10 bg-white/3 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Activity className="w-4 h-4" />
                  Match Score
                </div>
                <span className="text-xs text-white/30 capitalize">{r?.priceBreakdown && matchResult.campaign.campaignGoal} goal</span>
              </div>
              <div className={`text-6xl font-bold tabular-nums ${scoreColor}`}>
                {r?.matchScore.toFixed(1)}
                <span className="text-2xl text-white/30 ml-1">/100</span>
              </div>
              <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${(r?.matchScore ?? 0) >= 70 ? "bg-emerald-500" : (r?.matchScore ?? 0) >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${r?.matchScore ?? 0}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/5 rounded-lg p-2.5">
                  <p className="text-white/35 text-[10px] uppercase tracking-wide mb-1">Geo Match</p>
                  <p className="font-mono text-white/80">
                    {typeof matchResult.scoringInputs.geoMatchScore === "number"
                      ? `${(matchResult.scoringInputs.geoMatchScore * 100).toFixed(0)}%`
                      : "—"}
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-2.5">
                  <p className="text-white/35 text-[10px] uppercase tracking-wide mb-1">Lang Match</p>
                  <p className="font-mono text-white/80">
                    {typeof matchResult.scoringInputs.langMatchScore === "number"
                      ? `${(matchResult.scoringInputs.langMatchScore * 100).toFixed(0)}%`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Dimension Breakdown */}
            <div className="rounded-xl border border-white/10 bg-white/3 p-5">
              <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
                <BarChart2 className="w-4 h-4" />
                Dimension Breakdown
              </div>
              <div className="space-y-3">
                {sortedDims.map(([key, dim]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/60">{dim.label}</span>
                      <span className="text-xs text-white/30">w={dim.weight.toFixed(1)}</span>
                    </div>
                    <ScoreBar score={dim.score} />
                  </div>
                ))}
              </div>
            </div>

            {/* Price Breakdown */}
            {r && (
              <div className="rounded-xl border border-white/10 bg-white/3 p-5">
                <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
                  <DollarSign className="w-4 h-4" />
                  Price Breakdown
                </div>
                <div className="text-4xl font-bold text-white mb-5">
                  ${r.priceBreakdown.finalPrice.toLocaleString()}
                  <span className="text-sm font-normal text-white/30 ml-2">/ post</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-white/50">Base (max price)</span>
                    <span className="font-mono">${r.priceBreakdown.base.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <div><span className="text-white/50">Follower tier</span><span className="ml-2 text-xs text-white/30">{r.priceBreakdown.followerTierLabel}</span></div>
                    <span className="font-mono text-indigo-300">×{r.priceBreakdown.followerTier.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <div>
                      <span className="text-white/50">Performance mult.</span>
                      <span className="ml-2 text-xs text-white/30">
                        {(matchResult.kol.campaignsCompleted ?? 0) === 0 ? "no history" : (matchResult.kol.campaignsCompleted ?? 0) <= 2 ? "early career" : "experienced"}
                      </span>
                    </div>
                    <span className={`font-mono ${r.priceBreakdown.performanceMultiplier >= 1 ? "text-emerald-400" : "text-amber-400"}`}>
                      ×{r.priceBreakdown.performanceMultiplier.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-white/50">Match modifier</span>
                    <span className="font-mono text-indigo-300">×{r.priceBreakdown.matchModifier.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <div><span className="text-white/50">Reliability modifier</span><span className="ml-2 text-xs text-white/30">{r.priceBreakdown.reliabilityLabel}</span></div>
                    <span className={`font-mono ${r.priceBreakdown.reliabilityModifier === 1 ? "text-emerald-400" : r.priceBreakdown.reliabilityModifier >= 0.75 ? "text-amber-400" : "text-red-400"}`}>
                      ×{r.priceBreakdown.reliabilityModifier.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 font-medium">
                    <span>Final Price</span>
                    <span className="text-lg">${r.priceBreakdown.finalPrice.toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-white/5 rounded-lg">
                  <p className="text-xs text-white/30 font-mono leading-5">
                    ${r.priceBreakdown.base} × {r.priceBreakdown.followerTier}
                    {" "}× {r.priceBreakdown.performanceMultiplier.toFixed(3)}
                    {" "}× {r.priceBreakdown.matchModifier.toFixed(3)}
                    {" "}× {r.priceBreakdown.reliabilityModifier}
                    {" "}= <span className="text-white/60">${r.priceBreakdown.finalPrice}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PricingTestPage() {
  const { logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"manual" | "live">("manual");

  const [campaign, setCampaign] = useState<CampaignInputs>(DEFAULT_CAMPAIGN);
  const [kol, setKol] = useState<KolInputs>(DEFAULT_KOL);

  // Fetch state
  const [fetchHandle, setFetchHandle] = useState("");
  const [tsLoading, setTsLoading]       = useState(false);
  const [apifyLoading, setApifyLoading] = useState(false);
  const [llmLoading, setLlmLoading]     = useState(false);
  const [llmReady, setLlmReady]         = useState(false); // true when apify cache exists server-side
  const [fetchState, setFetchState]     = useState<FetchState | null>(null);
  const [fetchError, setFetchError]     = useState<string | null>(null);
  const [rawOpen, setRawOpen]           = useState<Record<string, boolean>>({ apify: true, twitterScore: true, llm: true });
  const [loadedFields, setLoadedFields] = useState<string[]>([]);

  const fetchLoading = tsLoading || apifyLoading || llmLoading;

  function setC<K extends keyof CampaignInputs>(key: K, val: CampaignInputs[K]) {
    setCampaign((p) => ({ ...p, [key]: val }));
  }
  function setK<K extends keyof KolInputs>(key: K, val: KolInputs[K]) {
    setKol((p) => ({ ...p, [key]: val }));
  }

  // Ensure fetchState exists and is initialised for this handle
  function ensureFetchState(handle: string) {
    setFetchState((prev) => {
      if (prev && prev.handle === handle) return prev;
      return {
        handle,
        statusMessage: "Starting…",
        steps: { twitterScore: "skipped", apify: "skipped", llm: "skipped" },
        twitterScore: null, apify: null, llm: null, done: false,
      };
    });
  }

  // Generic poll loop — merges only the fields relevant to the source
  async function pollJob(
    jobId: string,
    source: "twitterScore" | "apify" | "llm",
    setLoading: (v: boolean) => void,
  ) {
    try {
      while (true) {
        await new Promise((r) => setTimeout(r, 3000));
        const pollRes = await fetch(`/admin/fetch-api?jobId=${jobId}`);
        if (!pollRes.ok) {
          if (pollRes.status === 404) throw new Error("Job expired — please retry");
          throw new Error(`Poll error (HTTP ${pollRes.status})`);
        }
        const job = await pollRes.json() as {
          handle: string; statusMessage: string; done: boolean; error?: string; llmReady?: boolean;
          steps: FetchState["steps"];
          twitterScore: TwitterScoreData | null;
          apify: ApifyData | null;
          llm: LLMData | null;
        };

        // Merge only the fields this source owns
        setFetchState((prev) => {
          if (!prev) return prev;
          const next = { ...prev, statusMessage: job.statusMessage };
          if (source === "twitterScore") {
            next.steps = { ...prev.steps, twitterScore: job.steps.twitterScore };
            next.twitterScore = job.twitterScore;
          } else if (source === "apify") {
            next.steps = { ...prev.steps, apify: job.steps.apify };
            next.apify = job.apify;
          } else {
            next.steps = { ...prev.steps, llm: job.steps.llm };
            next.llm = job.llm;
          }
          return next;
        });

        if (job.llmReady) setLlmReady(true);

        if (job.done) {
          if (job.error) setFetchError(job.error);
          break;
        }
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function startJob(source: "twitterScore" | "apify" | "llm", setLoading: (v: boolean) => void) {
    const handle = fetchHandle.replace(/^@/, "").trim();
    if (!handle) return;
    setLoading(true);
    setFetchError(null);
    ensureFetchState(handle);

    // Mark this step as pending immediately
    setFetchState((prev) => {
      if (!prev) return prev;
      return { ...prev, steps: { ...prev.steps, [source]: "pending" } };
    });

    try {
      // Use GET to start the job (POST is blocked by some proxy configs)
      const params = new URLSearchParams({ action: "start", handle, source });
      const startUrl = `/admin/fetch-api?${params}`;
      console.log("[profile-fetch] starting job:", startUrl);
      const startRes = await fetch(startUrl, { cache: "no-store" });
      const startText = await startRes.text().catch(() => "");
      console.log("[profile-fetch] start response:", startRes.status, startText.slice(0, 300));
      if (!startRes.ok) {
        let msg = `Failed to start (HTTP ${startRes.status}): ${startText.slice(0, 200)}`;
        try { msg = (JSON.parse(startText) as { error?: string }).error ?? msg; } catch { /**/ }
        throw new Error(msg);
      }
      const resp = JSON.parse(startText) as { jobId: string; llmReady?: boolean };
      if (resp.llmReady) setLlmReady(true);
      await pollJob(resp.jobId, source, setLoading);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  }

  function handleFetchTs()    { void startJob("twitterScore", setTsLoading); }
  function handleFetchApify() { void startJob("apify", setApifyLoading); }
  function handleFetchLlm()   { void startJob("llm", setLlmLoading); }

  function loadIntoInputs() {
    if (!fetchState) return;
    const loaded: string[] = [];
    const { apify, twitterScore, llm } = fetchState;

    if (apify) {
      setKol((prev) => ({
        ...prev,
        // Only load fields that the new Apify actor returns
        ...(apify.engagementRate > 0        ? { engagementRate:    apify.engagementRate }    : {}),
        ...(apify.avgRetweets    != null    ? { avgRetweets:       apify.avgRetweets }        : {}),
        ...(apify.avgPostsPerDay != null    ? { avgPostsPerDay:    apify.avgPostsPerDay }     : {}),
        ...(apify.originalVsRtRatio != null ? { originalVsRtRatio: apify.originalVsRtRatio } : {}),
        ...(apify.rtToLikeRatio  != null    ? { rtToLikeRatio:    apify.rtToLikeRatio }      : {}),
        ...(apify.quoteTweetRatio != null   ? { quoteTweetRatio:  apify.quoteTweetRatio }    : {}),
        // followersUsed is from TwitterScore cache — use it only if better than current
        ...(apify.followersUsed > 0 && apify.followersUsed > prev.twitterFollowers
          ? { twitterFollowers: apify.followersUsed }
          : {}),
      }));
      const added = ["avgRetweets", "avgPostsPerDay", "originalVsRtRatio", "rtToLikeRatio", "quoteTweetRatio"];
      if (apify.engagementRate > 0)  added.push("engagementRate");
      if (apify.followersUsed > 0)   added.push("twitterFollowers (from Apify cache)");
      loaded.push(...added);
    }

    if (twitterScore) {
      setKol((prev) => ({
        ...prev,
        twitterScoreValue: twitterScore.twitterScoreValue,
        ...(twitterScore.twitterFollowers ? { twitterFollowers: twitterScore.twitterFollowers } : {}),
      }));
      loaded.push("twitterScoreValue");
      if (twitterScore.twitterFollowers) loaded.push("twitterFollowers");
    }

    if (llm) {
      setKol((prev) => ({
        ...prev,
        ...(llm.shillFrequency != null  ? { shillFrequency: llm.shillFrequency } : {}),
        ...(llm.replyQualityScore != null ? { replyQualityScore: llm.replyQualityScore } : {}),
        ...(llm.followerCryptoPct != null ? { followerCryptoPct: llm.followerCryptoPct } : {}),
        ...(llm.primaryLanguage ? { primaryLanguage: llm.primaryLanguage } : {}),
        ...(llm.contentVerticals ? { niches: Object.keys(llm.contentVerticals).join(", ") } : {}),
      }));
      if (llm.shillFrequency != null)   loaded.push("shillFrequency");
      if (llm.replyQualityScore != null) loaded.push("replyQualityScore");
      if (llm.followerCryptoPct != null) loaded.push("followerCryptoPct");
      if (llm.primaryLanguage)           loaded.push("primaryLanguage");
      if (llm.contentVerticals)          loaded.push("niches");
    }

    setLoadedFields(loaded);
  }

  const result = useMemo(() => calculate(campaign, kol), [campaign, kol]);
  const scoreColor = result.matchScore >= 70 ? "text-emerald-400" : result.matchScore >= 40 ? "text-amber-400" : "text-red-400";
  const sortedDims = Object.entries(result.dimensions).sort((a, b) => b[1].score - a[1].score);

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Pricing Test Screen</h1>
            <p className="text-sm text-white/40">{activeTab === "manual" ? "Manual inputs · no DB calls" : "Real KOLs + Campaigns from DB"}</p>
          </div>
          <button
            onClick={() => { logout(); router.replace("/auth"); }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 mb-6 p-1 bg-white/5 rounded-xl border border-white/8 w-fit">
          {([
            { key: "manual", label: "Manual Test" },
            { key: "live",   label: "Live DB Match" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.key
                  ? "bg-indigo-600 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "live" && <LiveMatchTab />}

        {activeTab === "manual" && <>

        {/* ── Fetch Profile Panel ── */}
        <div className="mb-6 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-white/80">Fetch Live Profile Data</span>
            <span className="ml-auto text-xs text-white/30">Run each API independently · Apify takes 3–5 min · LLM requires Apify first</span>
          </div>

          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">@</span>
              <input
                type="text"
                placeholder="TheEliteCrypto"
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/60"
                value={fetchHandle}
                onChange={(e) => setFetchHandle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !fetchLoading && handleFetchTs()}
              />
            </div>

            {/* TwitterScore */}
            <button
              onClick={handleFetchTs}
              disabled={tsLoading || !fetchHandle.trim()}
              title="Fetch Twitter Score + follower count (fast)"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors whitespace-nowrap"
            >
              {tsLoading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> TwitterScore…</>
                : <><Search className="w-3.5 h-3.5" /> TwitterScore</>}
            </button>

            {/* Apify */}
            <button
              onClick={handleFetchApify}
              disabled={apifyLoading || !fetchHandle.trim()}
              title="Scrape tweets + followers via Apify (takes a few minutes)"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-orange-700 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors whitespace-nowrap"
            >
              {apifyLoading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Apify…</>
                : <><Search className="w-3.5 h-3.5" /> Apify</>}
            </button>

            {/* LLM */}
            <button
              onClick={handleFetchLlm}
              disabled={llmLoading || !llmReady || !fetchHandle.trim()}
              title={llmReady ? "Run LLM content classification on cached Apify data" : "Run Apify first to populate content for classification"}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors whitespace-nowrap"
            >
              {llmLoading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> LLM…</>
                : <><Search className="w-3.5 h-3.5" /> LLM{!llmReady && <span className="text-white/40 ml-1 text-xs">(needs Apify)</span>}</>}
            </button>
          </div>

          {/* Live status + results */}
          {fetchState && (
            <div className="mt-4 space-y-3">
              {/* Status bar */}
              <div className="flex items-center gap-4 px-4 py-3 bg-white/5 rounded-lg flex-wrap">
                <span className="text-xs text-white/40 font-medium shrink-0">@{fetchState.handle}</span>

                {/* Live step badges */}
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-white/30">TwitterScore</span>
                    <StepBadge status={fetchState.steps.twitterScore} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-white/30">Apify</span>
                    <StepBadge status={fetchState.steps.apify} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-white/30">LLM</span>
                    <StepBadge status={fetchState.steps.llm} />
                  </div>
                </div>

                {/* Status message */}
                {fetchLoading && (
                  <span className="text-xs text-white/30 flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {fetchState.statusMessage}
                  </span>
                )}

                {/* Load button — appears as soon as any data exists */}
                {(fetchState.twitterScore || fetchState.apify || fetchState.llm) && (
                  <button
                    onClick={loadIntoInputs}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/70 hover:bg-indigo-600 rounded text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Load into Inputs
                  </button>
                )}
              </div>

              {/* Error */}
              {fetchError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-300">
                  {fetchError}
                </div>
              )}

              {loadedFields.length > 0 && (
                <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
                  Loaded {loadedFields.length} fields: {loadedFields.join(", ")}
                  <span className="text-emerald-300/40 ml-2">· authenticityScore, geoMatchScore, langMatchScore, and track record fields need manual input</span>
                </div>
              )}

              {/* TwitterScore data (appears first — fast) */}
              {fetchState.twitterScore && (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-white/5 hover:bg-white/8 transition-colors"
                    onClick={() => setRawOpen((o) => ({ ...o, twitterScore: !o.twitterScore }))}
                  >
                    <span className="text-xs font-medium text-white/60">TwitterScore Data</span>
                    {rawOpen.twitterScore ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
                  </button>
                  {rawOpen.twitterScore && (
                    <div className="px-4 py-3">
                      <RawDataRow label="twitterScoreValue" value={fetchState.twitterScore.twitterScoreValue} />
                      <RawDataRow label="twitterFollowers" value={fetchState.twitterScore.twitterFollowers?.toLocaleString()} />
                      <RawDataRow label="twitterId" value={fetchState.twitterScore.twitterId} />
                      <RawDataRow label="displayName" value={fetchState.twitterScore.displayName} />
                      <RawDataRow label="description" value={fetchState.twitterScore.description} />
                    </div>
                  )}
                </div>
              )}

              {/* Apify data (appears after scrape completes) */}
              {fetchState.apify && (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-white/5 hover:bg-white/8 transition-colors"
                    onClick={() => setRawOpen((o) => ({ ...o, apify: !o.apify }))}
                  >
                    <span className="text-xs font-medium text-white/60">Apify Data</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/30">{fetchState.apify.tweetCount} total · {fetchState.apify.originalCount} original</span>
                      {rawOpen.apify ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
                    </div>
                  </button>
                  {rawOpen.apify && (
                    <div className="px-4 py-3">
                      <RawDataRow label="tweetCount (total)" value={fetchState.apify.tweetCount} />
                      <RawDataRow label="originalCount (no RTs)" value={fetchState.apify.originalCount} />
                      <RawDataRow label="engagementRate" value={fetchState.apify.followersUsed > 0 ? `${fetchState.apify.engagementRate}%` : "N/A (run TwitterScore first)"} />
                      <RawDataRow label="followersUsed" value={fetchState.apify.followersUsed > 0 ? fetchState.apify.followersUsed.toLocaleString() : "unknown"} />
                      <RawDataRow label="avgLikes" value={fetchState.apify.avgLikes} />
                      <RawDataRow label="avgRetweets" value={fetchState.apify.avgRetweets} />
                      <RawDataRow label="avgReplies" value={fetchState.apify.avgReplies} />
                      <RawDataRow label="avgQuotes" value={fetchState.apify.avgQuotes} />
                      <RawDataRow label="rtToLikeRatio" value={`${fetchState.apify.rtToLikeRatio} (avgRT / avgLikes)`} />
                      <RawDataRow label="quoteTweetRatio" value={`${fetchState.apify.quoteTweetRatio} (quote posts / original)`} />
                      <RawDataRow label="avgPostsPerDay" value={fetchState.apify.avgPostsPerDay} />
                      <RawDataRow label="originalVsRtRatio" value={fetchState.apify.originalVsRtRatio} />
                    </div>
                  )}
                </div>
              )}

              {/* LLM data */}
              {fetchState.llm && (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-white/5 hover:bg-white/8 transition-colors"
                    onClick={() => setRawOpen((o) => ({ ...o, llm: !o.llm }))}
                  >
                    <span className="text-xs font-medium text-white/60">LLM Classification</span>
                    {rawOpen.llm ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
                  </button>
                  {rawOpen.llm && (
                    <div className="px-4 py-3">
                      <RawDataRow label="primaryLanguage" value={fetchState.llm.primaryLanguage} />
                      <RawDataRow label="secondaryLanguages" value={fetchState.llm.secondaryLanguages} />
                      <RawDataRow label="shillFrequency" value={fetchState.llm.shillFrequency} />
                      <RawDataRow label="replyQualityScore" value={fetchState.llm.replyQualityScore} />
                      <RawDataRow label="followerCryptoPct" value={fetchState.llm.followerCryptoPct} />
                      <RawDataRow label="contentVerticals" value={fetchState.llm.contentVerticals} />
                      <RawDataRow label="projectMentions" value={fetchState.llm.projectMentions} />
                    </div>
                  )}
                </div>
              )}

              {/* Skipped APIs note */}
              {fetchState.done && (fetchState.steps.apify === "skipped" || fetchState.steps.twitterScore === "skipped") && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300/70">
                  One or more APIs were skipped because their keys are not configured (APIFY_API_TOKEN, TWITTERSCORE_API_KEY).
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
          {/* Inputs */}
          <div className="space-y-4">
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-white/5 text-sm font-medium text-white/80">
                <Target className="w-4 h-4 text-indigo-400" />
                Campaign Parameters
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Max Price Per Post ($)</label>
                  <input type="number" min={1}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/60"
                    value={campaign.maxPricePerPost}
                    onChange={(e) => setC("maxPricePerPost", parseFloat(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Campaign Goal</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/60"
                    value={campaign.campaignGoal}
                    onChange={(e) => setC("campaignGoal", e.target.value as CampaignGoal)}
                  >
                    <option value="awareness">Awareness</option>
                    <option value="conversion">Conversion</option>
                    <option value="trust">Trust</option>
                  </select>
                </div>
                <TextInput label="Target Country" value={campaign.targetCountry} onChange={(v) => setC("targetCountry", v)} hint="e.g. US" />
                <TextInput label="Target Language" value={campaign.targetLanguage} onChange={(v) => setC("targetLanguage", v)} hint="e.g. english" />
                <div className="col-span-2">
                  <TextInput label="Target Niches" value={campaign.targetNiches} onChange={(v) => setC("targetNiches", v)} hint="comma-separated" />
                </div>
              </div>
            </div>

            <Section title="Audience & Reach" icon={Users}>
              <NumInput label="Twitter Followers" value={kol.twitterFollowers} onChange={(v) => setK("twitterFollowers", v)} />
              <NumInput label="Engagement Rate (%)" value={kol.engagementRate} onChange={(v) => setK("engagementRate", v)} min={0} max={100} step={0.1} />
              <NumInput label="Follower Crypto %" value={kol.followerCryptoPct} onChange={(v) => setK("followerCryptoPct", v)} min={0} max={100} />
              <NumInput label="VC Follower Count" value={kol.vcFollowerCount} onChange={(v) => setK("vcFollowerCount", v)} />
            </Section>

            <Section title="Content Quality" icon={BarChart2}>
              <NumInput label="Authenticity Score" value={kol.authenticityScore} onChange={(v) => setK("authenticityScore", v)} min={0} max={100} hint="0–100" />
              <NumInput label="TwitterScore Value" value={kol.twitterScoreValue} onChange={(v) => setK("twitterScoreValue", v)} min={0} max={100} hint="0–100" />
              <NumInput label="Reply Quality Score" value={kol.replyQualityScore} onChange={(v) => setK("replyQualityScore", v)} min={0} max={100} hint="0–100" />
              <NumInput label="Shill Frequency" value={kol.shillFrequency} onChange={(v) => setK("shillFrequency", v)} min={0} max={1} step={0.01} hint="0–1" />
              <NumInput label="Original vs RT Ratio" value={kol.originalVsRtRatio} onChange={(v) => setK("originalVsRtRatio", v)} min={0} max={1} step={0.01} hint="0–1" />
              <NumInput label="Thread Frequency" value={kol.threadFrequency} onChange={(v) => setK("threadFrequency", v)} min={0} max={1} step={0.01} hint="0–0.5" />
            </Section>

            <Section title="Virality & Posting" icon={TrendingUp}>
              <NumInput label="Avg Retweets" value={kol.avgRetweets} onChange={(v) => setK("avgRetweets", v)} />
              <NumInput label="RT/Like Ratio" value={kol.rtToLikeRatio} onChange={(v) => setK("rtToLikeRatio", v)} min={0} max={1} step={0.01} hint="0–1" />
              <NumInput label="Quote Tweet Ratio" value={kol.quoteTweetRatio} onChange={(v) => setK("quoteTweetRatio", v)} min={0} max={1} step={0.01} hint="0–1" />
              <NumInput label="Avg Posts / Day" value={kol.avgPostsPerDay} onChange={(v) => setK("avgPostsPerDay", v)} min={0} step={0.5} />
              <NumInput label="Eng. Consistency" value={kol.engagementConsistency} onChange={(v) => setK("engagementConsistency", v)} min={0} max={3} step={0.01} hint="0.7–1.0 ideal" />
            </Section>

            <Section title="Match Signals" icon={Globe}>
              <NumInput label="Geo Match Score" value={kol.geoMatchScore} onChange={(v) => setK("geoMatchScore", v)} min={0} max={1} step={0.01} hint="0–1" />
              <NumInput label="Lang Match Score" value={kol.langMatchScore} onChange={(v) => setK("langMatchScore", v)} min={0} max={1} step={0.01} hint="0–1" />
              <div className="col-span-2">
                <TextInput label="KOL Niches" value={kol.niches} onChange={(v) => setK("niches", v)} hint="comma-separated" />
              </div>
            </Section>

            <Section title="Track Record" icon={Star}>
              <NumInput label="Campaigns Completed" value={kol.campaignsCompleted} onChange={(v) => setK("campaignsCompleted", Math.round(v))} />
              <NumInput label="Avg Delivery Score" value={kol.avgDeliveryScore} onChange={(v) => setK("avgDeliveryScore", v)} min={0} max={100} hint="0–100" />
              <NumInput label="Post Reliability Rate" value={kol.postReliabilityRate} onChange={(v) => setK("postReliabilityRate", v)} min={0} max={1} step={0.01} hint="0–1" />
              <NumInput label="Client Satisfaction" value={kol.clientSatisfaction} onChange={(v) => setK("clientSatisfaction", v)} min={0} max={5} step={0.1} hint="0–5" />
              <NumInput label="Avg CPA ($)" value={kol.avgCpa} onChange={(v) => setK("avgCpa", v)} min={0} hint="0 = no data" />
            </Section>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {/* Match Score */}
            <div className="rounded-xl border border-white/10 bg-white/3 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Activity className="w-4 h-4" />
                  Match Score
                </div>
                <span className="text-xs text-white/30 capitalize">{campaign.campaignGoal} goal</span>
              </div>
              <div className={`text-6xl font-bold tabular-nums ${scoreColor}`}>
                {result.matchScore.toFixed(1)}
                <span className="text-2xl text-white/30 ml-1">/100</span>
              </div>
              <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${result.matchScore >= 70 ? "bg-emerald-500" : result.matchScore >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${result.matchScore}%` }}
                />
              </div>
            </div>

            {/* Dimension Breakdown */}
            <div className="rounded-xl border border-white/10 bg-white/3 p-5">
              <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
                <BarChart2 className="w-4 h-4" />
                Dimension Breakdown
              </div>
              <div className="space-y-3">
                {sortedDims.map(([key, dim]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/60">{dim.label}</span>
                      <span className="text-xs text-white/30">w={dim.weight.toFixed(1)}</span>
                    </div>
                    <ScoreBar score={dim.score} />
                  </div>
                ))}
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="rounded-xl border border-white/10 bg-white/3 p-5">
              <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
                <DollarSign className="w-4 h-4" />
                Price Breakdown
              </div>
              <div className="text-4xl font-bold text-white mb-5">
                ${result.priceBreakdown.finalPrice.toLocaleString()}
                <span className="text-sm font-normal text-white/30 ml-2">/ post</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-white/50">Base (max price)</span>
                  <span className="font-mono">${result.priceBreakdown.base.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <div><span className="text-white/50">Follower tier</span><span className="ml-2 text-xs text-white/30">{result.priceBreakdown.followerTierLabel}</span></div>
                  <span className="font-mono text-indigo-300">×{result.priceBreakdown.followerTier.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <div>
                    <span className="text-white/50">Performance mult.</span>
                    <span className="ml-2 text-xs text-white/30">
                      {kol.campaignsCompleted === 0 ? "no history" : kol.campaignsCompleted <= 2 ? "early career" : "experienced"}
                    </span>
                  </div>
                  <span className={`font-mono ${result.priceBreakdown.performanceMultiplier >= 1 ? "text-emerald-400" : "text-amber-400"}`}>
                    ×{result.priceBreakdown.performanceMultiplier.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-white/50">Match modifier</span>
                  <span className="font-mono text-indigo-300">×{result.priceBreakdown.matchModifier.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <div><span className="text-white/50">Reliability modifier</span><span className="ml-2 text-xs text-white/30">{result.priceBreakdown.reliabilityLabel}</span></div>
                  <span className={`font-mono ${result.priceBreakdown.reliabilityModifier === 1 ? "text-emerald-400" : result.priceBreakdown.reliabilityModifier >= 0.75 ? "text-amber-400" : "text-red-400"}`}>
                    ×{result.priceBreakdown.reliabilityModifier.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 font-medium">
                  <span>Final Price</span>
                  <span className="text-lg">${result.priceBreakdown.finalPrice.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-white/5 rounded-lg">
                <p className="text-xs text-white/30 font-mono leading-5">
                  ${result.priceBreakdown.base} × {result.priceBreakdown.followerTier}
                  {" "}× {result.priceBreakdown.performanceMultiplier.toFixed(3)}
                  {" "}× {result.priceBreakdown.matchModifier.toFixed(3)}
                  {" "}× {result.priceBreakdown.reliabilityModifier}
                  {" "}= <span className="text-white/60">${result.priceBreakdown.finalPrice}</span>
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-300/70 space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-amber-300/90 mb-2">
                <Info className="w-3.5 h-3.5" />
                Notes
              </div>
              <p>• Geo/Lang match scores entered directly (0–1). In production derived from follower geo data.</p>
              <p>• Dimension scores use fixed ranges, not peer KOL normalization — may differ slightly from live matching.</p>
              <p>• Client satisfaction {">"} 4.0 adds +5% to score; {"<"} 2.5 deducts 10%.</p>
            </div>
          </div>
        </div>
        </>}
      </div>
    </div>
  );
}
