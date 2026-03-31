import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../lib/db/src/schema/index.js";
import bcrypt from "bcryptjs";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function main() {
  console.log("Seeding database...");

  // ── Client user ────────────────────────────────────────────────────────────
  const clientPassword = await bcrypt.hash("demo123", 10);
  const [clientUser] = await db.insert(schema.usersTable).values({
    email: "client@demo.com",
    password: clientPassword,
    role: "client",
    name: "Alex Johnson",
    companyName: "CryptoVentures Inc.",
    jobTitle: "Marketing Lead",
    twitterAccount: "@cryptoventures",
    websiteUrl: "cryptoventures.io",
    credits: 5000,
    setupComplete: true,
    walletConnected: true,
  }).onConflictDoNothing().returning();

  const clientId = clientUser?.id;
  if (!clientId) {
    console.log("Client user already exists, skipping seed.");
    await pool.end();
    return;
  }
  console.log("Created client user:", clientId);

  // ── KOL users ──────────────────────────────────────────────────────────────
  const kolPassword = await bcrypt.hash("demo123", 10);

  const kolSeeds = [
    {
      email: "defi.dave@demo.com",
      name: "Dave Kim",
      twitterHandle: "DeFiDave",
      followers: 52000,
      following: 630,
      niches: ["DeFi", "Finance", "Crypto"],
      country: "United States",
      language: "English",
      bio: "DeFi researcher. Covering protocols, yields & on-chain data since 2019.",
      engagementRate: 4.8,
      authenticityScore: 91,
      contentVerticals: { DeFi: 0.6, Finance: 0.25, Crypto: 0.15 },
      followerSampleGeo: { US: 0.45, UK: 0.12, CA: 0.08 },
      followerCryptoPct: 0.82,
    },
    {
      email: "nft.whale@demo.com",
      name: "Sarah Chen",
      twitterHandle: "NFTWhale88",
      followers: 128000,
      following: 940,
      niches: ["NFT", "Web3", "Metaverse"],
      country: "Singapore",
      language: "English",
      bio: "NFT collector & metaverse explorer. Building the future one token at a time 🌐",
      engagementRate: 6.2,
      authenticityScore: 87,
      contentVerticals: { NFT: 0.55, Web3: 0.3, Metaverse: 0.15 },
      followerSampleGeo: { SG: 0.22, JP: 0.18, KR: 0.15, US: 0.2 },
      followerCryptoPct: 0.91,
    },
    {
      email: "gamefi.marcus@demo.com",
      name: "Marcus Tan",
      twitterHandle: "GameFiMarcus",
      followers: 89000,
      following: 1420,
      niches: ["Gaming", "GameFi", "Metaverse"],
      country: "Philippines",
      language: "English",
      bio: "Web3 gamer & GameFi enthusiast. Play-to-earn since 2021. 🇵🇭",
      engagementRate: 5.1,
      authenticityScore: 78,
      contentVerticals: { Gaming: 0.5, GameFi: 0.35, Metaverse: 0.15 },
      followerSampleGeo: { PH: 0.38, ID: 0.15, TH: 0.12, VN: 0.1 },
      followerCryptoPct: 0.76,
    },
    {
      email: "layer1.elena@demo.com",
      name: "Elena Müller",
      twitterHandle: "L1Elena",
      followers: 34000,
      following: 290,
      niches: ["DeFi", "AI / Tech", "Finance"],
      country: "Germany",
      language: "German",
      bio: "Quant finance meets blockchain. Covering L1s, bridges & MEV. 🇩🇪",
      engagementRate: 7.4,
      authenticityScore: 94,
      contentVerticals: { DeFi: 0.4, "AI / Tech": 0.35, Finance: 0.25 },
      followerSampleGeo: { DE: 0.35, AT: 0.12, CH: 0.08, US: 0.18 },
      followerCryptoPct: 0.88,
    },
    {
      email: "crypto.carlos@demo.com",
      name: "Carlos Rivera",
      twitterHandle: "CryptoCarlito",
      followers: 215000,
      following: 2100,
      niches: ["Crypto", "Trading", "Finance"],
      country: "Mexico",
      language: "Spanish",
      bio: "Crypto trader & educator. Llevando el crypto a Latinoamérica 🇲🇽🚀",
      engagementRate: 3.9,
      authenticityScore: 72,
      contentVerticals: { Crypto: 0.5, Trading: 0.35, Finance: 0.15 },
      followerSampleGeo: { MX: 0.28, AR: 0.16, CO: 0.12, ES: 0.1 },
      followerCryptoPct: 0.79,
    },
  ];

  const kolProfileIds: string[] = [];

  for (const kol of kolSeeds) {
    const [kolUser] = await db.insert(schema.usersTable).values({
      email: kol.email,
      password: kolPassword,
      role: "kol",
      name: kol.name,
      bio: kol.bio,
      country: kol.country,
      language: kol.language,
      twitterAccount: `@${kol.twitterHandle}`,
      credits: Math.floor(Math.random() * 2000) + 500,
      setupComplete: true,
      agreedToTerms: true,
    }).onConflictDoNothing().returning();

    if (!kolUser) continue;

    const [kp] = await db.insert(schema.kolProfilesTable).values({
      userId: kolUser.id,
      twitterHandle: kol.twitterHandle,
      twitterFollowers: kol.followers,
      twitterFollowing: kol.following,
      niches: kol.niches,
      primaryLanguage: kol.language,
      contentVerticals: kol.contentVerticals,
      verticalWeights: kol.contentVerticals,
      engagementRate: kol.engagementRate,
      authenticityScore: kol.authenticityScore,
      followerSampleGeo: kol.followerSampleGeo,
      followerCryptoPct: kol.followerCryptoPct,
      avgLikes: Math.round(kol.followers * kol.engagementRate * 0.008),
      avgRetweets: Math.round(kol.followers * kol.engagementRate * 0.003),
      avgReplies: Math.round(kol.followers * kol.engagementRate * 0.002),
      followerGrowthTrend: "steady",
      campaignsCompleted: Math.floor(Math.random() * 15),
      clientSatisfaction: 3.8 + Math.random() * 1.2,
      priceCompetitiveness: 0.6 + Math.random() * 0.4,
    }).onConflictDoNothing().returning();

    if (kp) {
      kolProfileIds.push(kp.id);
      console.log(`Created KOL: ${kol.name} (@${kol.twitterHandle})`);
    }
  }

  // ── Sample campaigns ───────────────────────────────────────────────────────
  const campaigns = [
    {
      clientId,
      title: "DeFi Protocol Launch — Earn & Save",
      description: "Drive signups for our new DeFi yield aggregator. Targeting DeFi and finance audiences in English-speaking markets.",
      hashtag: "#HE_EarnSave",
      postTemplates: [
        "💰 Just discovered @EarnSaveProtocol and this is EXACTLY what DeFi has been missing.\n\nUp to 18% APY, cross-chain, non-custodial. This is the real deal 🔥\n\nGet in early → {link}\n#HE_EarnSave #DeFi #Crypto",
        "The yield farming game just changed.\n\n@EarnSaveProtocol is aggregating the best DeFi rates automatically — no manual chasing.\n\nI switched my stables over. Check it out: {link}\n#HE_EarnSave #Web3 #DeFi",
      ],
      credits: 3000,
      maxPricePerPost: 80,
      maxPostsPerKolPerDay: 2,
      maxPostsPerKolTotal: 6,
      targetNiches: ["DeFi", "Finance", "Crypto"],
      targetCountry: "United States",
      targetLanguage: "English",
      campaignGoal: "conversion" as const,
      landingPageUrl: "https://earnsave.io/signup",
      ctaText: "Start earning now",
      ctaPlacement: "replace_in_template" as const,
      aiPersonalization: true,
      status: "active" as const,
    },
    {
      clientId,
      title: "NFT Marketplace Awareness Push",
      description: "Build brand awareness for our multi-chain NFT marketplace across Asian markets.",
      hashtag: "#HE_NFTHub",
      postTemplates: [
        "The NFT marketplace I've been waiting for is finally here 👀\n\n@NFTHubMarket — multi-chain, zero gas surprises, creator-first royalties.\n\nExplore now: {link}\n#HE_NFTHub #NFT #Web3",
      ],
      credits: 2000,
      maxPricePerPost: 60,
      maxPostsPerKolPerDay: 1,
      maxPostsPerKolTotal: 4,
      targetNiches: ["NFT", "Web3", "Metaverse"],
      targetCountry: "Singapore",
      targetLanguage: "English",
      campaignGoal: "awareness" as const,
      landingPageUrl: "https://nfthub.io",
      ctaText: "Explore the marketplace",
      ctaPlacement: "replace_in_template" as const,
      aiPersonalization: true,
      status: "active" as const,
    },
  ];

  for (const camp of campaigns) {
    const [c] = await db.insert(schema.campaignsTable).values(camp).returning();
    console.log(`Created campaign: ${c.title}`);
  }

  console.log("✅ Seed complete!");
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
