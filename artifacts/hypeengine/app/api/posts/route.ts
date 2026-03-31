import { NextRequest, NextResponse } from "next/server";
import { db, postsTable, kolProfilesTable, usersTable, campaignsTable } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import type { Post } from "@/lib/types";

async function dbPostToUi(p: typeof postsTable.$inferSelect): Promise<Post> {
  const [kp] = await db.select({ userId: kolProfilesTable.userId })
    .from(kolProfilesTable)
    .where(eq(kolProfilesTable.id, p.kolProfileId))
    .limit(1);

  let kolName = "Unknown KOL";
  let kolId = kp?.userId ?? p.kolProfileId;

  if (kp?.userId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, kp.userId)).limit(1);
    if (u?.name) kolName = u.name;
  }

  return {
    id: p.id,
    campaignId: p.campaignId,
    kolId,
    kolName,
    tweetUrl: p.tweetUrl ?? undefined,
    tweetText: p.tweetText ?? undefined,
    tweetCreatedAt: p.tweetCreatedAt?.toISOString() ?? undefined,
    apifyStatus: p.apifyStatus ?? undefined,
    status: (p.status ?? "pending") as Post["status"],
    createdAt: p.createdAt?.toISOString() ?? new Date().toISOString(),
    metrics: { views: 0, likes: 0, engagement: 0 },
    creditsEarned: p.creditsEarned ?? 0,
    postedDate: p.postedDate ?? undefined,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kolId = searchParams.get("kolId");
  const campaignId = searchParams.get("campaignId");

  let rows: typeof postsTable.$inferSelect[];

  if (kolId) {
    const [kp] = await db.select({ id: kolProfilesTable.id })
      .from(kolProfilesTable)
      .where(eq(kolProfilesTable.userId, kolId))
      .limit(1);

    if (!kp) {
      return NextResponse.json([]);
    }

    rows = campaignId
      ? await db.select().from(postsTable).where(and(eq(postsTable.kolProfileId, kp.id), eq(postsTable.campaignId, campaignId)))
      : await db.select().from(postsTable).where(eq(postsTable.kolProfileId, kp.id));
  } else if (campaignId) {
    rows = await db.select().from(postsTable).where(eq(postsTable.campaignId, campaignId));
  } else {
    rows = await db.select().from(postsTable);
  }

  const uiPosts = await Promise.all(rows.map(dbPostToUi));
  return NextResponse.json(uiPosts);
}

export async function POST(req: NextRequest) {
  const data = await req.json() as {
    campaignId: string;
    kolId: string;
    kolName?: string;
    tweetUrl?: string;
    status?: string;
    creditsEarned?: number;
    postedDate?: string;
    metrics?: object;
  };

  const [kp] = await db.select({ id: kolProfilesTable.id })
    .from(kolProfilesTable)
    .where(eq(kolProfilesTable.userId, data.kolId))
    .limit(1);

  if (!kp) {
    return NextResponse.json({ error: "KOL profile not found for this user" }, { status: 404 });
  }

  const [post] = await db.insert(postsTable).values({
    campaignId: data.campaignId,
    kolProfileId: kp.id,
    tweetUrl: data.tweetUrl,
    status: (data.status ?? "pending") as "pending" | "approved" | "rejected",
    creditsEarned: data.creditsEarned ?? 0,
    postedDate: data.postedDate,
  }).returning();

  const camp = await db.select({ usedCredits: campaignsTable.usedCredits, credits: campaignsTable.credits })
    .from(campaignsTable).where(eq(campaignsTable.id, data.campaignId)).limit(1);

  if (camp[0]) {
    const newUsed = Math.min(camp[0].credits, (camp[0].usedCredits ?? 0) + (data.creditsEarned ?? 0));
    await db.update(campaignsTable).set({ usedCredits: newUsed }).where(eq(campaignsTable.id, data.campaignId));
  }

  const uiPost: Post = {
    id: post.id,
    campaignId: post.campaignId,
    kolId: data.kolId,
    kolName: data.kolName ?? "Unknown KOL",
    tweetUrl: post.tweetUrl ?? undefined,
    status: (post.status ?? "pending") as Post["status"],
    createdAt: post.createdAt?.toISOString() ?? new Date().toISOString(),
    metrics: { views: 0, likes: 0, engagement: 0 },
    creditsEarned: post.creditsEarned ?? 0,
    postedDate: post.postedDate ?? undefined,
  };

  return NextResponse.json(uiPost, { status: 201 });
}
