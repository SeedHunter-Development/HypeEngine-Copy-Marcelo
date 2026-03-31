import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true, checked: 0, passed: 0, failed: 0, errors: 0, message: "Verification disabled — escrow system removed" });
}
