import { NextRequest, NextResponse } from "next/server";
import { enrichKolProfile, enrichAllKolProfiles } from "@/lib/data-pipeline/enrich";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { kolProfileId?: string };

    if (body.kolProfileId) {
      const result = await enrichKolProfile(body.kolProfileId);
      return NextResponse.json({
        success: result.success,
        enriched: result.success ? 1 : 0,
        failed: result.success ? 0 : 1,
        errors: result.error ? [result.error] : [],
        results: [result],
      });
    }

    const results = await enrichAllKolProfiles();
    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    return NextResponse.json({
      success: failed.length === 0,
      enriched: succeeded.length,
      failed: failed.length,
      errors: failed.map((r) => `@${r.handle}: ${r.error ?? "unknown error"}`),
      results,
    });
  } catch (err) {
    console.error("[/api/admin/enrich] Error:", err);
    return NextResponse.json(
      { success: false, enriched: 0, failed: 1, errors: [String(err)] },
      { status: 500 },
    );
  }
}
