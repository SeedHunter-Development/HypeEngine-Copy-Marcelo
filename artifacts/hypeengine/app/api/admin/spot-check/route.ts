import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true, sampled: 0, deletionsFound: 0, errors: 0, message: "Spot-check disabled — escrow system removed" });
}
