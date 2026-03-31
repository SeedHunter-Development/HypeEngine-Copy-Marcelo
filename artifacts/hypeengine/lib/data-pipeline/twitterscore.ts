// TwitterScore API — https://twitterscore.io
//
// Endpoint 1: get_twitter_score
//   GET https://twitterscore.io/api/v1/get_twitter_score?api_key=KEY&username=USERNAME
//   Returns: { Username, Twitter_id, "Twitter Score" }
//
// Endpoint 2: get_twitter_info
//   GET https://twitterscore.io/api/v1/get_twitter_info?api_key=KEY&twitter_id=TWITTER_ID
//   Returns: { Username, Name, Description, "Followers Count", "PFP Link" }

export interface NotableFollower {
  username: string;
  type: "VC" | "exchange" | "project" | "influencer" | "other";
  followersCount?: number;
}

export interface TwitterScoreData {
  twitterScoreValue: number;
  twitterFollowers: number;
  twitterId: string;
  displayName: string;
  description: string;
  // The fields below are not provided by the TwitterScore API but are kept
  // for compatibility with enrich.ts and the matching engine (defaulted to empty).
  notableFollowers: NotableFollower[];
  vcFollowerCount: number;
  exchangeFollowerCount: number;
  followerGrowthTrend: "steady" | "spiking" | "declining" | "new";
}

const BASE = "https://twitterscore.io/api/v1";

export async function enrichKolFromTwitterScore(
  twitterHandle: string,
): Promise<TwitterScoreData | null> {
  const apiKey = process.env.TWITTERSCORE_API_KEY;
  if (!apiKey) {
    console.warn("[TwitterScore] TWITTERSCORE_API_KEY not set — skipping");
    return null;
  }

  const username = twitterHandle.replace(/^@/, "").trim();

  try {
    // ── Step 1: get_twitter_score ───────────────────────────────────────────
    console.log(`[TwitterScore] Fetching score for @${username}…`);
    const scoreUrl = `${BASE}/get_twitter_score?api_key=${apiKey}&username=${encodeURIComponent(username)}`;
    const scoreRes = await fetch(scoreUrl);

    if (!scoreRes.ok) {
      const body = await scoreRes.text().catch(() => "");
      throw new Error(`get_twitter_score returned HTTP ${scoreRes.status}: ${body.slice(0, 200)}`);
    }

    const scoreJson = await scoreRes.json() as Record<string, unknown>;
    console.log("[TwitterScore] score response:", JSON.stringify(scoreJson));

    const twitterScoreValue = Number(
      scoreJson["Twitter Score"] ?? scoreJson["twitter_score"] ?? scoreJson["score"] ?? 0
    );
    const twitterId = String(
      scoreJson["Twitter_id"] ?? scoreJson["twitter_id"] ?? scoreJson["id"] ?? ""
    );

    // ── Step 2: get_twitter_info ────────────────────────────────────────────
    let twitterFollowers = 0;
    let displayName = username;
    let description = "";

    if (twitterId) {
      console.log(`[TwitterScore] Fetching account info for twitter_id=${twitterId}…`);
      const infoUrl = `${BASE}/get_twitter_info?api_key=${apiKey}&twitter_id=${encodeURIComponent(twitterId)}`;
      const infoRes = await fetch(infoUrl);

      if (infoRes.ok) {
        const infoJson = await infoRes.json() as Record<string, unknown>;
        console.log("[TwitterScore] info response:", JSON.stringify(infoJson));

        twitterFollowers = Number(
          infoJson["Followers Count"] ?? infoJson["followers_count"] ?? infoJson["followers"] ?? 0
        );
        displayName = String(infoJson["Name"] ?? infoJson["name"] ?? username);
        description = String(infoJson["Description"] ?? infoJson["description"] ?? "");
      } else {
        console.warn(`[TwitterScore] get_twitter_info returned HTTP ${infoRes.status} — skipping account info`);
      }
    }

    return {
      twitterScoreValue,
      twitterFollowers,
      twitterId,
      displayName,
      description,
      notableFollowers: [],
      vcFollowerCount: 0,
      exchangeFollowerCount: 0,
      followerGrowthTrend: "steady",
    };
  } catch (err) {
    console.error(`[TwitterScore] Failed for @${username}:`, err);
    return null;
  }
}
