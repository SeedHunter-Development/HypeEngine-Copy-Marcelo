import { NextRequest, NextResponse } from "next/server";
import { db, trackingLinksTable, trackingConversionsTable } from "@/lib/db";
import { eq } from "drizzle-orm";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      refCode?: string;
      eventType?: string;
      eventValue?: number | null;
      metadata?: Record<string, unknown>;
    };

    const { refCode, eventType = "custom", eventValue = null, metadata = {} } = body;

    if (!refCode) {
      return NextResponse.json({ error: "refCode required" }, { status: 400, headers: CORS_HEADERS });
    }

    const validEvents = ["signup", "deposit", "trade", "install", "custom", "pageview"];
    if (!validEvents.includes(eventType)) {
      return NextResponse.json({ error: "Invalid eventType" }, { status: 400, headers: CORS_HEADERS });
    }

    const [link] = await db
      .select()
      .from(trackingLinksTable)
      .where(eq(trackingLinksTable.refCode, refCode));

    if (!link) {
      return NextResponse.json({ error: "Unknown refCode" }, { status: 404, headers: CORS_HEADERS });
    }

    await db.insert(trackingConversionsTable).values({
      trackingLinkId: link.id,
      kolProfileId: link.kolProfileId,
      campaignId: link.campaignId,
      eventType: eventType as "signup" | "deposit" | "trade" | "install" | "custom",
      eventValue: eventValue ?? null,
      metadata,
      source: "pixel",
    });

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS_HEADERS });
  }
}
