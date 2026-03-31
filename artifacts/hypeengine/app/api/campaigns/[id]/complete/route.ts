import { NextRequest, NextResponse } from "next/server";
import { db, campaignKolMatchesTable, campaignsTable, kolCampaignScoresTable } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { scoreCampaignDelivery } from "@/lib/analytics/delivery-score";
import { updateKolProfileFromCampaignHistory } from "@/lib/analytics/feedback-loop";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;

  const body = await req.json() as {
    ratings?: Array<{ matchId: string; kolProfileId: string; rating: number; feedback?: string }>;
  };

  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId));

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (body.ratings && body.ratings.length > 0) {
    for (const r of body.ratings) {
      const existing = await db
        .select({ id: kolCampaignScoresTable.id })
        .from(kolCampaignScoresTable)
        .where(
          and(
            eq(kolCampaignScoresTable.campaignId, campaignId),
            eq(kolCampaignScoresTable.kolProfileId, r.kolProfileId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (existing) {
        await db
          .update(kolCampaignScoresTable)
          .set({ clientRating: r.rating, clientFeedback: r.feedback ?? null })
          .where(eq(kolCampaignScoresTable.id, existing.id));
      } else {
        await db.insert(kolCampaignScoresTable).values({
          campaignId,
          kolProfileId: r.kolProfileId,
          matchId: r.matchId,
          clientRating: r.rating,
          clientFeedback: r.feedback ?? null,
        });
      }
    }
  }

  await scoreCampaignDelivery(campaignId);

  const bookedMatches = await db
    .select({ kolProfileId: campaignKolMatchesTable.kolProfileId })
    .from(campaignKolMatchesTable)
    .where(
      and(
        eq(campaignKolMatchesTable.campaignId, campaignId),
        eq(campaignKolMatchesTable.status, "booked"),
      ),
    );

  for (const match of bookedMatches) {
    await updateKolProfileFromCampaignHistory(match.kolProfileId);
  }

  await db
    .update(campaignKolMatchesTable)
    .set({ status: "completed" })
    .where(
      and(
        eq(campaignKolMatchesTable.campaignId, campaignId),
        eq(campaignKolMatchesTable.status, "booked"),
      ),
    );

  await db
    .update(campaignsTable)
    .set({ status: "completed" })
    .where(eq(campaignsTable.id, campaignId));

  const finalScores = await db
    .select()
    .from(kolCampaignScoresTable)
    .where(eq(kolCampaignScoresTable.campaignId, campaignId));

  const totalSpend = finalScores.reduce(
    (s, r) => s + ((bookedMatches.find((m) => m.kolProfileId === r.kolProfileId) ? 0 : 0)),
    0,
  );

  const bestKol = finalScores.reduce(
    (best, r) => (!best || (r.deliveryScore ?? 0) > (best.deliveryScore ?? 0) ? r : best),
    null as typeof finalScores[number] | null,
  );
  const worstKol = finalScores.reduce(
    (worst, r) => (!worst || (r.deliveryScore ?? 100) < (worst.deliveryScore ?? 100) ? r : worst),
    null as typeof finalScores[number] | null,
  );

  return NextResponse.json({
    success: true,
    summary: {
      totalConversions: finalScores.reduce((s, r) => s + (r.conversions ?? 0), 0),
      totalConversionValue: finalScores.reduce((s, r) => s + (r.conversionValue ?? 0), 0),
      avgDeliveryScore: finalScores.length > 0
        ? finalScores.reduce((s, r) => s + (r.deliveryScore ?? 0), 0) / finalScores.length
        : null,
      bestKolId: bestKol?.kolProfileId ?? null,
      worstKolId: worstKol?.kolProfileId ?? null,
      kolCount: finalScores.length,
    },
  });
}
