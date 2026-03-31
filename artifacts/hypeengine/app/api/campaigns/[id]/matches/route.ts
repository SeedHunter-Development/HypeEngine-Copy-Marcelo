import { NextRequest, NextResponse } from "next/server";
import { db, campaignKolMatchesTable, kolProfilesTable, usersTable, campaignsTable } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;

  const [campaign] = await db
    .select({ clientId: campaignsTable.clientId })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId));

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const rows = await db
    .select({
      matchId: campaignKolMatchesTable.id,
      kolProfileId: campaignKolMatchesTable.kolProfileId,
      matchScore: campaignKolMatchesTable.matchScore,
      matchBreakdown: campaignKolMatchesTable.matchBreakdown,
      status: campaignKolMatchesTable.status,
      priceAgreed: campaignKolMatchesTable.priceAgreed,
      createdAt: campaignKolMatchesTable.createdAt,
      twitterHandle: kolProfilesTable.twitterHandle,
      twitterFollowers: kolProfilesTable.twitterFollowers,
      niches: kolProfilesTable.niches,
      primaryLanguage: kolProfilesTable.primaryLanguage,
      contentVerticals: kolProfilesTable.contentVerticals,
      replyLangDist: kolProfilesTable.replyLangDist,
      followerCryptoPct: kolProfilesTable.followerCryptoPct,
      authenticityScore: kolProfilesTable.authenticityScore,
      twitterScoreValue: kolProfilesTable.twitterScoreValue,
      engagementRate: kolProfilesTable.engagementRate,
      avgLikes: kolProfilesTable.avgLikes,
      avgRetweets: kolProfilesTable.avgRetweets,
      avgReplies: kolProfilesTable.avgReplies,
      campaignsCompleted: kolProfilesTable.campaignsCompleted,
      clientSatisfaction: kolProfilesTable.clientSatisfaction,
      postReliabilityRate: kolProfilesTable.postReliabilityRate,
      userId: usersTable.id,
      kolName: usersTable.name,
      userCountry: usersTable.country,
      userBio: usersTable.bio,
    })
    .from(campaignKolMatchesTable)
    .innerJoin(kolProfilesTable, eq(campaignKolMatchesTable.kolProfileId, kolProfilesTable.id))
    .innerJoin(usersTable, eq(kolProfilesTable.userId, usersTable.id))
    .where(eq(campaignKolMatchesTable.campaignId, campaignId))
    .orderBy(desc(campaignKolMatchesTable.matchScore));

  return NextResponse.json(rows);
}
