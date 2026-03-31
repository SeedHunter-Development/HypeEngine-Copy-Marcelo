export async function detectReplyLanguages(
  replies: string[],
): Promise<Record<string, number>> {
  if (replies.length === 0) return {};

  let franc: (text: string, options?: { minLength?: number }) => string;
  try {
    const francModule = await import("franc");
    franc = francModule.franc;
  } catch (err) {
    console.warn("[LangDetect] Failed to import franc:", err);
    return {};
  }

  const counts: Record<string, number> = {};
  let detected = 0;

  for (const reply of replies) {
    if (!reply || reply.trim().length < 10) continue;
    try {
      const lang = franc(reply, { minLength: 10 });
      if (lang && lang !== "und") {
        counts[lang] = (counts[lang] ?? 0) + 1;
        detected++;
      }
    } catch {
    }
  }

  if (detected === 0) return {};

  const distribution: Record<string, number> = {};
  for (const [lang, count] of Object.entries(counts)) {
    distribution[lang] = Math.round((count / detected) * 100) / 100;
  }

  return distribution;
}
