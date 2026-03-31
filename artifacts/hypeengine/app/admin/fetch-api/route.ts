import { NextRequest } from "next/server";
import { enrichKolFromApify } from "@/lib/data-pipeline/apify";
import { enrichKolFromTwitterScore } from "@/lib/data-pipeline/twitterscore";
import { classifyKolContent } from "@/lib/data-pipeline/llm-classify";

export const dynamic = "force-dynamic";

type StepStatus = "pending" | "ok" | "failed" | "skipped";
type Source = "twitterScore" | "apify" | "llm";

export interface JobState {
  handle: string;
  source: Source;
  statusMessage: string;
  steps: { twitterScore: StepStatus; apify: StepStatus; llm: StepStatus };
  twitterScore: unknown | null;
  apify: unknown | null;
  llm: unknown | null;
  done: boolean;
  error?: string;
  createdAt: number;
}

// In-memory stores (garbage-collected after 30 min)
const jobs = new Map<string, JobState>();

// Follower counts from TwitterScore, keyed by lowercase handle
const tsFollowerCache = new Map<string, { followers: number; storedAt: number }>();

// Raw tweet texts for LLM button, keyed by lowercase handle
const rawApifyCache = new Map<string, { tweets: string[]; storedAt: number }>();

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function gc() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs)           if (job.createdAt < cutoff) jobs.delete(id);
  for (const [h, d] of tsFollowerCache)   if (d.storedAt   < cutoff) tsFollowerCache.delete(h);
  for (const [h, d] of rawApifyCache)     if (d.storedAt   < cutoff) rawApifyCache.delete(h);
}

// ── Runners ───────────────────────────────────────────────────────────────────

