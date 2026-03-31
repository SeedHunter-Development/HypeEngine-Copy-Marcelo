import OpenAI from "openai";
import {
  db,
  campaignsTable,
  kolProfilesTable,
  campaignKolMatchesTable,
  trackingLinksTable,
  usersTable,
} from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { generateTrackingLink, buildTrackingUrl } from "./links";

export interface PersonalizedTweet {
  tweetText: string;
  trackingUrl: string;
  refCode: string;
  templateUsed: string;
  charCount: number;
}

function getOpenAI(): OpenAI {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "no-key",
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

function pickBestTemplate(
  templates: string[],
  verticals: Record<string, number> | null,
): string {
  if (!templates.length) return "";
  if (!verticals || !templates.length) return templates[0];
  let best = templates[0];
  let bestScore = -1;
  const verticalKeys = Object.keys(verticals).map((k) => k.toLowerCase());
  for (const t of templates) {
    const lower = t.toLowerCase();
    const score = verticalKeys.reduce((sum, v) => sum + (lower.includes(v) ? (verticals[v] ?? 0) : 0), 0);
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return best;
}

function embedLink(
  text: string,
  ctaText: string,
  ctaPlacement: "end_of_tweet" | "replace_in_template",
  trackingUrl: string,
): string {
  const cta = ctaText ? `${ctaText} ${trackingUrl}` : trackingUrl;
  if (ctaPlacement === "replace_in_template" && text.includes("{link}")) {
    return text.replace(/\{link\}/g, cta);
  }
  return `${text}\n\n${cta}`;
}

function ensureHashtag(text: string, hashtag: string | null): string {
  if (!hashtag) return text;
  const tag = hashtag.startsWith("#") ? hashtag : `#${hashtag}`;
  if (text.includes(tag)) return text;
  return `${text}\n${tag}`;
}

function fitUnder280(
  text: string,
  hashtag: string | null,
  trackingUrl: string,
  ctaText: string,
): string {
  if (text.length <= 280) return text;

  const tag = hashtag ? (hashtag.startsWith("#") ? hashtag : `#${hashtag}`) : null;

  // Step 1: remove hashtag
  if (tag && text.includes(tag)) {
    const without = text.replace(`\n${tag}`, "").replace(tag, "").trim();
    if (without.length <= 280) return without;
    text = without;
  }

  // Step 2: shorten CTA — replace "ctaText trackingUrl" with just URL
  const fullCta = `${ctaText} ${trackingUrl}`;
  if (text.includes(fullCta)) {
    const shortened = text.replace(fullCta, trackingUrl);
    if (shortened.length <= 280) return shortened;
    text = shortened;
  }

  // Step 3: hard truncate preserving trailing URL
  const urlIdx = text.lastIndexOf(trackingUrl);
  if (urlIdx > 0) {
    const suffix = text.slice(urlIdx);
    const maxPrefix = 280 - suffix.length - 4;
    return text.slice(0, maxPrefix) + "... " + suffix;
  }
  return text.slice(0, 277) + "...";
}

export async function generatePersonalizedTweet(
  campaignId: string,
  kolProfileId: string,
  matchId: string,
  variation = false,
): Promise<PersonalizedTweet> {
  // Load campaign
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId));
  if (!campaign) throw new Error("Campaign not found");

  // Load KOL profile + user bio
  const [kolProfile] = await db
    .select()
    .from(kolProfilesTable)
    .where(eq(kolProfilesTable.id, kolProfileId));
  if (!kolProfile) throw new Error("KOL profile not found");

  const [kolUser] = await db
    .select({ name: usersTable.name, bio: usersTable.bio })
    .from(usersTable)
    .where(eq(usersTable.id, kolProfile.userId));

  // Get or generate tracking link
  const [existingLink] = await db
    .select()
    .from(trackingLinksTable)
    .where(
      and(
        eq(trackingLinksTable.campaignId, campaignId),
        eq(trackingLinksTable.kolProfileId, kolProfileId),
      ),
    );

  let link = existingLink;
  if (!link) {
    const destination = campaign.landingPageUrl ?? "https://hypeengine.app";
    link = await generateTrackingLink(campaignId, kolProfileId, matchId, destination);
  }

  const trackingUrl = buildTrackingUrl(link.refCode);
  const templates = campaign.postTemplates?.length ? campaign.postTemplates : [];
  const ctaText = campaign.ctaText ?? "Learn more →";
  const ctaPlacement = campaign.ctaPlacement ?? "end_of_tweet";
  const hashtag = campaign.hashtag ?? "";

  const verticals =
    kolProfile.contentVerticals && typeof kolProfile.contentVerticals === "object"
      ? (kolProfile.contentVerticals as Record<string, number>)
      : null;

  let tweetBody: string;
  const bestTemplate = pickBestTemplate(templates, verticals);
  const templateUsed = bestTemplate || campaign.title;

  if (campaign.aiPersonalization && bestTemplate && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    const client = getOpenAI();
    const kolName = kolUser?.name ?? kolProfile.twitterHandle;
    const verticalsStr = verticals ? Object.entries(verticals).map(([k, v]) => `${k} (${Math.round(v * 100)}%)`).join(", ") : "crypto";
    const variationNote = variation ? " Write a DIFFERENT variation — do NOT reuse the same opening line or structure." : "";

    try {
      const res = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: variation ? 0.9 : 0.7,
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content:
              "You are a tweet ghostwriter for crypto influencers. Rewrite the template to sound natural in the KOL's voice while keeping the core message. Stay under 250 characters (link added separately). Do NOT include URLs. Output ONLY the tweet text, nothing else.",
          },
          {
            role: "user",
            content: `Template: ${bestTemplate}\n\nKOL name: ${kolName}\nHandle: @${kolProfile.twitterHandle}\nContent focus: ${verticalsStr}\nLanguage: ${kolProfile.primaryLanguage ?? "en"}\nBio: ${kolUser?.bio ?? "crypto influencer"}\nHashtag: ${hashtag}${variationNote}`,
          },
        ],
      });
      tweetBody = (res.choices[0]?.message?.content ?? bestTemplate).trim();
    } catch {
      tweetBody = bestTemplate;
    }
  } else {
    tweetBody = bestTemplate || campaign.title;
  }

  // Embed tracking link
  let finalTweet = embedLink(tweetBody, ctaText, ctaPlacement, trackingUrl);

  // Append hashtag
  finalTweet = ensureHashtag(finalTweet, hashtag);

  // Fit under 280
  finalTweet = fitUnder280(finalTweet, hashtag, trackingUrl, ctaText);

  return {
    tweetText: finalTweet,
    trackingUrl,
    refCode: link.refCode,
    templateUsed,
    charCount: finalTweet.length,
  };
}

export async function generateAllTweetsForCampaign(
  campaignId: string,
): Promise<(PersonalizedTweet & { kolProfileId: string; matchId: string })[]> {
  const matches = await db
    .select()
    .from(campaignKolMatchesTable)
    .where(
      and(
        eq(campaignKolMatchesTable.campaignId, campaignId),
        eq(campaignKolMatchesTable.status, "booked"),
      ),
    );

  const results: (PersonalizedTweet & { kolProfileId: string; matchId: string })[] = [];
  for (const match of matches) {
    try {
      const tweet = await generatePersonalizedTweet(campaignId, match.kolProfileId, match.id);
      results.push({ ...tweet, kolProfileId: match.kolProfileId, matchId: match.id });
    } catch (e) {
      console.error(`[TweetGen] Failed for match ${match.id}:`, e);
    }
  }
  return results;
}
