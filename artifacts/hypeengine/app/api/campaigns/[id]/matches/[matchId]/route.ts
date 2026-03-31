import { NextRequest, NextResponse } from "next/server";
import { db, campaignKolMatchesTable, campaignsTable } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { generateTrackingLink } from "@/lib/tracking/links";
import { generatePersonalizedTweet } from "@/lib/tracking/tweet-generator";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const { id: campaignId, matchId } = await params;
  const body = await req.json() as Record<string, unknown>;

  const [campaign] = await db
    .select({ clientId: campaignsTable.clientId, landingPageUrl: campaignsTable.landingPageUrl })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId));

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const allowedStatuses = ["recommended", "booked", "active", "completed", "rejected"] as const;
  const newStatus = body.status as typeof allowedStatuses[number] | undefined;
  if (newStatus && !allowedStatuses.includes(newStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updateValues: Partial<typeof campaignKolMatchesTable.$inferSelect> = {};
  if (newStatus) updateValues.status = newStatus;
  if (typeof body.priceAgreed === "number") updateValues.priceAgreed = body.priceAgreed;

  const [updated] = await db
    .update(campaignKolMatchesTable)
    .set(updateValues)
    .where(
      and(
        eq(campaignKolMatchesTable.id, matchId),
        eq(campaignKolMatchesTable.campaignId, campaignId),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (newStatus === "booked") {
    const destinationUrl = campaign.landingPageUrl ?? "https://hypeengine.app";
    try {
      await generateTrackingLink(campaignId, updated.kolProfileId, matchId, destinationUrl);
    } catch {
    }

    // Auto-generate personalized tweet for KOL
    try {
      const tweet = await generatePersonalizedTweet(campaignId, updated.kolProfileId, matchId);
      await db
        .update(campaignKolMatchesTable)
        .set({
          generatedTweetText: tweet.tweetText,
          originalTemplate: tweet.templateUsed,
        })
        .where(eq(campaignKolMatchesTable.id, matchId));
    } catch (e) {
      console.error("[TweetGen] Auto-generate failed:", e);
    }
  }

  return NextResponse.json(updated);
}
