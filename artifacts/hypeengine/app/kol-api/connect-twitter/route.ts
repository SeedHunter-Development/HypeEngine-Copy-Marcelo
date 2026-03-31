// GET /kol-api/connect-twitter?action=start&handle=USERNAME  → { jobId }
// GET /kol-api/connect-twitter?jobId=XXX                    → job status
// GET /kol-api/connect-twitter?action=set-followers&jobId=XXX&followers=NNN → saves manual follower count
//
// This lives outside /api/* so Express doesn't intercept it.

import { NextRequest } from "next/server";
import { getServerSession } from "@/lib/session";
import { db, kolProfilesTable, usersTable } from "@/lib/db";
import { and, eq, ne } from "drizzle-orm";
import { enrichKolFromTwitterScore } from "@/lib/data-pipeline/twitterscore";
import { enrichKolFromApify } from "@/lib/data-pipeline/apify";

export const dynamic = "force-dynamic";

type StepStatus = "pending" | "ok" | "failed" | "skipped";

export interface ConnectJob {
  userId: string;
  handle: string;
  statusMessage: string;
  step: "twitterScore" | "apify" | "done";
  tsStep: StepStatus;
  apifyStep: StepStatus;
  // Data returned when done
  twitterFollowers: number;
  twitterScore: number;
  displayName: string;
  engagementRate: number;
  avgLikes: number;
  avgRetweets: number;
  avgReplies: number;
  avgPostsPerDay: number;
  done: boolean;
  needsManualFollowers?: boolean;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, ConnectJob>();

function makeId(): string {
  return Math.random().toString(36).slice(2, 12);
}

function gc() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}

function update(jobId: string, patch: Partial<ConnectJob>) {
  const j = jobs.get(jobId);
  if (j) jobs.set(jobId, { ...j, ...patch });
}

