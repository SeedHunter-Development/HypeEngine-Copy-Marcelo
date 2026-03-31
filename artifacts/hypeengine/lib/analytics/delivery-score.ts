import { db, kolCampaignScoresTable, campaignKolMatchesTable, campaignResultsTable, trackingLinksTable, trackingClicksTable, trackingConversionsTable, kolProfilesTable, postsTable } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";

interface KolDeliveryInput {
  matchId: string;
  kolProfileId: string;
  campaignId: string;
  tweetUrl?: string | null;
  tweetLikes?: number | null;
  tweetRetweets?: number | null;
  tweetReplies?: number | null;
  tweetViews?: number | null;
  clientRating?: number | null;
  clientFeedback?: string | null;
  avgLikes?: number | null;
  campaignGoal?: string;
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function scoreEngagementDelivery(
  tweetLikes: number | null | undefined,
  tweetRetweets: number | null | undefined,
  tweetReplies: number | null | undefined,
  avgLikes: number | null | undefined,
): number {
  if (!tweetLikes || !avgLikes || avgLikes === 0) return 0.5;
  const totalEng = (tweetLikes ?? 0) + (tweetRetweets ?? 0) + (tweetReplies ?? 0);
  const expectedEng = avgLikes * 1.5;
  return clamp(totalEng / (expectedEng * 1.5));
}

function scoreCtr(clicks: number, views: number | null | undefined): number {
  if (!views || views === 0 || clicks === 0) return 0.5;
  const ctr = clicks / views;
  return clamp(ctr / 0.10);
}

function scoreConversionRate(conversions: number, uniqueClicks: number): number {
  if (uniqueClicks === 0 || conversions === 0) return 0.5;
  const rate = conversions / uniqueClicks;
  return clamp(rate / 0.05);
}

function scoreClientSatisfaction(rating: number | null | undefined): { score: number; weight: number } {
  if (rating === null || rating === undefined) return { score: 0.5, weight: 0.05 };
  return { score: clamp(rating / 5), weight: 0.10 };
}

interface EngagementSnapshot {
  likes: number;
  retweets: number;
  replies: number;
  views: number;
}

function parseEngagement(raw: unknown): EngagementSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    likes: Number(r.likes ?? 0),
    retweets: Number(r.retweets ?? 0),
    replies: Number(r.replies ?? 0),
    views: Number(r.views ?? 0),
  };
}

function scoreEngagementGrowthPattern(verification: {
  check1hEngagement: unknown;
  check24hEngagement: unknown;
  check72hEngagement: unknown;
  check7dEngagement: unknown;
} | null): { score: number; hasData: boolean } {
  if (!verification) return { score: 0.5, hasData: false };

  const snapshots = [
    parseEngagement(verification.check1hEngagement),
    parseEngagement(verification.check24hEngagement),
    parseEngagement(verification.check72hEngagement),
    parseEngagement(verification.check7dEngagement),
  ].filter((s): s is EngagementSnapshot => s !== null);

  if (snapshots.length < 2) return { score: 0.5, hasData: false };

  // Compute total engagement at each snapshot
  const totals = snapshots.map((s) => s.likes + s.retweets + s.replies);

  // Measure growth: positive monotonic growth = ideal
  let growthScore = 0;
  let growthChecks = 0;

  for (let i = 1; i < totals.length; i++) {
    growthChecks++;
    const prev = totals[i - 1];
    const curr = totals[i];
    if (prev === 0 && curr === 0) {
      growthScore += 0.5;
    } else if (curr >= prev) {
      // Growing — reward proportional to growth rate (capped at 10x)
      const growthRate = prev > 0 ? curr / prev : 2;
      growthScore += clamp(Math.log10(growthRate + 1) / Math.log10(11));
    } else {
      // Declining
      const declineRate = curr / prev;
      growthScore += declineRate * 0.5; // still partial credit
    }
  }

  // Final score: average growth across checkpoints
  const rawGrowth = growthScore / growthChecks;

  // Bonus: later snapshots still getting engagement = healthy decay
  const lastTotal = totals[totals.length - 1];
  const firstTotal = totals[0];
  const decayBonus = firstTotal > 0 && lastTotal / firstTotal >= 0.3 ? 0.1 : 0;

  return { score: clamp(rawGrowth + decayBonus), hasData: true };
}

