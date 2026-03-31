import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { description } = await req.json();

  if (!description || typeof description !== "string" || description.trim().length < 3) {
    return NextResponse.json({ error: "Please enter a description first." }, { status: 400 });
  }

  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
  }

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
            "You are a marketing copywriter specialising in crypto and Web3 campaigns. " +
            "Rewrite the user's campaign description to be more detailed, clear, and engaging. " +
            "Preserve the original intent and facts. " +
            "Output ONLY the improved description — no headings, no labels, no extra commentary. " +
            "Keep it under 300 words and suitable for a KOL campaign brief.",
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
    return NextResponse.json({ error: "AI generation failed. Please try again." }, { status: 502 });
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const improved = data.choices?.[0]?.message?.content?.trim();

  if (!improved) {
    return NextResponse.json({ error: "No response from AI. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ description: improved });
}