async function runPipeline(jobId: string, userId: string, handle: string) {
  // ── Step 1: TwitterScore ──────────────────────────────────────────────────
  update(jobId, { statusMessage: `Verifying @${handle} with TwitterScore…`, tsStep: "pending" });

  const tsData = await enrichKolFromTwitterScore(handle);

  // Look up KOL profile regardless of TS result
  const [kolProfile] = await db
    .select()
    .from(kolProfilesTable)
    .where(eq(kolProfilesTable.userId, userId));

  if (!kolProfile) {
    update(jobId, { done: true, error: "KOL profile not found in database", tsStep: "failed", apifyStep: "skipped", statusMessage: "Profile error" });
    return;
  }

  // Remove any orphan/stale row for this handle to avoid unique constraint
  await db
    .delete(kolProfilesTable)
    .where(and(eq(kolProfilesTable.twitterHandle, handle), ne(kolProfilesTable.id, kolProfile.id)));

  // Always write twitterAccount to usersTable (disconnect only clears usersTable, not kolProfilesTable)
  await db
    .update(usersTable)
    .set({ twitterAccount: `@${handle}`, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  if (!tsData || !tsData.twitterId) {
    // TwitterScore failed — save handle without follower data, continue to Apify
    update(jobId, {
      tsStep: "failed",
      step: "apify",
      statusMessage: `TwitterScore lookup failed for @${handle}. Fetching tweet data with Apify…`,
    });

    await db
      .update(kolProfilesTable)
      .set({ twitterHandle: handle, updatedAt: new Date() })
      .where(eq(kolProfilesTable.id, kolProfile.id));
  } else {
    // TwitterScore succeeded
    await db
      .update(kolProfilesTable)
      .set({
        twitterHandle: handle,
        twitterFollowers: tsData.twitterFollowers,
        twitterScoreValue: tsData.twitterScoreValue,
        updatedAt: new Date(),
      })
      .where(eq(kolProfilesTable.id, kolProfile.id));

    update(jobId, {
      tsStep: "ok",
      twitterFollowers: tsData.twitterFollowers,
      twitterScore: tsData.twitterScoreValue,
      displayName: tsData.displayName,
      step: "apify",
      statusMessage: `@${handle} verified (${tsData.twitterFollowers.toLocaleString()} followers). Now fetching engagement data…`,
    });
  }

  // ── Step 2: Apify ─────────────────────────────────────────────────────────
  update(jobId, { apifyStep: "pending", statusMessage: "Crawling recent tweets — this takes 1–3 minutes…" });

  const currentJob = jobs.get(jobId);
  const followerCountForApify = currentJob?.twitterFollowers ?? 0;

  const apifyData = await enrichKolFromApify(handle, followerCountForApify);

  if (apifyData) {
    await db
      .update(kolProfilesTable)
      .set({
        avgLikes: apifyData.avgLikes,
        avgRetweets: apifyData.avgRetweets,
        avgReplies: apifyData.avgReplies,
        avgPostsPerDay: apifyData.avgPostsPerDay,
        engagementRate: apifyData.engagementRate,
        originalVsRtRatio: apifyData.originalVsRtRatio,
        rtToLikeRatio: apifyData.rtToLikeRatio,
        quoteTweetRatio: apifyData.quoteTweetRatio,
        lastDataRefresh: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(kolProfilesTable.id, kolProfile.id));

    update(jobId, {
      apifyStep: "ok",
      engagementRate: apifyData.engagementRate,
      avgLikes: apifyData.avgLikes,
      avgRetweets: apifyData.avgRetweets,
      avgReplies: apifyData.avgReplies,
      avgPostsPerDay: apifyData.avgPostsPerDay,
    });
  } else {
    update(jobId, { apifyStep: "skipped" });
  }

  // If TwitterScore failed (no follower count), ask user to enter it manually
  const finalJob = jobs.get(jobId);
  if (!finalJob) return;

  if (finalJob.tsStep === "failed") {
    update(jobId, {
      done: true,
      step: "done",
      needsManualFollowers: true,
      statusMessage: "Almost done! We couldn't auto-detect your follower count — please enter it below.",
    });
  } else {
    update(jobId, { done: true, step: "done", statusMessage: "All done" });
  }
}

export async function GET(req: NextRequest) {
  gc();

  const session = await getServerSession();
  if (!session) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "kol") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const action = searchParams.get("action");
  const jobId  = searchParams.get("jobId") ?? "";
  const handle = (searchParams.get("handle") ?? "").replace(/^@/, "").trim();

  // ── Start ─────────────────────────────────────────────────────────────────
  if (action === "start") {
    if (!handle) return Response.json({ error: "handle is required" }, { status: 400 });

    const id = makeId();
    jobs.set(id, {
      userId: session.userId,
      handle,
      statusMessage: "Starting…",
      step: "twitterScore",
      tsStep: "pending",
      apifyStep: "skipped",
      twitterFollowers: 0,
      twitterScore: 0,
      displayName: handle,
      engagementRate: 0,
      avgLikes: 0,
      avgRetweets: 0,
      avgReplies: 0,
      avgPostsPerDay: 0,
      done: false,
      needsManualFollowers: false,
      createdAt: Date.now(),
    });

    void runPipeline(id, session.userId, handle).catch((err) => {
      console.error(`[connect-twitter] Pipeline error for @${handle}:`, err);
      update(id, { done: true, error: String(err), statusMessage: "Unexpected error" });
    });

    return Response.json({ jobId: id });
  }

  // ── Set manual followers ──────────────────────────────────────────────────
  if (action === "set-followers") {
    const followersRaw = searchParams.get("followers") ?? "";
    const followers = parseInt(followersRaw, 10);
    if (isNaN(followers) || followers < 0) return Response.json({ error: "Invalid follower count" }, { status: 400 });

    // Use the session directly — no jobId needed (in-memory job may have been GC'd)
    const [kolProfile] = await db
      .select()
      .from(kolProfilesTable)
      .where(eq(kolProfilesTable.userId, session.userId));

    if (!kolProfile) return Response.json({ error: "KOL profile not found" }, { status: 404 });

    await db
      .update(kolProfilesTable)
      .set({ twitterFollowers: followers, updatedAt: new Date() })
      .where(eq(kolProfilesTable.id, kolProfile.id));

    // Also patch the in-memory job if it's still around
    if (jobId) update(jobId, { twitterFollowers: followers, needsManualFollowers: false });

    return Response.json({ ok: true });
  }

  // ── Poll ─────────────────────────────────────────────────────────────────
  if (!jobId) return Response.json({ error: "Missing jobId or action" }, { status: 400 });
  const job = jobs.get(jobId);
  if (!job) return Response.json({ error: "Job not found or expired" }, { status: 404 });
  if (job.userId !== session.userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  return Response.json(job);
}
