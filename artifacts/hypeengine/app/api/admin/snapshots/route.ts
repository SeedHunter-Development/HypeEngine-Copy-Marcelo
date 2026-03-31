import { NextResponse } from "next/server";
import { takeFollowerSnapshots } from "@/lib/data-pipeline/snapshot";

export async function POST() {
  try {
    const result = await takeFollowerSnapshots();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[/api/admin/snapshots] Error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
