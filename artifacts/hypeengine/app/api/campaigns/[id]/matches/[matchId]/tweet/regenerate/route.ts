import { NextRequest, NextResponse } from "next/server";
import { db, campaignKolMatchesTable } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { generatePersonalizedTweet } from "@/lib/tracking/tweet-generator";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const { id: campaignId, matchId } = await params;

  const [match] = await db
    .select()
    .from(campaignKolMatchesTable)
    .where(
      and(
        eq(campaignKolMatchesTable.id, matchId),
        eq(campaignKolMatchesTable.campaignId, campaignId),
      ),
    );

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const tweet = await generatePersonalizedTweet(
    campaignId,
    match.kolProfileId,
    matchId,
    true, // variation = true
  );

  // Persist new generated tweet
  await db
    .update(campaignKolMatchesTable)
    .set({
      generatedTweetText: tweet.tweetText,
      customTweetText: null, // clear any saved custom text
    })
    .where(eq(campaignKolMatchesTable.id, matchId));

  return NextResponse.json(tweet);
}
