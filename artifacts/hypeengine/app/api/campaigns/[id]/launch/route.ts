import { NextRequest, NextResponse } from "next/server";
import { db, campaignsTable } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { Campaign } from "@/lib/types";

const API_URL = `http://localhost:${process.env.API_PORT ?? "8080"}`;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [updated] = await db.update(campaignsTable)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(campaignsTable.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const uiCampaign: Campaign = {
    id: updated.id,
    clientId: updated.clientId,
    title: updated.title,
    description: updated.description ?? "",
    hashtag: updated.hashtag ?? "",
    postTemplate: updated.postTemplates?.[0] ?? "",
    postTemplates: updated.postTemplates ?? undefined,
    imageUrl: updated.imageUrl ?? undefined,
    totalCredits: updated.credits,
    usedCredits: updated.usedCredits ?? 0,
    status: "active",
    trending: false,
    createdAt: updated.createdAt?.toISOString() ?? new Date().toISOString(),
    metrics: { views: 0, likes: 0, replies: 0, reposts: 0 },
    maxPricePerPost: updated.maxPricePerPost ?? 50,
    maxPostsPerKolPerDay: updated.maxPostsPerKolPerDay ?? 1,
    maxPostsPerKolTotal: updated.maxPostsPerKolTotal ?? 5,
    targetNiches: updated.targetNiches ?? undefined,
    targetCountries: updated.targetCountry ? [updated.targetCountry] : undefined,
    targetLanguages: updated.targetLanguage ? [updated.targetLanguage] : undefined,
    campaignGoal: updated.campaignGoal ?? undefined,
    landingPageUrl: updated.landingPageUrl ?? undefined,
    ctaText: updated.ctaText ?? undefined,
    ctaPlacement: updated.ctaPlacement ?? undefined,
    aiPersonalization: updated.aiPersonalization ?? true,
  };

  fetch(`${API_URL}/api/admin/campaigns/${id}/score-kols`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).catch((err: unknown) => {
    console.error("[launch] Auto-scoring error:", err);
  });

  return NextResponse.json(uiCampaign);
}
