"use server";

export interface GenerateTemplatesResult {
  templates?: string[];
  error?: string;
}

const GOAL_LABEL: Record<string, string> = {
  conversion: "User conversion",
  awareness: "Brand awareness",
  community: "Community growth",
};

function normalizeUrl(url?: string): string | undefined {
  if (!url || !url.trim()) return undefined;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function generatePostTemplates(
  description: string,
  goal: "conversion" | "awareness" | "community",
  landingPageUrl?: string,
  count = 4
): Promise<GenerateTemplatesResult> {
  if (!description || description.trim().length < 3) {
    return { error: "Please enter a campaign description first." };
  }

  const normalizedUrl = normalizeUrl(landingPageUrl);

  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: "AI service not configured." };
  }

  const prompt = `You are an expert social media strategist and crypto/Web3-native copywriter specializing in high-performing Twitter (X) content.

Your task is to generate engaging, high-converting tweets based on the project description and campaign goal.

INPUT:
- Project Description: ${description.trim()}
- Goal: ${GOAL_LABEL[goal] ?? goal}
- Landing Page URL (optional): ${normalizedUrl ?? "not provided"}

---

INSTRUCTIONS:

1. Write exactly ${count} tweet variation${count !== 1 ? "s" : ""}.
2. Each tweet must:
   - Be concise, engaging, and native to Twitter (X)
   - Use strong hooks in the first line
   - Avoid generic or robotic phrasing
   - Match the tone of Web3 / startup / tech Twitter
   - Include subtle persuasion techniques (FOMO, curiosity, social proof, urgency)

3. Tailor the tweets based on the GOAL:

→ If goal is User conversion:
   - Focus on benefits, outcomes, and clear value
   - Include a strong call-to-action (CTA)
   - Encourage sign-ups, deposits, or usage

→ If goal is Brand awareness:
   - Focus on storytelling, vision, or uniqueness
   - Optimize for shareability and memorability
   - Avoid overly aggressive CTAs

→ If goal is Community growth:
   - Encourage interaction (questions, opinions, replies)
   - Use conversational tone
   - Invite users to follow, join, or engage

4. If a Landing Page URL is provided:
   - Include it naturally at the end of the tweet
   - Do NOT overforce it

5. Use formatting when helpful:
   - Line breaks for readability
   - Occasional emojis (but not excessive)
   - Bullet-style flow if appropriate

6. Optionally include:
   - 1–2 relevant hashtags (max)
   - Avoid spammy hashtag stuffing

---

OUTPUT FORMAT — respond with ONLY the tweets, each separated by a line containing exactly "---". No numbering, no labels, no extra commentary. Example:

Tweet text here

---

Next tweet text here

---`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: "You are an expert Twitter (X) copywriter for crypto and Web3 projects. Respond only with the tweet variations as instructed, separated by lines of ---." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI generateTemplates error:", err);
      return { error: "AI generation failed. Please try again." };
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim();

    if (!raw) {
      return { error: "No response from AI. Please try again." };
    }

    const templates = raw
      .split(/^---$/m)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 500);

    if (templates.length === 0) {
      return { error: "AI returned an unexpected format. Please try again." };
    }

    return { templates };
  } catch (err) {
    console.error("generatePostTemplates error:", err);
    return { error: "AI generation failed. Please try again." };
  }
}
