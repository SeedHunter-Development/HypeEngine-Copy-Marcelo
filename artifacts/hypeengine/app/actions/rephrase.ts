"use server";

export async function rephraseDescription(description: string): Promise<{ description?: string; error?: string }> {
  if (!description || description.trim().length < 3) {
    return { error: "Please enter a description first." };
  }

  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: "AI service not configured." };
  }

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
          {
            role: "system",
            content:
              "You are an editor helping a Web3 project write a campaign brief description. " +
              "Your job is to take the user's rough description and improve it — making it clearer, more professional, and more compelling — while keeping it as a plain prose description of the project. " +
              "IMPORTANT RULES:\n" +
              "- Output a plain paragraph or two of description text ONLY. No bullet points, no headings, no lists.\n" +
              "- Do NOT write tweets, social posts, or call-to-action copy.\n" +
              "- Do NOT add hashtags, emojis, or promotional slogans.\n" +
              "- Do NOT tell KOLs what to do or how to post - this is a project description, not post instructions.\n" +
              "- Do NOT use the em dash character (—) anywhere in the output.\n" +
              "- Do NOT use phrases like 'this campaign', 'this initiative', 'this project', or similar.\n" +
              "- Preserve all factual details and the original intent.\n" +
              "- Keep it under 200 words.\n" +
              "- Write as if describing the project to a potential influencer partner: who are they, what do they do.",
          },
          {
            role: "user",
            content: description.trim(),
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI rephrase error:", err);
      return { error: "AI generation failed. Please try again." };
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const improved = data.choices?.[0]?.message?.content?.trim();

    if (!improved) {
      return { error: "No response from AI. Please try again." };
    }

    return { description: improved };
  } catch (err) {
    console.error("Rephrase action error:", err);
    return { error: "AI generation failed. Please try again." };
  }
}
