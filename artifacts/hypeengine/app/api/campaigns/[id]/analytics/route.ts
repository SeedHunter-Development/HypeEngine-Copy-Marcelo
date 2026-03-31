import { NextRequest, NextResponse } from "next/server";
import { db, trackingLinksTable, trackingClicksTable, trackingConversionsTable, campaignKolMatchesTable, usersTable, kolProfilesTable } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;

  const links = await db
    .select()
    .from(trackingLinksTable)
    .where(eq(trackingLinksTable.campaignId, campaignId));

  const linkIds = links.map((l) => l.id);
  const kolProfileIds = [...new Set(links.map((l) => l.kolProfileId))];

  let totalClicks = 0;
  let uniqueClicks = 0;
  const clicksByLink: Record<string, { total: number; unique: number }> = {};

  for (const link of links) {
    const rows = await db
      .select({
        count: sql<number>`count(*)::int`,
        uniqueIps: sql<number>`count(distinct ip_hash)::int`,
      })
      .from(trackingClicksTable)
      .where(eq(trackingClicksTable.trackingLinkId, link.id));
    const c = rows[0]?.count ?? 0;
    const u = rows[0]?.uniqueIps ?? 0;
    clicksByLink[link.id] = { total: c, unique: u };
    totalClicks += c;
    uniqueClicks += u;
  }

  const conversionsByType: Record<string, { count: number; value: number }> = {};
  let totalConversions = 0;
  let totalConversionValue = 0;
  const conversionsByLink: Record<string, number> = {};

  for (const link of links) {
    const rows = await db
      .select({
        eventType: trackingConversionsTable.eventType,
        count: sql<number>`count(*)::int`,
        value: sql<number>`coalesce(sum(event_value), 0)::float`,
      })
      .from(trackingConversionsTable)
      .where(eq(trackingConversionsTable.trackingLinkId, link.id))
      .groupBy(trackingConversionsTable.eventType);

    let linkConversions = 0;
    for (const row of rows) {
      if (row.eventType !== "pageview" && row.eventType !== "custom") {
        if (!conversionsByType[row.eventType]) {
          conversionsByType[row.eventType] = { count: 0, value: 0 };
        }
        conversionsByType[row.eventType].count += row.count;
        conversionsByType[row.eventType].value += row.value;
        totalConversions += row.count;
        totalConversionValue += row.value;
        linkConversions += row.count;
      }
    }
    conversionsByLink[link.id] = linkConversions;
  }

  const recentEvents = await db
    .select({
      eventType: trackingConversionsTable.eventType,
      eventValue: trackingConversionsTable.eventValue,
      timestamp: trackingConversionsTable.timestamp,
      refCode: trackingLinksTable.refCode,
    })
    .from(trackingConversionsTable)
    .innerJoin(trackingLinksTable, eq(trackingConversionsTable.trackingLinkId, trackingLinksTable.id))
    .where(eq(trackingConversionsTable.campaignId, campaignId))
    .orderBy(sql`${trackingConversionsTable.timestamp} desc`)
    .limit(10);

  const kolData: Array<{
    kolProfileId: string;
    kolName: string;
    twitterHandle: string;
    matchId: string;
    refCode: string | null;
    trackingUrl: string | null;
    clicks: number;
    uniqueClicks: number;
    conversions: number;
    convRate: number | null;
    cpa: number | null;
    priceAgreed: number | null;
  }> = [];

  const matches = await db
    .select({
      id: campaignKolMatchesTable.id,
      kolProfileId: campaignKolMatchesTable.kolProfileId,
      priceAgreed: campaignKolMatchesTable.priceAgreed,
      status: campaignKolMatchesTable.status,
      userId: kolProfilesTable.userId,
      twitterHandle: kolProfilesTable.twitterHandle,
    })
    .from(campaignKolMatchesTable)
    .innerJoin(kolProfilesTable, eq(campaignKolMatchesTable.kolProfileId, kolProfilesTable.id))
    .where(
      and(
        eq(campaignKolMatchesTable.campaignId, campaignId),
        eq(campaignKolMatchesTable.status, "booked"),
      ),
    );

  for (const match of matches) {
    const user = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, match.userId))
      .then((rows) => rows[0] ?? null);

    const link = links.find((l) => l.matchId === match.id) ?? null;
    const domain = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.NEXT_PUBLIC_DOMAIN ?? "";

    const clicks = link ? (clicksByLink[link.id]?.total ?? 0) : 0;
    const unique = link ? (clicksByLink[link.id]?.unique ?? 0) : 0;
    const convs = link ? (conversionsByLink[link.id] ?? 0) : 0;

    kolData.push({
      kolProfileId: match.kolProfileId,
      kolName: user?.name ?? match.twitterHandle,
      twitterHandle: match.twitterHandle,
      matchId: match.id,
      refCode: link?.refCode ?? null,
      trackingUrl: link ? `${domain}/r/${link.refCode}` : null,
      clicks,
      uniqueClicks: unique,
      conversions: convs,
      convRate: unique > 0 ? convs / unique : null,
      cpa: convs > 0 && match.priceAgreed ? match.priceAgreed / convs : null,
      priceAgreed: match.priceAgreed,
    });
  }

  const ctr = uniqueClicks > 0 && totalConversions >= 0 ? totalConversions / uniqueClicks : null;
  const cpa = totalConversions > 0 ? totalConversionValue / totalConversions : null;
  const hasData = links.length > 0;

  return NextResponse.json({
    totalClicks,
    uniqueClicks,
    totalConversions,
    totalConversionValue,
    conversionsByType,
    ctr: totalClicks > 0 ? (totalConversions / totalClicks) : null,
    cpa,
    hasData,
    kolData,
    recentEvents,
    pixelStatus: hasData ? (totalClicks > 0 ? "active" : "pending") : "not_set",
  });
}