export async function scoreCampaignDelivery(campaignId: string): Promise<void> {
  const matches = await db
    .select({
      id: campaignKolMatchesTable.id,
      kolProfileId: campaignKolMatchesTable.kolProfileId,
      priceAgreed: campaignKolMatchesTable.priceAgreed,
    })
    .from(campaignKolMatchesTable)
    .where(
      and(
        eq(campaignKolMatchesTable.campaignId, campaignId),
        eq(campaignKolMatchesTable.status, "booked"),
      ),
    );

  const campaign = await db.query?.campaignsTable?.findFirst?.({ where: (t, { eq }) => eq(t.id, campaignId) });
  const campaignGoal = (campaign as { campaignGoal?: string } | undefined)?.campaignGoal ?? "awareness";

  for (const match of matches) {
    const trackingLink = await db
      .select()
      .from(trackingLinksTable)
      .where(eq(trackingLinksTable.matchId, match.id))
      .then((rows) => rows[0] ?? null);

    let clicks = 0;
    let uniqueClicks = 0;
    let conversions = 0;
    let conversionValue = 0;

    if (trackingLink) {
      const clickRows = await db
        .select({ count: sql<number>`count(*)::int`, uniqueIps: sql<number>`count(distinct ip_hash)::int` })
        .from(trackingClicksTable)
        .where(eq(trackingClicksTable.trackingLinkId, trackingLink.id));
      clicks = clickRows[0]?.count ?? 0;
      uniqueClicks = clickRows[0]?.uniqueIps ?? 0;

      const convRows = await db
        .select({ count: sql<number>`count(*)::int`, value: sql<number>`coalesce(sum(event_value), 0)::float` })
        .from(trackingConversionsTable)
        .where(eq(trackingConversionsTable.trackingLinkId, trackingLink.id));
      conversions = convRows[0]?.count ?? 0;
      conversionValue = convRows[0]?.value ?? 0;
    }

    const existing = await db
      .select()
      .from(kolCampaignScoresTable)
      .where(
        and(
          eq(kolCampaignScoresTable.campaignId, campaignId),
          eq(kolCampaignScoresTable.kolProfileId, match.kolProfileId),
        ),
      )
      .then((rows) => rows[0] ?? null);

    const tweetLikes = existing?.tweetLikes ?? null;
    const tweetRetweets = existing?.tweetRetweets ?? null;
    const tweetReplies = existing?.tweetReplies ?? null;
    const tweetViews = existing?.tweetViews ?? null;
    const clientRating = existing?.clientRating ?? null;

    const kol = await db.select({ avgLikes: kolProfilesTable.avgLikes })
      .from(kolProfilesTable)
      .where(eq(kolProfilesTable.id, match.kolProfileId))
      .then((rows) => rows[0] ?? null);

    const verificationRecord = null;

    const engDelivery = scoreEngagementDelivery(tweetLikes, tweetRetweets, tweetReplies, kol?.avgLikes);
    const replyQuality = existing?.tweetReplyQuality != null ? existing.tweetReplyQuality / 100 : 0.5;
    const contentCompliance = existing?.contentComplianceScore != null ? existing.contentComplianceScore / 100 : 0.5;
    const ctr = scoreCtr(clicks, tweetViews);
    const convRate = scoreConversionRate(conversions, uniqueClicks);
    const { score: satScore, weight: satWeight } = scoreClientSatisfaction(clientRating);
    const { score: growthScore, hasData: hasGrowthData } = scoreEngagementGrowthPattern(verificationRecord);

    // Engagement weight is 0.15 (reduced from 0.25 to make room for growth pattern at 0.10)
    let engWeight = 0.15;
    let growthWeight = hasGrowthData ? 0.10 : 0;
    let ctrWeight = 0.20;
    let convWeight = 0.20;
    let replyWeight = 0.15;
    let complianceWeight = 0.10;

    if (campaignGoal !== "conversion") {
      // Redistribute convWeight: give more to engagement and growth
      engWeight = hasGrowthData ? 0.35 : 0.45;
      growthWeight = hasGrowthData ? 0.10 : 0;
      ctrWeight = 0.30;
      convWeight = 0;
    }

    const activeWeight = engWeight + replyWeight + complianceWeight + ctrWeight + convWeight + satWeight + growthWeight;
    const rawScore =
      (engDelivery * engWeight +
        replyQuality * replyWeight +
        contentCompliance * complianceWeight +
        ctr * ctrWeight +
        convRate * convWeight +
        satScore * satWeight +
        growthScore * growthWeight) /
      activeWeight;

    const deliveryScore = Math.round(rawScore * 100);
    const cpa = conversions > 0 && match.priceAgreed ? match.priceAgreed / conversions : null;
    const ctrPct = tweetViews ? clicks / tweetViews : null;
    const convRatePct = uniqueClicks > 0 ? conversions / uniqueClicks : null;

    const upsertValues = {
      campaignId,
      kolProfileId: match.kolProfileId,
      matchId: match.id,
      clicks,
      uniqueClicks,
      conversions,
      conversionValue,
      tweetLikes: existing?.tweetLikes,
      tweetRetweets: existing?.tweetRetweets,
      tweetReplies: existing?.tweetReplies,
      tweetViews: existing?.tweetViews,
      tweetUrl: existing?.tweetUrl,
      tweetReplyQuality: existing?.tweetReplyQuality,
      contentComplianceScore: existing?.contentComplianceScore,
      engagementDeliveryScore: Math.round(engDelivery * 100),
      clickThroughRate: ctrPct,
      conversionRate: convRatePct,
      costPerAcquisition: cpa,
      clientRating: existing?.clientRating,
      clientFeedback: existing?.clientFeedback,
      deliveryScore,
    };

    if (existing) {
      await db
        .update(kolCampaignScoresTable)
        .set(upsertValues)
        .where(eq(kolCampaignScoresTable.id, existing.id));
    } else {
      await db.insert(kolCampaignScoresTable).values(upsertValues);
    }
  }

  await upsertCampaignResults(campaignId);
}