async function runTwitterScore(jobId: string, handle: string) {
  const update = (p: Partial<JobState>) => {
    const j = jobs.get(jobId);
    if (j) jobs.set(jobId, { ...j, ...p });
  };
  try {
    update({ statusMessage: "Querying TwitterScore API…" });
    const result = await enrichKolFromTwitterScore(handle);
    const status: StepStatus = result ? "ok" : (process.env.TWITTERSCORE_API_KEY ? "failed" : "skipped");

    // Cache follower count so Apify can use it for engagement rate
    if (result && typeof result === "object" && "twitterFollowers" in result) {
      tsFollowerCache.set(handle.toLowerCase(), {
        followers: (result as { twitterFollowers: number }).twitterFollowers,
        storedAt: Date.now(),
      });
    }

    update({
      twitterScore: result,
      steps: { twitterScore: status, apify: "skipped", llm: "skipped" },
      statusMessage: status === "ok" ? "Done" : "Failed",
      done: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    update({ done: true, error: msg, statusMessage: "Error: " + msg, steps: { twitterScore: "failed", apify: "skipped", llm: "skipped" } });
  }
}

async function runApify(jobId: string, handle: string) {
  const update = (p: Partial<JobState>) => {
    const j = jobs.get(jobId);
    if (j) jobs.set(jobId, { ...j, ...p });
  };
  try {
    update({ statusMessage: "Running Apify tweet scraper (this takes a few minutes)…" });

    // Use TwitterScore follower count if available, for accurate engagement rate
    const cached = tsFollowerCache.get(handle.toLowerCase());
    const followerCount = cached?.followers ?? 0;

    const raw = await enrichKolFromApify(handle, followerCount);
    const status: StepStatus = raw ? "ok" : (process.env.APIFY_API_TOKEN ? "failed" : "skipped");

    if (raw) {
      // Cache tweet texts for LLM button
      rawApifyCache.set(handle.toLowerCase(), {
        tweets: raw.tweets.filter((t) => !t.isRetweet).map((t) => t.text),
        storedAt: Date.now(),
      });

      const apifyResult = {
        tweetCount:          raw.tweetCount,
        originalCount:       raw.originalCount,
        avgLikes:            round(raw.avgLikes, 1),
        avgRetweets:         round(raw.avgRetweets, 1),
        avgReplies:          round(raw.avgReplies, 1),
        avgQuotes:           round(raw.avgQuotes, 1),
        avgPostsPerDay:      round(raw.avgPostsPerDay, 2),
        originalVsRtRatio:   round(raw.originalVsRtRatio, 3),
        rtToLikeRatio:       round(raw.rtToLikeRatio, 3),
        quoteTweetRatio:     round(raw.quoteTweetRatio, 3),
        engagementRate:      round(raw.engagementRate, 4),
        followersUsed:       followerCount,
      };

      update({
        apify: apifyResult,
        steps: { twitterScore: "skipped", apify: status, llm: "skipped" },
        statusMessage: "Done",
        done: true,
      });
    } else {
      update({
        apify: null,
        steps: { twitterScore: "skipped", apify: status, llm: "skipped" },
        statusMessage: status === "skipped" ? "APIFY_API_TOKEN not set" : "Apify returned no data",
        done: true,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    update({ done: true, error: msg, statusMessage: "Error: " + msg, steps: { twitterScore: "skipped", apify: "failed", llm: "skipped" } });
  }
}

async function runLlm(jobId: string, handle: string) {
  const update = (p: Partial<JobState>) => {
    const j = jobs.get(jobId);
    if (j) jobs.set(jobId, { ...j, ...p });
  };
  const cached = rawApifyCache.get(handle.toLowerCase());
  if (!cached) {
    update({
      done: true,
      error: "No Apify data for this handle — run Apify first",
      statusMessage: "No Apify data",
      steps: { twitterScore: "skipped", apify: "skipped", llm: "failed" },
    });
    return;
  }
  try {
    update({ statusMessage: "Running LLM content classification…" });
    const result = await classifyKolContent(cached.tweets, [], []);
    update({ llm: result, steps: { twitterScore: "skipped", apify: "skipped", llm: "ok" }, statusMessage: "Done", done: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    update({ done: true, error: msg, statusMessage: "Error: " + msg, steps: { twitterScore: "skipped", apify: "skipped", llm: "failed" } });
  }
}

// ── GET handler ───────────────────────────────────────────────────────────────
// Note: route is at /admin/fetch-api (NOT /api/*) because the api-server
// artifact intercepts all /api/* traffic at the proxy level.
//
//  Start:  GET ?action=start&handle=USERNAME&source=twitterScore|apify|llm
//  Poll:   GET ?jobId=XXXX
//  Check:  GET ?check=1&handle=USERNAME  (is Apify cache ready for LLM?)

export async function GET(req: NextRequest) {
  gc();
  const { searchParams } = req.nextUrl;
  const action = searchParams.get("action");
  const jobId  = searchParams.get("jobId") ?? "";
  const handle = (searchParams.get("handle") ?? "").replace(/^@/, "").trim();
  const source = (searchParams.get("source") ?? "twitterScore") as Source;

  // ── Start a new job ────────────────────────────────────────────────────────
  if (action === "start") {
    if (!handle) return Response.json({ error: "Missing handle" }, { status: 400 });
    if (!["twitterScore", "apify", "llm"].includes(source)) {
      return Response.json({ error: "Invalid source" }, { status: 400 });
    }

    const id = makeId();
    jobs.set(id, {
      handle, source,
      statusMessage: "Starting…",
      steps: { twitterScore: "pending", apify: "pending", llm: "pending" },
      twitterScore: null, apify: null, llm: null,
      done: false, createdAt: Date.now(),
    });

    if (source === "twitterScore") void runTwitterScore(id, handle);
    else if (source === "apify")   void runApify(id, handle);
    else                           void runLlm(id, handle);

    const llmReady = rawApifyCache.has(handle.toLowerCase());
    return Response.json({ jobId: id, llmReady });
  }

  // ── Check Apify cache readiness ────────────────────────────────────────────
  if (searchParams.get("check") === "1" && handle) {
    return Response.json({ llmReady: rawApifyCache.has(handle.toLowerCase()) });
  }

  // ── Poll an existing job ───────────────────────────────────────────────────
  if (!jobId) return Response.json({ error: "Missing jobId or action" }, { status: 400 });
  const job = jobs.get(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const llmReady = rawApifyCache.has(job.handle.toLowerCase());
  return Response.json({ ...job, llmReady });
}
