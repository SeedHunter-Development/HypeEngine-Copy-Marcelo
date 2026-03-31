import { db, kolProfilesTable, kolFollowerSnapshotsTable } from "@/lib/db";
import { eq, and, gte } from "drizzle-orm";

export interface AuthenticityResult {
  authenticityScore: number;
  engRateFlag: number;
  consistencyFlag: number;
  replyQualityFlag: number;
  followerSampleFlag: number;
  growthPatternFlag: number;
  details: string;
  signalBreakdown: {
    engagementRate: { score: number; weight: number; label: string };
    consistency: { score: number; weight: number; label: string };
    replyQuality: { score: number; weight: number; label: string };
    followerSample: { score: number; weight: number; label: string };
    growthPattern: { score: number; weight: number; label: string };
  };
}

function lerp(
  x: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): number {
  if (x <= x0) return y0;
  if (x >= x1) return y1;
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

function engagementRateSignal(
  engRate: number | null,
  followers: number,
): { score: number; label: string } {
  if (engRate == null) {
    return { score: 0.5, label: "No data" };
  }

  let minHealthy: number;
  let maxHealthy: number;
  if (followers < 10_000) {
    minHealthy = 2;
    maxHealthy = 8;
  } else if (followers < 100_000) {
    minHealthy = 1;
    maxHealthy = 5;
  } else if (followers < 1_000_000) {
    minHealthy = 0.5;
    maxHealthy = 3;
  } else {
    minHealthy = 0.3;
    maxHealthy = 2;
  }

  if (engRate > 15) {
    const score = lerp(engRate, 15, 30, 0.6, 0.1);
    return { score, label: "Suspiciously high (pods?)" };
  }

  if (engRate >= minHealthy && engRate <= maxHealthy) {
    return { score: 1.0, label: "Within healthy range" };
  }

  if (engRate < minHealthy) {
    const score = lerp(engRate, 0, minHealthy, 0.0, 1.0);
    return { score, label: "Below healthy minimum" };
  }

  const score = lerp(engRate, maxHealthy, 15, 1.0, 0.6);
  return { score, label: "Above healthy range" };
}

function consistencySignal(
  cv: number | null,
): { score: number; label: string } {
  if (cv == null) {
    return { score: 0.5, label: "No data" };
  }

  if (cv < 0.3) {
    const score = lerp(cv, 0, 0.3, 0.0, 0.3);
    return { score, label: "Suspiciously uniform (pods/bots)" };
  }

  if (cv >= 0.4 && cv <= 1.5) {
    return { score: 1.0, label: "Natural variation" };
  }

  if (cv < 0.4) {
    return { score: lerp(cv, 0.3, 0.4, 0.3, 1.0), label: "Slightly uniform" };
  }

  if (cv > 2.0) {
    const score = lerp(cv, 2.0, 4.0, 0.3, 0.0);
    return { score: Math.max(0, score), label: "One-hit spike pattern" };
  }

  return { score: lerp(cv, 1.5, 2.0, 1.0, 0.3), label: "Slightly spiky" };
}

function replyQualitySignal(
  rqs: number | null,
): { score: number; weight: number; label: string } {
  if (rqs == null) {
    return { score: 0.5, weight: 0.15, label: "No data" };
  }
  return {
    score: rqs / 100,
    weight: 0.3,
    label:
      rqs >= 70
        ? "High quality replies"
        : rqs >= 40
          ? "Mixed reply quality"
          : "Low quality replies",
  };
}

function followerSampleSignal(
  flag: number | null,
): { score: number; weight: number; label: string } {
  if (flag == null) {
    return { score: 0.5, weight: 0.1, label: "No data" };
  }

  let score: number;
  if (flag <= 1.0) {
    score = lerp(flag, 0, 1.0, 1.0, 0.7);
  } else if (flag <= 2.0) {
    score = lerp(flag, 1.0, 2.0, 0.7, 0.4);
  } else if (flag <= 3.0) {
    score = lerp(flag, 2.0, 3.0, 0.4, 0.1);
  } else {
    score = 0.1;
  }

  return {
    score,
    weight: 0.2,
    label:
      score >= 0.7
        ? "Clean follower sample"
        : score >= 0.4
          ? "Some suspicious followers"
          : "High bot follower signals",
  };
}

async function growthPatternSignal(
  kolProfileId: string,
): Promise<{ score: number; weight: number; label: string }> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const snapshots = await db
    .select({
      snapshotDate: kolFollowerSnapshotsTable.snapshotDate,
      followerCount: kolFollowerSnapshotsTable.followerCount,
    })
    .from(kolFollowerSnapshotsTable)
    .where(
      and(
        eq(kolFollowerSnapshotsTable.kolProfileId, kolProfileId),
        gte(kolFollowerSnapshotsTable.snapshotDate, dateStr),
      ),
    );

  if (snapshots.length < 7) {
    return {
      score: 0.5,
      weight: 0.075,
      label: `Insufficient data (${snapshots.length}/7 snapshots)`,
    };
  }

  const sorted = [...snapshots].sort(
    (a, b) =>
      new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime(),
  );

  const dailyGrowth: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    dailyGrowth.push(sorted[i].followerCount - sorted[i - 1].followerCount);
  }

  const avgGrowth =
    dailyGrowth.reduce((a, b) => a + b, 0) / dailyGrowth.length;
  const threshold = Math.max(1, avgGrowth * 3);
  const spikeDays = dailyGrowth.filter(
    (g) => g > threshold && g > 100,
  ).length;

  let score: number;
  let label: string;
  if (spikeDays === 0) {
    score = 1.0;
    label = "Organic growth";
  } else if (spikeDays === 1) {
    score = 0.7;
    label = "1 growth spike";
  } else if (spikeDays <= 3) {
    score = 0.4;
    label = `${spikeDays} growth spikes`;
  } else {
    score = 0.1;
    label = `${spikeDays}+ spikes (unnatural)`;
  }

  return { score, weight: 0.15, label };
}

