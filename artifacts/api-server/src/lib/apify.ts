const ACTOR_ID = "61RPP7dywgiy0JPD0";
const APIFY_BASE = "https://api.apify.com/v2";

interface RawTweet {
  id?: unknown;
  url?: unknown;
  twitterUrl?: unknown;
  text?: unknown;
  createdAt?: unknown;
  isRetweet?: unknown;
}

interface TweetCandidate {
  id: string;
  url: string;
  text: string;
  createdAt: string;
  isRetweet: boolean;
}

async function runActor(input: Record<string, unknown>, token: string): Promise<RawTweet[]> {
  const runRes = await fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!runRes.ok) {
    const body = await runRes.text().catch(() => "");
    throw new Error(`Apify actor start failed (${runRes.status}): ${body.slice(0, 200)}`);
  }
  const runData = await runRes.json() as { data: { id: string; defaultDatasetId: string } };
  const runId = runData.data.id;

  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
    const statusData = await statusRes.json() as { data: { status: string; defaultDatasetId: string } };
    const { status, defaultDatasetId } = statusData.data;

    if (status === "SUCCEEDED") {
      const itemsRes = await fetch(
        `${APIFY_BASE}/datasets/${defaultDatasetId}/items?token=${token}&format=json`,
      );
      return await itemsRes.json() as RawTweet[];
    }
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ${status.toLowerCase()} (runId=${runId})`);
    }
  }
  throw new Error("Apify run timed out after 10 minutes");
}

function parseTweet(t: RawTweet): TweetCandidate {
  return {
    id: String(t.id ?? ""),
    url: String(t.url ?? t.twitterUrl ?? ""),
    text: String(t.text ?? ""),
    createdAt: String(t.createdAt ?? ""),
    isRetweet: Boolean(t.isRetweet ?? false),
  };
}

export interface DetectMatch {
  url: string;
  text: string;
  createdAt?: Date;
}

/**
 * Scan a KOL's recent tweets for one containing the campaign hashtag.
 * Returns the matched tweet data or null if not found / on error.
 */
export async function detectHashtagPost(
  twitterHandle: string,
  hashtag: string,
  maxItems = 10,
): Promise<DetectMatch | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.warn("[Apify] APIFY_API_TOKEN not set — detectHashtagPost skipped");
    return null;
  }

  const handle = twitterHandle.replace(/^@/, "").trim();
  const tag = hashtag.replace(/^#/, "").toLowerCase();

  try {
    console.log(`[Apify] detectHashtagPost: scanning @${handle} for #${tag} (maxItems=${maxItems})…`);
    const raw = await runActor(
      { twitterHandles: [handle], maxItems, sort: "Latest", tweetLanguage: "en" },
      token,
    );

    const tweets = raw.map(parseTweet).filter((t) => !t.isRetweet);
    const match = tweets.find(
      (t) => t.text.toLowerCase().includes(`#${tag}`),
    );

    if (!match) return null;

    const createdAt = match.createdAt ? new Date(match.createdAt) : null;
    return {
      url: match.url,
      text: match.text,
      createdAt: createdAt && !isNaN(createdAt.getTime()) ? createdAt : undefined,
    };
  } catch (err) {
    console.error(`[Apify] detectHashtagPost failed for @${handle}:`, err);
    return null;
  }
}

export class ApifyVerifyError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "MISSING_HASHTAG",
    message: string,
    public readonly hashtag?: string,
  ) {
    super(message);
    this.name = "ApifyVerifyError";
  }
}

export interface VerifyMatch {
  url: string;
  text: string;
  createdAt?: Date;
}

/**
 * Verify a specific tweet URL by fetching it directly via startUrls.
 * Optionally validates that the tweet contains the required campaign hashtag.
 *
 * Returns VerifyMatch on success.
 * Throws ApifyVerifyError with code NOT_FOUND if the tweet does not exist.
 * Throws ApifyVerifyError with code MISSING_HASHTAG if hashtag not found in tweet.
 * Throws generic Error on Apify API failure (caller should treat as service unavailable).
 */
export async function verifyPostUrl(tweetUrl: string, hashtag?: string): Promise<VerifyMatch> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN not configured — cannot verify tweet");
  }

  console.log(`[Apify] verifyPostUrl: fetching ${tweetUrl}…`);
  const raw = await runActor(
    { startUrls: [tweetUrl], maxItems: 1 },
    token,
  );

  if (!raw.length) {
    throw new ApifyVerifyError("NOT_FOUND", "Tweet not found — make sure the URL is correct and the tweet is public.");
  }

  const tweet = parseTweet(raw[0]);

  if (hashtag) {
    const tag = hashtag.replace(/^#/, "").toLowerCase();
    const textLower = tweet.text.toLowerCase();
    if (!textLower.includes(`#${tag}`)) {
      const displayHashtag = hashtag.startsWith("#") ? hashtag : `#${hashtag}`;
      throw new ApifyVerifyError(
        "MISSING_HASHTAG",
        `Tweet must include the campaign hashtag ${displayHashtag}.`,
        displayHashtag,
      );
    }
  }

  const createdAt = tweet.createdAt ? new Date(tweet.createdAt) : null;
  return {
    url: tweet.url || tweetUrl,
    text: tweet.text,
    createdAt: createdAt && !isNaN(createdAt.getTime()) ? createdAt : undefined,
  };
}