async function upsertCampaignResults(campaignId: string): Promise<void> {
  const scores = await db
    .select()
    .from(kolCampaignScoresTable)
    .where(eq(kolCampaignScoresTable.campaignId, campaignId));

  const totalClicks = scores.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const uniqueClicks = scores.reduce((s, r) => s + (r.uniqueClicks ?? 0), 0);
  const totalConversions = scores.reduce((s, r) => s + (r.conversions ?? 0), 0);
  const totalValue = scores.reduce((s, r) => s + (r.conversionValue ?? 0), 0);
  const withScore = scores.filter((r) => r.deliveryScore !== null);
  const overallDelivery = withScore.length > 0
    ? withScore.reduce((s, r) => s + (r.deliveryScore ?? 0), 0) / withScore.length
    : null;

  const links = await db
    .select()
    .from(trackingLinksTable)
    .where(eq(trackingLinksTable.campaignId, campaignId));

  const linkIds = links.map((l) => l.id);
  let ctr: number | null = null;
  if (linkIds.length > 0) {
    const allViews = scores.reduce((s, r) => s + (r.tweetViews ?? 0), 0);
    ctr = allViews > 0 ? totalClicks / allViews : null;
  }

  const avgCpa = totalConversions > 0 ? totalValue / totalConversions : null;

  const existing = await db
    .select({ id: campaignResultsTable.id })
    .from(campaignResultsTable)
    .where(eq(campaignResultsTable.campaignId, campaignId))
    .then((rows) => rows[0] ?? null);

  const values = {
    campaignId,
    totalClicks,
    uniqueClicks,
    totalConversions,
    totalConversionValue: totalValue,
    avgCpa,
    avgCtr: ctr,
    overallDeliveryScore: overallDelivery,
    completedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(campaignResultsTable).set(values).where(eq(campaignResultsTable.id, existing.id));
  } else {
    await db.insert(campaignResultsTable).values(values);
  }
}