export async function computeAuthenticityScore(
  kolProfileId: string,
): Promise<AuthenticityResult> {
  const [profile] = await db
    .select({
      twitterFollowers: kolProfilesTable.twitterFollowers,
      engagementRate: kolProfilesTable.engagementRate,
      engagementConsistency: kolProfilesTable.engagementConsistency,
      replyQualityScore: kolProfilesTable.replyQualityScore,
      followerSampleFlag: kolProfilesTable.followerSampleFlag,
    })
    .from(kolProfilesTable)
    .where(eq(kolProfilesTable.id, kolProfileId));

  const followers = profile?.twitterFollowers ?? 50_000;

  const s1 = engagementRateSignal(
    profile?.engagementRate ?? null,
    followers,
  );
  const s2 = consistencySignal(profile?.engagementConsistency ?? null);
  const s3 = replyQualitySignal(profile?.replyQualityScore ?? null);
  const s4 = followerSampleSignal(profile?.followerSampleFlag ?? null);
  const s5 = await growthPatternSignal(kolProfileId);

  const signals = [
    { score: s1.score, weight: 0.2 },
    { score: s2.score, weight: 0.15 },
    { score: s3.score, weight: s3.weight },
    { score: s4.score, weight: s4.weight },
    { score: s5.score, weight: s5.weight },
  ];

  const weightedSum = signals.reduce((s, sig) => s + sig.score * sig.weight, 0);
  const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
  const authenticityScore = Math.round((weightedSum / totalWeight) * 100);

  const summaryParts: string[] = [];
  if (s1.score < 0.5) summaryParts.push(`engagement anomaly`);
  if (s2.score < 0.5) summaryParts.push(`consistency issues`);
  if (s3.score < 0.5) summaryParts.push(`low reply quality`);
  if (s4.score < 0.5) summaryParts.push(`suspicious followers`);
  if (s5.score < 0.5) summaryParts.push(`growth spikes`);

  const details =
    summaryParts.length === 0
      ? "Signals look authentic across all dimensions"
      : `Flags: ${summaryParts.join(", ")}`;

  return {
    authenticityScore,
    engRateFlag: s1.score,
    consistencyFlag: s2.score,
    replyQualityFlag: s3.score,
    followerSampleFlag: s4.score,
    growthPatternFlag: s5.score,
    details,
    signalBreakdown: {
      engagementRate: { score: Math.round(s1.score * 100), weight: 20, label: s1.label },
      consistency: { score: Math.round(s2.score * 100), weight: 15, label: s2.label },
      replyQuality: { score: Math.round(s3.score * 100), weight: Math.round(s3.weight * 100), label: s3.label },
      followerSample: { score: Math.round(s4.score * 100), weight: Math.round(s4.weight * 100), label: s4.label },
      growthPattern: { score: Math.round(s5.score * 100), weight: Math.round(s5.weight * 100), label: s5.label },
    },
  };
}
