import { db, kolProfilesTable } from "@/lib/db";
import { eq } from "drizzle-orm";
import { enrichKolFromApify } from "./apify";
import { enrichKolFromTwitterScore } from "./twitterscore";
import { classifyKolContent } from "./llm-classify";
import { detectReplyLanguages } from "./language-detect";
import { computeAuthenticityScore } from "@/lib/matching/authenticity";

export interface EnrichResult {
  kolProfileId: string;
  handle: string;
  success: boolean;
  steps: {
    apify: "ok" | "skipped" | "failed";
    twitterscore: "ok" | "skipped" | "failed";
    llm: "ok" | "skipped" | "failed";
    langdetect: "ok" | "skipped" | "failed";
    authenticity: "ok" | "skipped" | "failed";
  };
  error?: string;
}

export async function enrichKolProfile(kolProfileId: string): Promise<EnrichResult> {
  const [profile] = await db
    .select()
    .from(kolProfilesTable)
    .where(eq(kolProfilesTable.id, kolProfileId));

  if (!profile) {
    return {
      kolProfileId,
      handle: "unknown",
      success: false,
      steps: { apify: "failed", twitterscore: "failed", llm: "failed", langdetect: "failed", authenticity: "failed" },
      error: "KOL profile not found",
    };
  }

  const handle = profile.twitterHandle;
  console.log(`[Enrich] Starting enrichment for @${handle} (${kolProfileId})`);

  const steps: EnrichResult["steps"] = {
    apify: "skipped",
    twitterscore: "skipped",
    llm: "skipped",
    langdetect: "skipped",
    authenticity: "skipped",
  };

  const updates: Partial<typeof kolProfilesTable.$inferInsert> = {};

  let tweets: string[] = [];
  let replies: string[] = [];
  let followerBios: string[] = [];

  const apifyData = await enrichKolFromApify(handle);
  if (apifyData === null) {
    steps.apify = process.env.APIFY_API_TOKEN ? "failed" : "skipped";
  } else {
    steps.apify = "ok";
    tweets = apifyData.tweets.filter((t) => !t.isRetweet).map((t) => t.text);
    replies = apifyData.replies;
    followerBios = apifyData.followers.map((f) => f.bio).filter(Boolean);

    updates.twitterFollowers = apifyData.twitterFollowers || profile.twitterFollowers;
    updates.twitterFollowing = apifyData.twitterFollowing || profile.twitterFollowing;
    updates.avgPostsPerDay = apifyData.avgPostsPerDay;
    updates.avgLikes = apifyData.avgLikes;
    updates.avgRetweets = apifyData.avgRetweets;
    updates.avgReplies = apifyData.avgReplies;
    updates.engagementRate = apifyData.engagementRate;
    updates.rtToLikeRatio = apifyData.rtToLikeRatio;
    updates.quoteTweetRatio = apifyData.quoteTweetRatio;
    updates.originalVsRtRatio = apifyData.originalVsRtRatio;
    updates.threadFrequency = apifyData.threadFrequency;
    updates.engagementConsistency = apifyData.engagementConsistency;
    updates.followerSampleGeo = apifyData.followerSampleGeo;
    updates.followerSampleFlag = apifyData.followerSampleFlag;
    console.log(`[Enrich] Apify done for @${handle}`);
  }

  const tsData = await enrichKolFromTwitterScore(handle);
  if (tsData === null) {
    steps.twitterscore = process.env.TWITTERSCORE_API_KEY ? "failed" : "skipped";
  } else {
    steps.twitterscore = "ok";
    updates.twitterScoreValue = tsData.twitterScoreValue;
    updates.notableFollowers = tsData.notableFollowers;
    updates.vcFollowerCount = tsData.vcFollowerCount;
    updates.exchangeFollowerCount = tsData.exchangeFollowerCount;
    updates.followerGrowthTrend = tsData.followerGrowthTrend;
    console.log(`[Enrich] TwitterScore done for @${handle}`);
  }

  if (tweets.length > 0 || replies.length > 0 || followerBios.length > 0) {
    try {
      const llmData = await classifyKolContent(tweets, replies, followerBios);
      steps.llm = "ok";
      if (llmData.contentVerticals) updates.contentVerticals = llmData.contentVerticals;
      if (llmData.primaryLanguage) updates.primaryLanguage = llmData.primaryLanguage;
      if (llmData.secondaryLanguages) updates.secondaryLanguages = llmData.secondaryLanguages;
      if (llmData.shillFrequency != null) updates.shillFrequency = llmData.shillFrequency;
      if (llmData.projectMentions) updates.projectMentions = llmData.projectMentions;
      if (llmData.replyQualityScore != null) updates.replyQualityScore = llmData.replyQualityScore;
      if (llmData.followerCryptoPct != null) updates.followerCryptoPct = llmData.followerCryptoPct;
      console.log(`[Enrich] LLM classification done for @${handle}`);
    } catch (err) {
      steps.llm = "failed";
      console.error(`[Enrich] LLM failed for @${handle}:`, err);
    }
  }

  if (replies.length > 0) {
    try {
      const langDist = await detectReplyLanguages(replies);
      if (Object.keys(langDist).length > 0) {
        updates.replyLangDist = langDist;
      }
      steps.langdetect = "ok";
      console.log(`[Enrich] Language detection done for @${handle}`);
    } catch (err) {
      steps.langdetect = "failed";
      console.error(`[Enrich] Language detection failed for @${handle}:`, err);
    }
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(kolProfilesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(kolProfilesTable.id, kolProfileId));
  }

  try {
    const authResult = await computeAuthenticityScore(kolProfileId);
    steps.authenticity = "ok";

    await db
      .update(kolProfilesTable)
      .set({
        authenticityScore: authResult.authenticityScore,
        engRateFlag: authResult.engRateFlag,
        consistencyFlag: authResult.consistencyFlag,
        replyQualityFlag: authResult.replyQualityFlag,
        followerSampleFlag: authResult.followerSampleFlag,
        lastDataRefresh: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(kolProfilesTable.id, kolProfileId));

    console.log(
      `[Enrich] Authenticity score for @${handle}: ${authResult.authenticityScore} — ${authResult.details}`,
    );
  } catch (err) {
    steps.authenticity = "failed";
    console.error(`[Enrich] Authenticity scoring failed for @${handle}:`, err);

    await db
      .update(kolProfilesTable)
      .set({ lastDataRefresh: new Date(), updatedAt: new Date() })
      .where(eq(kolProfilesTable.id, kolProfileId));
  }

  const allSkipped = Object.values(steps).every((s) => s === "skipped");
  const anyFailed = Object.values(steps).some((s) => s === "failed");

  console.log(`[Enrich] Done for @${handle}: ${JSON.stringify(steps)}`);

  return {
    kolProfileId,
    handle,
    success: !anyFailed || allSkipped,
    steps,
  };
}

export async function enrichAllKolProfiles(): Promise<EnrichResult[]> {
  const profiles = await db
    .select({ id: kolProfilesTable.id, handle: kolProfilesTable.twitterHandle })
    .from(kolProfilesTable);

  const results: EnrichResult[] = [];
  for (let i = 0; i < profiles.length; i++) {
    const { id, handle } = profiles[i];
    console.log(`[Enrich] Enriching KOL ${i + 1}/${profiles.length}: @${handle}...`);
    const result = await enrichKolProfile(id);
    results.push(result);
    if (i < profiles.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return results;
}
