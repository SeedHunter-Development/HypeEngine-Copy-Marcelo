import { NextRequest, NextResponse } from "next/server";

// This file is dead code — all /api/* traffic is proxied to the Express API server.
// Role lookups are handled by Express GET /api/auth/role.
// PATCH role changes are intentionally NOT exposed here (privilege-escalation risk).

export async function GET(_req: NextRequest) {
  return NextResponse.json(
    { error: "Use the Express API server for auth operations" },
    { status: 501 }
  );
}
