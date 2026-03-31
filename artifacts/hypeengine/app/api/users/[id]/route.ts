import { NextResponse } from "next/server";

// This file is dead code — all /api/* traffic is proxied to the Express API server.
// User reads and updates are handled by Express GET/PATCH /api/users/:id.

export async function GET() {
  return NextResponse.json(
    { error: "Use the Express API server for user operations" },
    { status: 501 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Use the Express API server for user operations" },
    { status: 501 }
  );
}
