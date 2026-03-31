import { NextRequest, NextResponse } from "next/server";
import { db, notificationsTable } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, userId));

  return NextResponse.json({ ok: true });
}
