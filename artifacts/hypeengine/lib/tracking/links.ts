import { db, trackingLinksTable } from "@/lib/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomCode(len = 8): string {
  let result = "he_";
  for (let i = 0; i < len - 3; i++) {
    result += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return result;
}

async function uniqueRefCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode(8);
    const [existing] = await db
      .select({ id: trackingLinksTable.id })
      .from(trackingLinksTable)
      .where(eq(trackingLinksTable.refCode, code));
    if (!existing) return code;
  }
  throw new Error("Could not generate unique ref code after 10 attempts");
}

export async function generateTrackingLink(
  campaignId: string,
  kolProfileId: string,
  matchId: string,
  destinationUrl: string,
): Promise<typeof trackingLinksTable.$inferSelect> {
  const refCode = await uniqueRefCode();

  const [link] = await db
    .insert(trackingLinksTable)
    .values({ campaignId, kolProfileId, matchId, refCode, destinationUrl })
    .onConflictDoNothing()
    .returning();

  if (!link) {
    const [existing] = await db
      .select()
      .from(trackingLinksTable)
      .where(eq(trackingLinksTable.matchId, matchId));
    if (existing) return existing;
    throw new Error("Failed to insert tracking link");
  }

  return link;
}

export function getTrackingDomain(): string {
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (process.env.NEXT_PUBLIC_DOMAIN) {
    return process.env.NEXT_PUBLIC_DOMAIN;
  }
  return "http://localhost:25387";
}

export function buildTrackingUrl(refCode: string): string {
  return `${getTrackingDomain()}/r/${refCode}`;
}
