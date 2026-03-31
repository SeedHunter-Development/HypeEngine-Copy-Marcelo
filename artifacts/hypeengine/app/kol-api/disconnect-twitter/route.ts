// GET /kol-api/disconnect-twitter
// Clears the twitterAccount field for the authenticated KOL.
// Lives outside /api/* so it is not intercepted by the Express server.

import { getServerSession } from "@/lib/session";
import { db, usersTable, kolProfilesTable } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "kol") return Response.json({ error: "Forbidden" }, { status: 403 });

  await db
    .update(usersTable)
    .set({ twitterAccount: null, updatedAt: new Date() })
    .where(eq(usersTable.id, session.userId));

  await db
    .update(kolProfilesTable)
    .set({ twitterHandle: null, updatedAt: new Date() })
    .where(eq(kolProfilesTable.userId, session.userId));

  return Response.json({ ok: true });
}
