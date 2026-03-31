/**
 * HypeEngine Scoring Engine
 *
 * Mirrors the calculate() function in admin/pricing-test/page.tsx exactly.
 * All missing kol_profile fields should be passed as 0 (not null/undefined).
 * The engine already handles 0-value fields gracefully without special cases.
 */

export type CampaignGoal = "awareness" | "conversion" | "community";

export interface ScoringCampaign {
  maxPricePerPost: number;
  campaignGoal: CampaignGoal;
  targetCountry: string;
  targetLanguage: string;
  targetNiches: string[];
}

export interface ScoringKol {
  twitterFollowers: number;
  engagementRate: number;
  authenticityScore: number;
  twitterScoreValue: number;
  niches: string[];
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

export interface DimEntry {
  score: number;
  weight: number;
  label: string;
}

export interface ScoreResult {
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

// ── Pure math helpers ────────────────────────────────────────────────────────

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

// ── Geo / lang helpers ───────────────────────────────────────────────────────

// Maps common country names → ISO-3166-1 alpha-2 codes
const COUNTRY_TO_CODE: Record<string, string> = {
  "united states": "US", "united states of america": "US", "usa": "US", "us": "US",
  "united kingdom": "GB", "uk": "GB", "great britain": "GB",
  "germany": "DE", "france": "FR", "spain": "ES", "italy": "IT",
  "netherlands": "NL", "switzerland": "CH", "sweden": "SE", "norway": "NO", "denmark": "DK",
  "japan": "JP", "south korea": "KR", "china": "CN", "singapore": "SG", "hong kong": "HK",
  "india": "IN", "uae": "AE", "united arab emirates": "AE", "saudi arabia": "SA",
  "turkey": "TR", "ukraine": "UA", "russia": "RU", "poland": "PL",
  "brazil": "BR", "mexico": "MX", "argentina": "AR", "colombia": "CO",
  "philippines": "PH", "indonesia": "ID", "thailand": "TH", "malaysia": "MY", "vietnam": "VN",
  "nigeria": "NG", "south africa": "ZA", "kenya": "KE", "egypt": "EG", "canada": "CA",
  "australia": "AU", "portugal": "PT", "belgium": "BE", "austria": "AT",
};

export function countryToCode(name: string): string {
  if (!name) return "";
  const key = name.toLowerCase().trim();
  return COUNTRY_TO_CODE[key] ?? (name.length === 2 ? name.toUpperCase() : name);
}

/**
 * Compute geo match score [0,1] from Apify followerSampleGeo dict and a campaign
 * target country. Falls back to userCountry (from users table) if no geo dict.
 */
export function computeGeoMatch(
  followerSampleGeo: Record<string, number> | null | undefined,
  targetCountry: string,
  userCountry?: string | null,
): number {
  if (!targetCountry) return 0.5;
  const targetCode = countryToCode(targetCountry);

  // Use Apify geo sample if available
  if (followerSampleGeo && typeof followerSampleGeo === "object") {
    const keys = Object.keys(followerSampleGeo);
    if (keys.length > 0) {
      const pct = (followerSampleGeo[targetCode] ?? followerSampleGeo[targetCountry] ?? 0) as number;
      // pct may be 0–1 (fraction) or 0–100 (percent) — normalise to [0,1]
      const frac = pct > 1 ? pct / 100 : pct;
      return Math.max(0, Math.min(1, frac));
    }
  }

  // Fallback: exact country match from user profile
  if (userCountry) {
    const userCode = countryToCode(userCountry);
    return userCode === targetCode ? 1.0 : 0.0;
  }

  return 0.5; // neutral — no data
}

/**
 * Compute language match score [0,1].
 */
export function computeLangMatch(
  primaryLanguage: string | null | undefined,
  secondaryLanguages: string[] | null | undefined,
  targetLanguage: string,
  userLanguage?: string | null,
): number {
  if (!targetLanguage) return 0.5;
  const target = targetLanguage.toLowerCase().trim();

  const primary = (primaryLanguage ?? userLanguage ?? "").toLowerCase().trim();
  if (primary && primary === target) return 1.0;

  // Check secondary languages
  if (secondaryLanguages?.some((l) => l.toLowerCase().trim() === target)) return 0.7;

  // If we have some language info but it doesn't match → low score
  if (primary) return 0.1;

  return 0.5; // no info → neutral
}

// ── Main scoring function ────────────────────────────────────────────────────

export function scoreKol(c: ScoringCampaign, k: ScoringKol): ScoreResult {
  const vertScore = jaccardSimilarity(c.targetNiches, k.niches);

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
    // community / trust
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

  // ── Price calculation ──────────────────────────────────────────────────────
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
    priceBreakdown: {
      base, followerTier, followerTierLabel,
      performanceMultiplier, matchModifier,
      reliabilityModifier, reliabilityLabel,
      finalPrice,
    },
  };
}

/**
 * Build a ScoringKol from a kol_profile DB row + user row.
 * All null/undefined fields default to 0 (or safe neutral values).
 * avgDeliveryScore is derived from clientSatisfaction as a proxy until
 * campaign history is available.
 */
export function buildScoringKol(
  kp: {
    twitterFollowers?: number | null;
    engagementRate?: number | null;
    authenticityScore?: number | null;
    twitterScoreValue?: number | null;
    niches?: string[] | null;
    campaignsCompleted?: number | null;
    clientSatisfaction?: number | null;
    postReliabilityRate?: number | null;
    shillFrequency?: number | null;
    avgRetweets?: number | null;
    rtToLikeRatio?: number | null;
    quoteTweetRatio?: number | null;
    avgPostsPerDay?: number | null;
    replyQualityScore?: number | null;
    followerCryptoPct?: number | null;
    vcFollowerCount?: number | null;
    originalVsRtRatio?: number | null;
    threadFrequency?: number | null;
    engagementConsistency?: number | null;
    followerSampleGeo?: Record<string, number> | null;
    primaryLanguage?: string | null;
    secondaryLanguages?: string[] | null;
    avgCpaByGoal?: Record<string, number> | null;
  },
  user: {
    country?: string | null;
    language?: string | null;
  },
  campaign: ScoringCampaign,
): ScoringKol {
  const avgCpa =
    (kp.avgCpaByGoal as Record<string, number> | null)?.[campaign.campaignGoal] ??
    0;

  // Proxy avg delivery score from satisfaction rating (0–5 scale → 0–100)
  const sat = kp.clientSatisfaction ?? 0;
  const avgDeliveryScore = sat > 0 ? Math.min(100, (sat / 5) * 100) : 75;

  return {
    twitterFollowers:    kp.twitterFollowers    ?? 0,
    engagementRate:      kp.engagementRate      ?? 0,
    authenticityScore:   0,
    twitterScoreValue:   kp.twitterScoreValue   ?? 0,
    niches:              kp.niches              ?? [],
    campaignsCompleted:  kp.campaignsCompleted  ?? 0,
    avgDeliveryScore,
    postReliabilityRate: kp.postReliabilityRate ?? 1.0,
    shillFrequency:      kp.shillFrequency      ?? 0,
    avgRetweets:         kp.avgRetweets         ?? 0,
    rtToLikeRatio:       kp.rtToLikeRatio       ?? 0,
    quoteTweetRatio:     kp.quoteTweetRatio      ?? 0,
    avgPostsPerDay:      kp.avgPostsPerDay       ?? 0,
    replyQualityScore:   kp.replyQualityScore    ?? 0,
    followerCryptoPct:   kp.followerCryptoPct    ?? 0,
    vcFollowerCount:     kp.vcFollowerCount      ?? 0,
    originalVsRtRatio:   kp.originalVsRtRatio    ?? 0,
    threadFrequency:     kp.threadFrequency      ?? 0,
    engagementConsistency: kp.engagementConsistency ?? 0,
    clientSatisfaction:  sat,
    geoMatchScore: computeGeoMatch(
      kp.followerSampleGeo as Record<string, number> | null,
      campaign.targetCountry,
      user.country,
    ),
    langMatchScore: computeLangMatch(
      kp.primaryLanguage,
      kp.secondaryLanguages ?? [],
      campaign.targetLanguage,
      user.language,
    ),
    avgCpa,
  };
}
