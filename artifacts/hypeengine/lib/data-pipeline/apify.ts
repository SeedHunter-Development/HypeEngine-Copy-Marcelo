export interface ApifyTweet {
  id: string;
  url: string;
  text: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  bookmarkCount: number;
  createdAt: string;
  isRetweet: boolean;
  isQuote: boolean;
}

export interface ApifyData {
  tweets: ApifyTweet[];
  twitterHandle: string;
  tweetCount: number;
  originalCount: number;
  avgLikes: number;
  avgRetweets: number;
  avgReplies: number;
  avgQuotes: number;
  avgPostsPerDay: number;
  originalVsRtRatio: number;
  rtToLikeRatio: number;    // avgRetweets / avgLikes — high = viral content
  quoteTweetRatio: number;  // quote tweets / total original posts — high = strong engagement
  engagementRate: number;   // (avgLikes+avgRetweets+avgReplies+avgQuotes) / followers × 100
}

const ACTOR_ID = "61RPP7dywgiy0JPD0";
const APIFY_BASE = "https://api.apify.com/v2";

async function runActor(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
): Promise<unknown[]> {
  // Start the actor run
  const runRes = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!runRes.ok) {
    const body = await runRes.text().catch(() => "");
    throw new Error(`Apify actor start failed (${runRes.status}): ${body.slice(0, 200)}`);
  }
  const runData = await runRes.json() as { data: { id: string; defaultDatasetId: string } };
  const runId = runData.data.id;

  // Poll until finished (up to ~10 min)
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
    const statusData = await statusRes.json() as { data: { status: string; defaultDatasetId: string } };
    const { status, defaultDatasetId } = statusData.data;

    if (status === "SUCCEEDED") {
      const itemsRes = await fetch(
        `${APIFY_BASE}/datasets/${defaultDatasetId}/items?token=${token}&format=json`,
      );
      return await itemsRes.json() as unknown[];
    }
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ${status.toLowerCase()} (runId=${runId})`);
    }
    // Still running — keep polling
  }
  throw new Error("Apify run timed out after 10 minutes");
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function computeMetrics(tweets: ApifyTweet[], followerCount = 0) {
  // Only count original posts — retweets are excluded
  const original = tweets.filter((t) => !t.isRetweet);
  const avgLikes      = avg(original.map((t) => t.likeCount));
  const avgRetweets   = avg(original.map((t) => t.retweetCount));
  const avgReplies    = avg(original.map((t) => t.replyCount));
  const avgQuotes     = avg(original.map((t) => t.quoteCount));

  const engagementRate =
    followerCount > 0
      ? ((avgLikes + avgRetweets + avgReplies + avgQuotes) / followerCount) * 100
      : 0;

  const originalVsRtRatio = tweets.length > 0 ? original.length / tweets.length : 1;
  const rtToLikeRatio    = avgLikes > 0 ? avgRetweets / avgLikes : 0;
  const quoteTweets      = original.filter((t) => t.isQuote).length;
  const quoteTweetRatio  = original.length > 0 ? quoteTweets / original.length : 0;

  const dates = tweets
    .filter((t) => t.createdAt)
    .map((t) => {
      // Handle "Wed Mar 18 14:43:33 +0000 2026" Twitter date format
      const d = new Date(t.createdAt);
      return isNaN(d.getTime()) ? null : d.getTime();
    })
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);

  let avgPostsPerDay = 0;
  if (dates.length >= 2) {
    const daySpan = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24);
    avgPostsPerDay = daySpan > 0 ? tweets.length / daySpan : tweets.length;
  }

  return { avgLikes, avgRetweets, avgReplies, avgQuotes, engagementRate, originalVsRtRatio, rtToLikeRatio, quoteTweetRatio, avgPostsPerDay };
}

export async function enrichKolFromApify(
  twitterHandle: string,
  followerCount = 0,
): Promise<ApifyData | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.warn("[Apify] APIFY_API_TOKEN not set — skipping");
    return null;
  }

  const handle = twitterHandle.replace(/^@/, "").trim();

  try {
    console.log(`[Apify] Starting actor ${ACTOR_ID} for @${handle} (maxItems=50)…`);
    const raw = await runActor(
      ACTOR_ID,
      {
        twitterHandles: [handle],
        maxItems: 50,
        sort: "Latest",
        tweetLanguage: "en",
      },
      token,
    ) as Array<Record<string, unknown>>;

    console.log(`[Apify] Got ${raw.length} items for @${handle}`);

    const tweets: ApifyTweet[] = raw.map((t) => ({
      id:            String(t.id ?? ""),
      url:           String(t.url ?? t.twitterUrl ?? ""),
      text:          String(t.text ?? ""),
      likeCount:     Number(t.likeCount    ?? 0),
      retweetCount:  Number(t.retweetCount ?? 0),
      replyCount:    Number(t.replyCount   ?? 0),
      quoteCount:    Number(t.quoteCount   ?? 0),
      bookmarkCount: Number(t.bookmarkCount ?? 0),
      createdAt:     String(t.createdAt    ?? ""),
      isRetweet:     Boolean(t.isRetweet   ?? false),
      isQuote:       Boolean(t.isQuote     ?? false),
    }));

    const metrics = computeMetrics(tweets, followerCount);

    const originalCount = tweets.filter((t) => !t.isRetweet).length;
    return {
      tweets,
      twitterHandle: handle,
      tweetCount: tweets.length,
      originalCount,
      ...metrics,
    };
  } catch (err) {
    console.error(`[Apify] Failed for @${handle}:`, err);
    return null;
  }
}
