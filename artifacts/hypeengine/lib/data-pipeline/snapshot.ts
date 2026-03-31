import { db, kolProfilesTable, kolFollowerSnapshotsTable } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function takeFollowerSnapshots(): Promise<{
  total: number;
  inserted: number;
  skipped: number;
}> {
  const profiles = await db
    .select({
      id: kolProfilesTable.id,
      twitterHandle: kolProfilesTable.twitterHandle,
      twitterFollowers: kolProfilesTable.twitterFollowers,
    })
    .from(kolProfilesTable);

  const today = new Date().toISOString().slice(0, 10);
  let inserted = 0;
  let skipped = 0;

  for (const profile of profiles) {
    if (!profile.twitterFollowers) {
      skipped++;
      continue;
    }

    try {
      await db.execute(
        sql`INSERT INTO kol_follower_snapshots (kol_profile_id, follower_count, snapshot_date)
            VALUES (${profile.id}, ${profile.twitterFollowers}, ${today})
            ON CONFLICT (kol_profile_id, snapshot_date) DO NOTHING`,
      );
      inserted++;
      console.log(
        `[Snapshot] @${profile.twitterHandle}: ${profile.twitterFollowers} followers on ${today}`,
      );
    } catch (err) {
      console.error(
        `[Snapshot] Failed for @${profile.twitterHandle}:`,
        err,
      );
      skipped++;
    }
  }

  console.log(
    `[Snapshot] Done: ${inserted} inserted, ${skipped} skipped out of ${profiles.length} KOLs`,
  );
  return { total: profiles.length, inserted, skipped };
}
