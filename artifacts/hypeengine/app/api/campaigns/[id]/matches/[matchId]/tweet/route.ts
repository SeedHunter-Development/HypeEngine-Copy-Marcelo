import { NextRequest, NextResponse } from "next/server";
import { db, campaignKolMatchesTable } from "@/lib/db";
import { eq, and } from "drizzle-orm";

// PATCH — save custom tweet text
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const { id: campaignId, matchId } = await params;
  const body = await req.json() as { customTweetText?: string };

  const [match] = await db
    .select({ id: campaignKolMatchesTable.id })
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

  const [updated] = await db
    .update(campaignKolMatchesTable)
    .set({ customTweetText: body.customTweetText ?? null })
    .where(eq(campaignKolMatchesTable.id, matchId))
    .returning();

  return NextResponse.json(updated);
}
