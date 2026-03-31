import { NextRequest, NextResponse } from "next/server";
import { db, trackingLinksTable, trackingClicksTable } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ refCode: string }> },
) {
  const { refCode } = await params;

  const [link] = await db
    .select()
    .from(trackingLinksTable)
    .where(eq(trackingLinksTable.refCode, refCode));

  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "";
  const ipHash = ip ? createHash("sha256").update(ip + process.env.IP_SALT ?? "hypeengine").digest("hex").slice(0, 16) : null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 512) ?? null;
  const referer = req.headers.get("referer")?.slice(0, 512) ?? null;

  db.insert(trackingClicksTable)
    .values({
      trackingLinkId: link.id,
      kolProfileId: link.kolProfileId,
      campaignId: link.campaignId,
      ipHash,
      userAgent,
      referer,
    })
    .execute()
    .catch(() => {});

  const dest = new URL(link.destinationUrl);
  dest.searchParams.set("he_ref", refCode);

  const response = NextResponse.redirect(dest.toString(), 302);
  response.cookies.set("he_ref", refCode, {
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "none",
    secure: true,
    path: "/",
    httpOnly: false,
  });

  return response;
}
