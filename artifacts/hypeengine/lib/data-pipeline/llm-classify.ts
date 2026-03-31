import OpenAI from "openai";

export interface LLMClassification {
  contentVerticals: Record<string, number> | null;
  primaryLanguage: string | null;
  secondaryLanguages: string[] | null;
  shillFrequency: number | null;
  projectMentions: string[] | null;
  replyQualityScore: number | null;
  replyQualityBreakdown: {
    substantive: number;
    generic: number;
    spam: number;
    bot: number;
  } | null;
  followerCryptoPct: number | null;
}

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "no-key",
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

async function callLLM(
  client: OpenAI,
  systemPrompt: string,
  userContent: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });
    const text = res.choices[0]?.message?.content ?? "";
    return JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    console.error("[LLM] Call failed:", err);
    return null;
  }
}

export async function classifyKolContent(
  tweets: string[],
  replies: string[],
  followerBios: string[],
): Promise<LLMClassification> {
  const client = getClient();

  const tweetSample = tweets.slice(0, 100).join("\n---\n");
  const replySample = replies.slice(0, 200).join("\n---\n");
  const bioSample = followerBios.slice(0, 300).join("\n---\n");

  const [contentResult, replyResult, followerResult] = await Promise.all([
    callLLM(
      client,
      `You are a crypto content analyst. Analyze the provided tweets and return a JSON object with these fields:
- contentVerticals: object where keys are content categories (e.g. "DeFi", "NFT", "Trading", "Layer1", "Gaming", "Memes", "Education", "News", "Shilling") and values are floats 0-1 summing to 1.0
- primaryLanguage: ISO 639-1 language code of main language used (e.g. "en", "zh", "es")
- secondaryLanguages: array of other ISO 639-1 language codes detected
- shillFrequency: float 0-1 representing how often tweets are promotional/shill content
- projectMentions: array of specific crypto project names mentioned (max 20)`,
      `Here are the tweets to classify:\n${tweetSample}`,
    ),
    callLLM(
      client,
      `You are a reply quality analyst. Analyze the provided Twitter replies and return a JSON object with these fields:
- replyQualityScore: integer 0-100 representing overall reply quality (100 = very substantive and valuable)
- breakdown: object with four keys (each a float 0-1 summing to 1.0): "substantive" (insightful, adds value), "generic" (simple agreement/emoji), "spam" (irrelevant/off-topic), "bot" (automated-looking)`,
      `Here are the replies to analyze:\n${replySample}`,
    ),
    callLLM(
      client,
      `You are a crypto audience analyst. Analyze the provided Twitter follower bios and return a JSON object with one field:
- followerCryptoPct: float 0-1 representing what percentage of followers appear to be in the crypto/web3 space`,
      `Here are the follower bios:\n${bioSample}`,
    ),
  ]);

  return {
    contentVerticals: (contentResult?.contentVerticals as Record<string, number> | null) ?? null,
    primaryLanguage: (contentResult?.primaryLanguage as string | null) ?? null,
    secondaryLanguages: (contentResult?.secondaryLanguages as string[] | null) ?? null,
    shillFrequency: (contentResult?.shillFrequency as number | null) ?? null,
    projectMentions: (contentResult?.projectMentions as string[] | null) ?? null,
    replyQualityScore: (replyResult?.replyQualityScore as number | null) ?? null,
    replyQualityBreakdown:
      replyResult?.breakdown != null
        ? (replyResult.breakdown as { substantive: number; generic: number; spam: number; bot: number })
        : null,
    followerCryptoPct: (followerResult?.followerCryptoPct as number | null) ?? null,
  };
}
