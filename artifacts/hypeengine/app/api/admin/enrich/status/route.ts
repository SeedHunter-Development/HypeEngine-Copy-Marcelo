import { NextResponse } from "next/server";
import { db, kolProfilesTable } from "@/lib/db";

export async function GET() {
  try {
    const profiles = await db
      .select({
        id: kolProfilesTable.id,
        twitterHandle: kolProfilesTable.twitterHandle,
        lastDataRefresh: kolProfilesTable.lastDataRefresh,
        twitterFollowers: kolProfilesTable.twitterFollowers,
        engagementRate: kolProfilesTable.engagementRate,
        authenticityScore: kolProfilesTable.authenticityScore,
        twitterScoreValue: kolProfilesTable.twitterScoreValue,
      })
      .from(kolProfilesTable);

    return NextResponse.json(
      profiles.map((p) => ({
        kolProfileId: p.id,
        twitterHandle: p.twitterHandle,
        lastDataRefresh: p.lastDataRefresh,
        twitterFollowers: p.twitterFollowers,
        engagementRate: p.engagementRate,
        authenticityScore: p.authenticityScore,
        twitterScoreValue: p.twitterScoreValue,
        enriched: p.lastDataRefresh != null,
      })),
    );
  } catch (err) {
    console.error("[/api/admin/enrich/status] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
