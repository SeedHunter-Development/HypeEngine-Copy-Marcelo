import { db, kolProfilesTable, kolCampaignScoresTable, campaignsTable } from "@/lib/db";
import { eq, and, isNotNull } from "drizzle-orm";

export async function updateKolProfileFromCampaignHistory(kolProfileId: string): Promise<void> {
  const scores = await db
    .select({
      campaignId: kolCampaignScoresTable.campaignId,
      conversions: kolCampaignScoresTable.conversions,
      conversionValue: kolCampaignScoresTable.conversionValue,
      uniqueClicks: kolCampaignScoresTable.uniqueClicks,
      costPerAcquisition: kolCampaignScoresTable.costPerAcquisition,
      clientRating: kolCampaignScoresTable.clientRating,
      deliveryScore: kolCampaignScoresTable.deliveryScore,
    })
    .from(kolCampaignScoresTable)
    .where(
      and(
        eq(kolCampaignScoresTable.kolProfileId, kolProfileId),
        isNotNull(kolCampaignScoresTable.deliveryScore),
      ),
    );

  if (scores.length === 0) return;

  const campaignIds = [...new Set(scores.map((s) => s.campaignId))];

  const campaigns = await db
    .select({
      id: campaignsTable.id,
      campaignGoal: campaignsTable.campaignGoal,
      targetNiches: campaignsTable.targetNiches,
      createdAt: campaignsTable.createdAt,
    })
    .from(campaignsTable)
    .where(
      campaignIds.length === 1
        ? eq(campaignsTable.id, campaignIds[0])
        : eq(campaignsTable.id, campaignIds[0]),
    );

  const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

  const now = Date.now();
  const RECENCY_CUTOFF_MS = 90 * 24 * 60 * 60 * 1000;

  const avgCpaByGoal: Record<string, number> = {};
  const goalCpaAccum: Record<string, { sum: number; count: number }> = {};
  const convRateByVertical: Record<string, number> = {};
  const vertConvAccum: Record<string, { sum: number; count: number }> = {};
  let satisfactionSum = 0;
  let satisfactionCount = 0;
  let campaignsCompleted = scores.length;

  for (const score of scores) {
    const camp = campaignMap.get(score.campaignId);
    const goal = camp?.campaignGoal ?? "awareness";
    const niches: string[] = (camp?.targetNiches as string[] | null) ?? [];

    const isRecent = camp?.createdAt
      ? now - new Date(camp.createdAt).getTime() < RECENCY_CUTOFF_MS
      : false;
    const weight = isRecent ? 2 : 1;

    if (score.costPerAcquisition !== null && score.costPerAcquisition !== undefined) {
      if (!goalCpaAccum[goal]) goalCpaAccum[goal] = { sum: 0, count: 0 };
      goalCpaAccum[goal].sum += score.costPerAcquisition * weight;
      goalCpaAccum[goal].count += weight;
    }

    const convRate =
      score.uniqueClicks && score.uniqueClicks > 0
        ? (score.conversions ?? 0) / score.uniqueClicks
        : null;
    if (convRate !== null) {
      for (const niche of niches) {
        if (!vertConvAccum[niche]) vertConvAccum[niche] = { sum: 0, count: 0 };
        vertConvAccum[niche].sum += convRate * weight;
        vertConvAccum[niche].count += weight;
      }
    }

    if (score.clientRating !== null && score.clientRating !== undefined) {
      satisfactionSum += score.clientRating * weight;
      satisfactionCount += weight;
    }
  }

  for (const [goal, accum] of Object.entries(goalCpaAccum)) {
    avgCpaByGoal[goal] = accum.sum / accum.count;
  }
  for (const [niche, accum] of Object.entries(vertConvAccum)) {
    convRateByVertical[niche] = accum.sum / accum.count;
  }

  const clientSatisfaction = satisfactionCount > 0 ? satisfactionSum / satisfactionCount : null;

  const kol = await db
    .select({ twitterFollowers: kolProfilesTable.twitterFollowers, clientSatisfaction: kolProfilesTable.clientSatisfaction })
    .from(kolProfilesTable)
    .where(eq(kolProfilesTable.id, kolProfileId))
    .then((rows) => rows[0] ?? null);

  if (!kol) return;

  const followers = kol.twitterFollowers ?? 0;
  const tier = followers < 10000 ? "nano" : followers < 100000 ? "micro" : followers < 500000 ? "mid" : "macro";
  const tierMedianCpa: Record<string, number> = { nano: 8, micro: 15, mid: 30, macro: 60 };
  const medianCpa = tierMedianCpa[tier];

  let priceCompetitiveness: number | null = null;
  const conversionCpa = avgCpaByGoal["conversion"];
  if (conversionCpa !== undefined && medianCpa > 0) {
    priceCompetitiveness = Math.max(0.5, Math.min(2.0, medianCpa / conversionCpa));
  }

  await db
    .update(kolProfilesTable)
    .set({
      avgCpaByGoal: Object.keys(avgCpaByGoal).length > 0 ? avgCpaByGoal : undefined,
      convRateByVertical: Object.keys(convRateByVertical).length > 0 ? convRateByVertical : undefined,
      clientSatisfaction: clientSatisfaction ?? undefined,
      campaignsCompleted,
      priceCompetitiveness: priceCompetitiveness ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(kolProfilesTable.id, kolProfileId));
}
