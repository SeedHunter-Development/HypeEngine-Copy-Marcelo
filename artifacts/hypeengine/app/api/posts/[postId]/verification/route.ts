import { NextRequest, NextResponse } from "next/server";
import { db, postsTable } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;

  const [post] = await db
    .select({
      id: postsTable.id,
      status: postsTable.status,
      apifyStatus: postsTable.apifyStatus,
      tweetUrl: postsTable.tweetUrl,
      tweetCreatedAt: postsTable.tweetCreatedAt,
      creditsEarned: postsTable.creditsEarned,
    })
    .from(postsTable)
    .where(eq(postsTable.id, postId));

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({
    postId: post.id,
    status: post.status,
    apifyStatus: post.apifyStatus,
    tweetUrl: post.tweetUrl,
    tweetCreatedAt: post.tweetCreatedAt?.toISOString() ?? null,
    creditsEarned: post.creditsEarned,
  });
}
