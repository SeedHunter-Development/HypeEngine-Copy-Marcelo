/**
 * Seed script — creates demo accounts with bcrypt-hashed passwords.
 * Safe to run multiple times (upsert on email).
 * Run: pnpm --filter @workspace/api-server run seed
 */
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import {
  usersTable,
  kolProfilesTable,
} from "@workspace/db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — run with the env var present");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const DEMO_PASSWORD = "demo123";

async function upsertUser(
  email: string,
  role: "client" | "kol" | "admin",
  name: string,
  credits: number,
  extras: Partial<typeof usersTable.$inferInsert> = {}
) {
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (existing) {
    const [u] = await db
      .update(usersTable)
      .set({ password: hashed, role, name, credits, ...extras, updatedAt: new Date() })
      .where(eq(usersTable.id, existing.id))
      .returning({ id: usersTable.id });
    console.log(`  ✓ Updated  ${email}  (${u.id})`);
    return existing.id;
  } else {
    const [u] = await db
      .insert(usersTable)
      .values({ email, password: hashed, role, name, credits, setupComplete: true, ...extras })
      .returning({ id: usersTable.id });
    console.log(`  ✓ Created  ${email}  (${u.id})`);
    return u.id;
  }
}

async function upsertKolProfile(
  userId: string,
  twitterHandle: string,
  extras: Partial<typeof kolProfilesTable.$inferInsert> = {}
) {
  const [existing] = await db
    .select({ id: kolProfilesTable.id })
    .from(kolProfilesTable)
    .where(eq(kolProfilesTable.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(kolProfilesTable)
      .set({ twitterHandle, ...extras, updatedAt: new Date() })
      .where(eq(kolProfilesTable.id, existing.id));
    console.log(`    ↳ kol_profile updated  @${twitterHandle}`);
  } else {
    await db
      .insert(kolProfilesTable)
      .values({ userId, twitterHandle, ...extras });
    console.log(`    ↳ kol_profile created  @${twitterHandle}`);
  }
}

async function main() {
  console.log("\n🌱  Seeding HypeEngine demo accounts...\n");

  // Admin
  await upsertUser("admin@demo.com", "admin", "Admin", 0, { setupComplete: true });

  // Client
  await upsertUser("client@demo.com", "client", "Demo Client", 1000, {
    companyName: "Demo Corp",
    setupComplete: true,
  });

  // KOL 1 — kol@demo.com (Dave · US · DeFi)
  const kol1Id = await upsertUser("kol@demo.com", "kol", "DeFi Dave", 2392, {
    country: "US",
    language: "English",
    setupComplete: true,
  });
  await upsertKolProfile(kol1Id, "DemoKOL", {
    twitterFollowers: 52000,
    niches: ["DeFi", "Crypto", "Web3"],
    primaryLanguage: "english",
    engagementRate: 4.2,
    authenticityScore: 82,
  });

  // KOL 2 — kol2@demo.com (Sarah · US · Web3)
  const kol2Id = await upsertUser("kol2@demo.com", "kol", "Sarah Web3", 1322, {
    country: "US",
    language: "English",
    setupComplete: true,
  });
  await upsertKolProfile(kol2Id, "DemoKOL_Sarah", {
    twitterFollowers: 128000,
    niches: ["NFT", "Web3", "Metaverse"],
    primaryLanguage: "english",
    engagementRate: 3.8,
    authenticityScore: 79,
  });

  // KOL 3 — kol3@demo.com (Marcus · PH · Gaming)
  const kol3Id = await upsertUser("kol3@demo.com", "kol", "GameFi Marcus", 1590, {
    country: "PH",
    language: "English",
    setupComplete: true,
  });
  await upsertKolProfile(kol3Id, "DemoKOL_Marcus", {
    twitterFollowers: 89000,
    niches: ["Gaming", "GameFi", "NFT"],
    primaryLanguage: "english",
    engagementRate: 5.1,
    authenticityScore: 88,
  });

  console.log("\n✅  Seeding complete. All accounts use password: demo123\n");
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
