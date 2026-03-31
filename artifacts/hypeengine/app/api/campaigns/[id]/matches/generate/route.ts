import { NextRequest, NextResponse } from "next/server";

const API_URL = `http://localhost:${process.env.API_PORT ?? "8080"}`;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;
  try {
    const res = await fetch(
      `${API_URL}/api/admin/campaigns/${campaignId}/score-kols`,
      { method: "POST", headers: { "Content-Type": "application/json" } },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Scoring failed" }));
      return NextResponse.json(body, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[matches/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scoring failed" },
      { status: 500 },
    );
  }
}
