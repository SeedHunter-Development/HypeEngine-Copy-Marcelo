import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  kolProfilesTable,
  campaignsTable,
  campaignKolMatchesTable,
  transactionsTable,
  postsTable,
  notificationsTable,
} from "../lib/db";
import { buildScoringKol, scoreKol, type ScoringCampaign } from "../lib/scoring";
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
} from "../lib/session";
import { detectHashtagPost, verifyPostUrl, ApifyVerifyError } from "../lib/apify";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildUserResponse(
  user: typeof usersTable.$inferSelect,
  kp?: typeof kolProfilesTable.$inferSelect | null
) {
  const { password: _, ...safe } = user;
  return {
    ...safe,
    title: safe.jobTitle ?? undefined,
    website: safe.websiteUrl ?? undefined,
    companyName: safe.companyName ?? undefined,
    twitterAccount: safe.twitterAccount ?? undefined,
    bio: safe.bio ?? undefined,
    country: safe.country ?? undefined,
    language: safe.language ?? undefined,
    agreedToTerms: safe.agreedToTerms ?? false,
    walletConnected: safe.walletConnected ?? false,
    niches: kp?.niches ?? undefined,
    twitterFollowers: kp?.twitterFollowers ?? undefined,
    twitterFollowing: kp?.twitterFollowing ?? undefined,
    followers: kp?.twitterFollowers ?? undefined,
    kolValue: kp?.authenticityScore ?? undefined,
    twitterHandle: kp?.twitterHandle ?? undefined,
    twitterScoreValue: kp?.twitterScoreValue ?? undefined,
    engagementRate: kp?.engagementRate ?? undefined,
    avgLikes: kp?.avgLikes ?? undefined,
    avgPostsPerDay: kp?.avgPostsPerDay ?? undefined,
  };
}

function buildCampaignResponse(c: typeof campaignsTable.$inferSelect) {
  return {
    id: c.id,
    clientId: c.clientId,
    title: c.title,
    description: c.description ?? "",
    hashtag: c.hashtag ?? "",
    postTemplate: c.postTemplates?.[0] ?? "",
    postTemplates: c.postTemplates ?? [],
    imageUrl: c.imageUrl ?? undefined,
    totalCredits: c.credits,
    usedCredits: c.usedCredits ?? 0,
    status: c.status ?? "draft",
    trending: false,
    createdAt: c.createdAt?.toISOString() ?? new Date().toISOString(),
    metrics: { views: 0, likes: 0, replies: 0, reposts: 0 },
    maxPricePerPost: c.maxPricePerPost ?? 0,
    maxPostsPerKolPerDay: c.maxPostsPerKolPerDay ?? 1,
    maxPostsPerKolTotal: c.maxPostsPerKolTotal ?? 5,
    targetNiches: c.targetNiches ?? [],
    targetCountries: c.targetCountry ? [c.targetCountry] : [],
    targetLanguages: c.targetLanguage ? [c.targetLanguage] : [],
    landingPageUrl: c.landingPageUrl ?? undefined,
    ctaText: c.ctaText ?? undefined,
    campaignGoal: c.campaignGoal ?? undefined,
  };
}

async function getKolProfile(userId: string) {
  const [kp] = await db
    .select()
    .from(kolProfilesTable)
    .where(eq(kolProfilesTable.userId, userId))
    .limit(1);
  return kp ?? null;
}

/**
 * Given a kol_profile + user row and a campaign, compute the match score,
 * attach it to the campaign response object, and upsert to campaign_kol_matches.
 */
async function attachMatchScore(
  campaignRow: typeof campaignsTable.$inferSelect,
  kp: typeof kolProfilesTable.$inferSelect,
  user: typeof usersTable.$inferSelect,
): Promise<ReturnType<typeof buildCampaignResponse> & {
  matchScore: number;
  calculatedPrice: number;
  matchDimensions: Record<string, { score: number; weight: number; label: string }>;
  priceBreakdown: object;
}> {
  const scoringCampaign: ScoringCampaign = {
    maxPricePerPost: campaignRow.maxPricePerPost ?? 100,
    campaignGoal: (campaignRow.campaignGoal ?? "awareness") as ScoringCampaign["campaignGoal"],
    targetCountry: campaignRow.targetCountry ?? "",
    targetLanguage: campaignRow.targetLanguage ?? "",
    targetNiches: campaignRow.targetNiches ?? [],
  };

  const scoringKol = buildScoringKol(kp, user, scoringCampaign);
  const result = scoreKol(scoringCampaign, scoringKol);

  // Convert dimensions to flat Record<string, number> (0–100) for UI breakdown display
  const breakdownFlat: Record<string, number> = {};
  for (const [key, dim] of Object.entries(result.dimensions)) {
    breakdownFlat[key] = Math.round(dim.score * 100);
  }

  // Upsert match score into campaign_kol_matches (fire-and-forget, don't block response)
  db.insert(campaignKolMatchesTable)
    .values({
      campaignId: campaignRow.id,
      kolProfileId: kp.id,
      matchScore: result.matchScore,
      matchBreakdown: breakdownFlat,
      status: "recommended",
      priceAgreed: result.priceBreakdown.finalPrice,
    })
    .onConflictDoUpdate({
      target: [campaignKolMatchesTable.campaignId, campaignKolMatchesTable.kolProfileId],
      set: {
        matchScore: result.matchScore,
        matchBreakdown: breakdownFlat,
        priceAgreed: result.priceBreakdown.finalPrice,
      },
    })
    .catch((err: unknown) => console.error("[match upsert]", err));

  return {
    ...buildCampaignResponse(campaignRow),
    matchScore: result.matchScore,
    calculatedPrice: result.priceBreakdown.finalPrice,
    matchDimensions: result.dimensions,
    priceBreakdown: result.priceBreakdown,
  };
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

/**
 * Reads and verifies the session cookie from the request.
 * Returns the session payload if valid, or sends a 401 response and returns null.
 */
async function requireAuth(req: Request, res: Response) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return session;
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const kp = user.role === "kol" ? await getKolProfile(user.id) : null;

    const token = await createSessionToken({ userId: user.id, role: user.role });
    setSessionCookie(res, token);

    return res.json(buildUserResponse(user, kp));
  } catch (err) {
    console.error("[auth/login]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/signup", async (req, res) => {
  try {
    const { email, password, role, twitterHandle, name } = req.body as {
      email: string;
      password: string;
      role: "client" | "kol" | "admin";
      twitterHandle?: string;
      name?: string;
    };

    if (!email || !password || !role) {
      return res.status(400).json({ error: "email, password, and role are required" });
    }
    if ((role as string) === "admin") {
      return res.status(400).json({ error: "Admin accounts cannot be created via signup" });
    }
    if (role === "kol" && !twitterHandle?.trim()) {
      return res.status(400).json({ error: "twitterHandle is required for KOL accounts" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { user, kp } = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(usersTable)
        .values({
          email: normalizedEmail,
          password: hashedPassword,
          role,
          name: name?.trim() || normalizedEmail.split("@")[0],
          credits: role === "client" ? 1000 : 0,
          setupComplete: false,
        })
        .returning();

      let newKp: typeof kolProfilesTable.$inferSelect | null = null;
      if (role === "kol") {
        const handle = twitterHandle!.replace(/^@/, "").trim();
        [newKp] = await tx
          .insert(kolProfilesTable)
          .values({ userId: newUser.id, twitterHandle: handle })
          .onConflictDoUpdate({
            target: kolProfilesTable.twitterHandle,
            set: { userId: newUser.id, updatedAt: new Date() },
          })
          .returning();
      }

      return { user: newUser, kp: newKp };
    });

    const token = await createSessionToken({ userId: user.id, role: user.role });
    setSessionCookie(res, token);

    return res.status(201).json(buildUserResponse(user, kp));
  } catch (err) {
    console.error("[auth/signup]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Not authenticated" });

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, session.userId))
      .limit(1);
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "User not found" });
    }

    const kp = user.role === "kol" ? await getKolProfile(user.id) : null;
    return res.json(buildUserResponse(user, kp));
  } catch (err) {
    console.error("[auth/me]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

router.get("/auth/role", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const { userId } = req.query as { userId?: string };
    if (!userId) return res.status(400).json({ error: "userId required" });

    if (session.userId !== userId && session.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: cannot access another user's role" });
    }

    const [user] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ role: user.role });
  } catch (err) {
    console.error("[auth/role]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── User Routes ──────────────────────────────────────────────────────────────

router.get("/users/:id", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    if (session.userId !== req.params.id && session.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: cannot access another user's profile" });
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.params.id))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Not found" });

    const kp = user.role === "kol" ? await getKolProfile(user.id) : null;
    return res.json(buildUserResponse(user, kp));
  } catch (err) {
    console.error("[users/:id GET]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    if (session.userId !== req.params.id && session.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: cannot modify another user's profile" });
    }

    const updates = req.body as Record<string, unknown>;
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.params.id))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Not found" });

    const userUpdates: Partial<typeof usersTable.$inferInsert> = {};
    if (updates.name !== undefined) userUpdates.name = updates.name as string;
    if (updates.bio !== undefined) userUpdates.bio = updates.bio as string;
    if (updates.country !== undefined) userUpdates.country = updates.country as string;
    if (updates.language !== undefined) userUpdates.language = updates.language as string;
    if (updates.companyName !== undefined) userUpdates.companyName = updates.companyName as string;
    if (updates.title !== undefined) userUpdates.jobTitle = updates.title as string;
    if (updates.website !== undefined) userUpdates.websiteUrl = updates.website as string;
    if (updates.twitterAccount !== undefined) userUpdates.twitterAccount = updates.twitterAccount as string;
    if (updates.setupComplete !== undefined) userUpdates.setupComplete = updates.setupComplete as boolean;
    if (updates.agreedToTerms !== undefined) userUpdates.agreedToTerms = updates.agreedToTerms as boolean;
    if (updates.walletConnected !== undefined) userUpdates.walletConnected = updates.walletConnected as boolean;

    let updatedUser = user;
    if (Object.keys(userUpdates).length > 0) {
      const [u] = await db
        .update(usersTable)
        .set({ ...userUpdates, updatedAt: new Date() })
        .where(eq(usersTable.id, req.params.id))
        .returning();
      updatedUser = u;
    }

    const kp = updatedUser.role === "kol" ? await getKolProfile(updatedUser.id) : null;
    return res.json(buildUserResponse(updatedUser, kp));
  } catch (err) {
    console.error("[users/:id PATCH]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Campaign Routes ──────────────────────────────────────────────────────────

router.get("/campaigns", async (req, res) => {
  try {
    const { clientId } = req.query as { clientId?: string };
    let rows = await db
      .select()
      .from(campaignsTable)
      .orderBy(desc(campaignsTable.createdAt));
    if (clientId) rows = rows.filter((c) => c.clientId === clientId);

    // If the caller is a KOL, enrich each active campaign with match scores
    const session = await getSessionFromRequest(req);
    if (session?.role === "kol") {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, session.userId))
        .limit(1);
      const kp = user ? await getKolProfile(user.id) : null;
      if (kp && user) {
        const enriched = await Promise.all(
          rows.map((c) => attachMatchScore(c, kp, user))
        );
        return res.json(enriched);
      }
    }

    return res.json(rows.map(buildCampaignResponse));
  } catch (err) {
    console.error("[campaigns GET]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/campaigns", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const data = req.body as Record<string, unknown>;
    const [campaign] = await db
      .insert(campaignsTable)
      .values({
        clientId: data.clientId as string,
        title: data.title as string,
        description: data.description as string | undefined,
        imageUrl: data.imageUrl as string | undefined,
        hashtag: data.hashtag as string | undefined,
        postTemplates:
          (data.postTemplates as string[] | undefined) ??
          (data.postTemplate ? [data.postTemplate as string] : []),
        credits:
          (data.totalCredits as number | undefined) ??
          (data.credits as number) ??
          0,
        maxPricePerPost: data.maxPricePerPost as number | undefined,
        maxPostsPerKolPerDay: data.maxPostsPerKolPerDay as number | undefined,
        maxPostsPerKolTotal: data.maxPostsPerKolTotal as number | undefined,
        targetNiches: data.targetNiches as string[] | undefined,
        targetCountry:
          (data.targetCountries as string[] | undefined)?.[0] ??
          (data.targetCountry as string | undefined),
        targetLanguage:
          (data.targetLanguages as string[] | undefined)?.[0] ??
          (data.targetLanguage as string | undefined),
        campaignGoal: data.campaignGoal as
          | "conversion"
          | "awareness"
          | "community"
          | undefined,
        landingPageUrl: data.landingPageUrl as string | undefined,
        ctaText: data.ctaText as string | undefined,
        ctaPlacement: (data.ctaPlacement as "end_of_tweet" | "replace_in_template" | undefined) ?? "end_of_tweet",
        aiPersonalization: (data.aiPersonalization as boolean | undefined) ?? true,
        status:
          (data.status as
            | "draft"
            | "active"
            | "paused"
            | "completed"
            | undefined) ?? "draft",
      })
      .returning();
    return res.status(201).json(buildCampaignResponse(campaign));
  } catch (err) {
    console.error("[campaigns POST]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/campaigns/:id", async (req, res) => {
  try {
    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, req.params.id))
      .limit(1);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const session = await getSessionFromRequest(req);
    if (session?.role === "kol") {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, session.userId))
        .limit(1);
      const kp = user ? await getKolProfile(user.id) : null;
      if (kp && user) {
        return res.json(await attachMatchScore(campaign, kp, user));
      }
    }

    return res.json(buildCampaignResponse(campaign));
  } catch (err) {
    console.error("[campaigns/:id GET]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/campaigns/:id", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const data = req.body as Record<string, unknown>;
    const updates: Partial<typeof campaignsTable.$inferInsert> = {};
    if (data.title !== undefined) updates.title = data.title as string;
    if (data.description !== undefined) updates.description = data.description as string;
    if (data.status !== undefined) updates.status = data.status as typeof updates.status;
    if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl as string;
    if (data.usedCredits !== undefined) updates.usedCredits = data.usedCredits as number;
    if (data.totalCredits !== undefined) updates.credits = data.totalCredits as number;
    if (data.credits !== undefined) updates.credits = data.credits as number;
    if (data.hashtag !== undefined) updates.hashtag = data.hashtag as string;
    if (data.postTemplates !== undefined) updates.postTemplates = data.postTemplates as string[];
    if (data.targetNiches !== undefined) updates.targetNiches = data.targetNiches as string[];
    if (data.campaignGoal !== undefined) updates.campaignGoal = data.campaignGoal as typeof updates.campaignGoal;
    if (data.landingPageUrl !== undefined) updates.landingPageUrl = data.landingPageUrl as string;
    if (data.ctaText !== undefined) updates.ctaText = data.ctaText as string;
    if (data.ctaPlacement !== undefined) updates.ctaPlacement = data.ctaPlacement as typeof updates.ctaPlacement;
    if (data.aiPersonalization !== undefined) updates.aiPersonalization = data.aiPersonalization as boolean;
    if (data.maxPricePerPost !== undefined) updates.maxPricePerPost = data.maxPricePerPost as number;
    if (data.maxPostsPerKolPerDay !== undefined) updates.maxPostsPerKolPerDay = data.maxPostsPerKolPerDay as number;
    if (data.maxPostsPerKolTotal !== undefined) updates.maxPostsPerKolTotal = data.maxPostsPerKolTotal as number;

    const [campaign] = await db
      .update(campaignsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(campaignsTable.id, req.params.id))
      .returning();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    return res.json(buildCampaignResponse(campaign));
  } catch (err) {
    console.error("[campaigns/:id PATCH]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/campaigns/:id/launch", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const [campaign] = await db
      .update(campaignsTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(campaignsTable.id, req.params.id))
      .returning();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    return res.json(buildCampaignResponse(campaign));
  } catch (err) {
    console.error("[campaigns/:id/launch]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Credits Routes ───────────────────────────────────────────────────────────

router.get("/credits", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const { userId } = req.query as { userId?: string };
    if (!userId) return res.status(400).json({ error: "userId required" });

    if (session.userId !== userId && session.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: cannot access another user's credits" });
    }
    const [user] = await db
      .select({ credits: usersTable.credits })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ credits: user.credits ?? 0 });
  } catch (err) {
    console.error("[credits GET]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/credits", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const { userId, amount, type, description } = req.body as {
      userId: string;
      amount: number;
      type: "add" | "withdraw" | "spend" | "earn";
      description?: string;
    };

    if (session.userId !== userId && session.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: cannot modify another user's credits" });
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });

    const current = user.credits ?? 0;
    if (
      (type === "withdraw" || type === "spend") &&
      current < Math.abs(amount)
    ) {
      return res.status(400).json({ error: "Insufficient credits" });
    }

    const delta =
      type === "add" || type === "earn"
        ? Math.abs(amount)
        : -Math.abs(amount);
    const [updatedUser] = await db
      .update(usersTable)
      .set({ credits: current + delta, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();

    const dbType = type === "add" ? "deposit" : type;
    const [tx] = await db
      .insert(transactionsTable)
      .values({
        userId,
        type: dbType as "deposit" | "spend" | "earn" | "withdraw",
        amount: Math.abs(amount),
        description:
          description ?? (type === "add" ? "Credits purchased" : "Credits used"),
      })
      .returning();

    return res.json({
      credits: updatedUser.credits,
      transaction: { ...tx, createdAt: tx.createdAt?.toISOString() },
    });
  } catch (err) {
    console.error("[credits POST]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Transaction Routes ───────────────────────────────────────────────────────

router.get("/transactions", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const { userId } = req.query as { userId?: string };
    if (!userId) return res.status(400).json({ error: "userId required" });

    if (session.userId !== userId && session.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: cannot access another user's transactions" });
    }
    const txs = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, userId))
      .orderBy(desc(transactionsTable.createdAt));
    return res.json(
      txs.map((t) => ({ ...t, createdAt: t.createdAt?.toISOString() }))
    );
  } catch (err) {
    console.error("[transactions GET]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/transactions", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const { userId, type, amount, description } = req.body as {
      userId: string;
      type: "deposit" | "spend" | "earn" | "withdraw";
      amount: number;
      description: string;
    };

    if (session.userId !== userId && session.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: cannot create transactions for another user" });
    }

    const [tx] = await db
      .insert(transactionsTable)
      .values({ userId, type, amount: Math.round(amount), description })
      .returning();
    return res
      .status(201)
      .json({ ...tx, createdAt: tx.createdAt?.toISOString() });
  } catch (err) {
    console.error("[transactions POST]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Posts Routes ─────────────────────────────────────────────────────────────

router.get("/posts", async (req, res) => {
  try {
    const { kolId, campaignId } = req.query as {
      kolId?: string;
      campaignId?: string;
    };
    let posts = await db
      .select()
      .from(postsTable)
      .orderBy(desc(postsTable.createdAt));

    if (kolId) {
      const kpRows = await db
        .select({ id: kolProfilesTable.id })
        .from(kolProfilesTable)
        .where(eq(kolProfilesTable.userId, kolId))
        .limit(1);
      const kpId = kpRows[0]?.id;
      posts = kpId ? posts.filter((p) => p.kolProfileId === kpId) : [];
    }
    if (campaignId) {
      posts = posts.filter((p) => p.campaignId === campaignId);
    }

    return res.json(
      posts.map((p) => ({
        id: p.id,
        campaignId: p.campaignId,
        kolId: p.kolProfileId,
        tweetUrl: p.tweetUrl ?? undefined,
        tweetText: p.tweetText ?? undefined,
        tweetCreatedAt: p.tweetCreatedAt?.toISOString() ?? undefined,
        apifyStatus: p.apifyStatus ?? undefined,
        status: p.status ?? "pending",
        createdAt: p.createdAt?.toISOString() ?? new Date().toISOString(),
        metrics: { views: 0, likes: 0, engagement: 0 },
        creditsEarned: p.creditsEarned ?? 0,
        postedDate: p.postedDate ?? undefined,
      }))
    );
  } catch (err) {
    console.error("[posts GET]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/posts", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const data = req.body as Record<string, unknown>;
    const [post] = await db
      .insert(postsTable)
      .values({
        campaignId: data.campaignId as string,
        kolProfileId: data.kolId as string,
        tweetUrl: data.tweetUrl as string | undefined,
        tweetText: data.tweetText as string | undefined,
        status:
          (data.status as typeof postsTable.$inferInsert["status"]) ??
          "pending",
        creditsEarned: (data.creditsEarned as number | undefined) ?? 0,
        postedDate: data.postedDate as string | undefined,
      })
      .returning();
    return res.status(201).json({
      id: post.id,
      campaignId: post.campaignId,
      kolId: post.kolProfileId,
      status: post.status,
      creditsEarned: post.creditsEarned,
      createdAt: post.createdAt?.toISOString() ?? new Date().toISOString(),
      metrics: { views: 0, likes: 0, engagement: 0 },
    });
  } catch (err) {
    console.error("[posts POST]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admin: List all KOLs with profile data ──────────────────────────────────

router.get("/admin/kols", async (req, res) => {
  try {
    const rows = await db
      .select({
        userId:          usersTable.id,
        name:            usersTable.name,
        email:           usersTable.email,
        country:         usersTable.country,
        language:        usersTable.language,
        kolProfileId:    kolProfilesTable.id,
        twitterHandle:   kolProfilesTable.twitterHandle,
        twitterFollowers: kolProfilesTable.twitterFollowers,
        twitterScoreValue: kolProfilesTable.twitterScoreValue,
        engagementRate:  kolProfilesTable.engagementRate,
        authenticityScore: kolProfilesTable.authenticityScore,
        niches:          kolProfilesTable.niches,
        primaryLanguage: kolProfilesTable.primaryLanguage,
        campaignsCompleted: kolProfilesTable.campaignsCompleted,
        clientSatisfaction: kolProfilesTable.clientSatisfaction,
        postReliabilityRate: kolProfilesTable.postReliabilityRate,
        lastDataRefresh: kolProfilesTable.lastDataRefresh,
      })
      .from(usersTable)
      .innerJoin(kolProfilesTable, eq(kolProfilesTable.userId, usersTable.id))
      .where(eq(usersTable.role, "kol"))
      .orderBy(desc(kolProfilesTable.twitterFollowers));
    return res.json(rows);
  } catch (err) {
    console.error("[admin/kols GET]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admin: Full match-test for a campaign + KOL pair ─────────────────────────

router.get("/admin/match-test", async (req, res) => {
  try {
    const { campaignId, kolProfileId } = req.query as {
      campaignId?: string;
      kolProfileId?: string;
    };
    if (!campaignId || !kolProfileId) {
      return res.status(400).json({ error: "campaignId and kolProfileId are required" });
    }

    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, campaignId))
      .limit(1);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const [kp] = await db
      .select()
      .from(kolProfilesTable)
      .where(eq(kolProfilesTable.id, kolProfileId))
      .limit(1);
    if (!kp) return res.status(404).json({ error: "KOL profile not found" });

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, kp.userId))
      .limit(1);

    const scoringCampaign: ScoringCampaign = {
      maxPricePerPost: campaign.maxPricePerPost ?? 100,
      campaignGoal: (campaign.campaignGoal ?? "awareness") as ScoringCampaign["campaignGoal"],
      targetCountry: campaign.targetCountry ?? "",
      targetLanguage: campaign.targetLanguage ?? "",
      targetNiches: campaign.targetNiches ?? [],
    };

    const scoringKol = buildScoringKol(kp, user ?? {}, scoringCampaign);
    const result = scoreKol(scoringCampaign, scoringKol);

    return res.json({
      campaign: buildCampaignResponse(campaign),
      kol: {
        kolProfileId: kp.id,
        userId: kp.userId,
        twitterHandle: kp.twitterHandle,
        twitterFollowers: kp.twitterFollowers,
        primaryLanguage: kp.primaryLanguage,
        secondaryLanguages: kp.secondaryLanguages,
        niches: kp.niches,
        followerSampleGeo: kp.followerSampleGeo,
        twitterScoreValue: kp.twitterScoreValue,
        engagementRate: kp.engagementRate,
        authenticityScore: kp.authenticityScore,
        campaignsCompleted: kp.campaignsCompleted,
        clientSatisfaction: kp.clientSatisfaction,
        postReliabilityRate: kp.postReliabilityRate,
        shillFrequency: kp.shillFrequency,
        avgRetweets: kp.avgRetweets,
        rtToLikeRatio: kp.rtToLikeRatio,
        quoteTweetRatio: kp.quoteTweetRatio,
        avgPostsPerDay: kp.avgPostsPerDay,
        replyQualityScore: kp.replyQualityScore,
        followerCryptoPct: kp.followerCryptoPct,
        vcFollowerCount: kp.vcFollowerCount,
        originalVsRtRatio: kp.originalVsRtRatio,
        threadFrequency: kp.threadFrequency,
        engagementConsistency: kp.engagementConsistency,
        avgCpaByGoal: kp.avgCpaByGoal,
        lastDataRefresh: kp.lastDataRefresh,
        country: user?.country,
        language: user?.language,
        name: user?.name,
      },
      scoringInputs: scoringKol,
      result,
    });
  } catch (err) {
    console.error("[admin/match-test GET]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admin: Score all KOLs for a campaign and persist results ─────────────────
//
// Called by the Next.js matches/generate route to refresh match scores using
// the authoritative scoring engine (scoring.ts). Upserts matchScore,
// matchBreakdown, and priceAgreed for every KOL in the database.

router.post("/admin/campaigns/:id/score-kols", async (req, res) => {
  try {
    const { id: campaignId } = req.params;

    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, campaignId))
      .limit(1);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const scoringCampaign: ScoringCampaign = {
      maxPricePerPost: campaign.maxPricePerPost ?? 100,
      campaignGoal: (campaign.campaignGoal ?? "awareness") as ScoringCampaign["campaignGoal"],
      targetCountry: campaign.targetCountry ?? "",
      targetLanguage: campaign.targetLanguage ?? "",
      targetNiches: campaign.targetNiches ?? [],
    };

    const kols = await db
      .select({
        kp: kolProfilesTable,
        user: {
          id: usersTable.id,
          name: usersTable.name,
          country: usersTable.country,
          language: usersTable.language,
        },
      })
      .from(kolProfilesTable)
      .innerJoin(usersTable, eq(kolProfilesTable.userId, usersTable.id))
      .where(eq(usersTable.role, "kol"));

    const results = [];

    for (const { kp, user } of kols) {
      const scoringKol = buildScoringKol(kp, user, scoringCampaign);
      const scoreResult = scoreKol(scoringCampaign, scoringKol);

      // Convert dimensions to flat Record<string, number> (0–100) for UI breakdown display
      const breakdownFlat: Record<string, number> = {};
      for (const [key, dim] of Object.entries(scoreResult.dimensions)) {
        breakdownFlat[key] = Math.round(dim.score * 100);
      }

      const [upserted] = await db
        .insert(campaignKolMatchesTable)
        .values({
          campaignId,
          kolProfileId: kp.id,
          matchScore: scoreResult.matchScore,
          matchBreakdown: breakdownFlat,
          status: "recommended",
          priceAgreed: scoreResult.priceBreakdown.finalPrice,
        })
        .onConflictDoUpdate({
          target: [campaignKolMatchesTable.campaignId, campaignKolMatchesTable.kolProfileId],
          set: {
            matchScore: scoreResult.matchScore,
            matchBreakdown: breakdownFlat,
            priceAgreed: scoreResult.priceBreakdown.finalPrice,
          },
        })
        .returning();

      results.push({
        matchId: upserted.id,
        kolProfileId: kp.id,
        kolName: user.name ?? kp.twitterHandle,
        twitterHandle: kp.twitterHandle,
        twitterFollowers: kp.twitterFollowers,
        matchScore: scoreResult.matchScore,
        calculatedPrice: scoreResult.priceBreakdown.finalPrice,
        priceBreakdown: scoreResult.priceBreakdown,
      });
    }

    results.sort((a, b) => b.matchScore - a.matchScore);
    return res.json({ count: results.length, matches: results });
  } catch (err) {
    console.error("[admin/campaigns/:id/score-kols POST]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Post Tracking ────────────────────────────────────────────────────────────

/**
 * Approve a post and credit the KOL. Idempotent — safe to call multiple times.
 */
async function approvePostAndPay(
  postId: string,
  tweetUrl: string,
  tweetText: string | null,
  tweetCreatedAt: Date | null,
): Promise<void> {
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post || post.status === "approved") return;

  let creditsEarned = post.creditsEarned ?? 0;
  if (post.matchId) {
    const [match] = await db
      .select({ priceAgreed: campaignKolMatchesTable.priceAgreed })
      .from(campaignKolMatchesTable)
      .where(eq(campaignKolMatchesTable.id, post.matchId));
    if (match?.priceAgreed) creditsEarned = match.priceAgreed;
  } else {
    // Post was created before a match existed — look up by campaign+kol to get the real priceAgreed
    const [match] = await db
      .select({ id: campaignKolMatchesTable.id, priceAgreed: campaignKolMatchesTable.priceAgreed })
      .from(campaignKolMatchesTable)
      .where(
        and(
          eq(campaignKolMatchesTable.campaignId, post.campaignId),
          eq(campaignKolMatchesTable.kolProfileId, post.kolProfileId),
        )
      )
      .limit(1);
    if (match?.priceAgreed) {
      creditsEarned = match.priceAgreed;
    }
  }

  await db.update(postsTable).set({
    status: "approved",
    tweetUrl,
    tweetText: tweetText ?? post.tweetText ?? null,
    apifyStatus: "found",
    tweetCreatedAt: tweetCreatedAt ?? null,
    creditsEarned,
  }).where(eq(postsTable.id, postId));

  const [kol] = await db
    .select({ userId: kolProfilesTable.userId })
    .from(kolProfilesTable)
    .where(eq(kolProfilesTable.id, post.kolProfileId));
  if (!kol) return;

  await db
    .update(usersTable)
    .set({ credits: sql`${usersTable.credits} + ${creditsEarned}` })
    .where(eq(usersTable.id, kol.userId));

  await db
    .update(campaignsTable)
    .set({ usedCredits: sql`${campaignsTable.usedCredits} + ${creditsEarned}` })
    .where(eq(campaignsTable.id, post.campaignId));

  const [campaign] = await db
    .select({ title: campaignsTable.title })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, post.campaignId));

  await db.insert(transactionsTable).values({
    userId: kol.userId,
    type: "earn",
    amount: creditsEarned,
    description: `Post approved on "${campaign?.title ?? "campaign"}"`,
    campaignId: post.campaignId,
  });

  await db.insert(notificationsTable).values({
    userId: kol.userId,
    type: "post_approved",
    title: "Post Approved — Credits Added!",
    message: `Your post on "${campaign?.title ?? "campaign"}" was detected and approved. ${creditsEarned} credits added to your balance.`,
    metadata: { postId, campaignId: post.campaignId, creditsEarned },
  });
}

// POST /campaigns/:id/post-intent — record intent to post; kick off background Apify scan
router.post("/campaigns/:id/post-intent", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const campaignId = req.params.id;

    const [kol] = await db
      .select()
      .from(kolProfilesTable)
      .where(eq(kolProfilesTable.userId, session.userId))
      .limit(1);
    if (!kol) return res.status(400).json({ error: "KOL profile not found" });

    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, campaignId))
      .limit(1);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const today = new Date().toISOString().split("T")[0];

    // Dedup — return existing pending post for today
    const existing = await db
      .select()
      .from(postsTable)
      .where(and(eq(postsTable.campaignId, campaignId), eq(postsTable.kolProfileId, kol.id)));
    const todayPending = existing.filter(
      (p) => p.status === "pending" && p.postedDate === today && p.apifyStatus === "scanning",
    );

    if (todayPending.length > 0) {
      return res.json({ postId: todayPending[0].id, message: "Scan already in progress." });
    }

    // Get match for creditsEarned
    const [match] = await db
      .select({ id: campaignKolMatchesTable.id, priceAgreed: campaignKolMatchesTable.priceAgreed })
      .from(campaignKolMatchesTable)
      .where(
        and(
          eq(campaignKolMatchesTable.campaignId, campaignId),
          eq(campaignKolMatchesTable.kolProfileId, kol.id),
        ),
      )
      .limit(1);

    const creditsEarned = match?.priceAgreed ?? campaign.maxPricePerPost ?? 100;

    const [post] = await db
      .insert(postsTable)
      .values({
        campaignId,
        kolProfileId: kol.id,
        matchId: match?.id ?? null,
        status: "pending",
        intentAt: new Date(),
        apifyStatus: "scanning",
        creditsEarned,
        postedDate: today,
      })
      .returning();

    // Background scan: quick check at 5s, then at 5 min, retry at 10 min if still not found
    if (kol.twitterHandle && campaign.hashtag) {
      const handle = kol.twitterHandle;
      const hashtag = campaign.hashtag;
      const postId = post.id;

      const runScan = async (attempt: number) => {
        try {
          const [current] = await db
            .select({ apifyStatus: postsTable.apifyStatus, status: postsTable.status })
            .from(postsTable)
            .where(eq(postsTable.id, postId));

          if (current?.status === "approved" || current?.apifyStatus === "found") return;

          console.log(`[post-intent] Background scan attempt ${attempt} for @${handle} #${hashtag}`);
          const match = await detectHashtagPost(handle, hashtag, 10);

          if (match) {
            // Dedup: ensure this tweetUrl isn't already tracked for this campaign+KOL
            const existing = await db
              .select({ id: postsTable.id })
              .from(postsTable)
              .where(
                and(
                  eq(postsTable.campaignId, campaignId),
                  eq(postsTable.kolProfileId, kol.id),
                  eq(postsTable.tweetUrl, match.url),
                ),
              )
              .limit(1);

            if (!existing.length) {
              await approvePostAndPay(postId, match.url, match.text, match.createdAt ?? null);
              console.log(`[post-intent] Tweet detected on attempt ${attempt} for post ${postId}`);
            } else {
              console.log(`[post-intent] Tweet URL already tracked — skipping duplicate for post ${postId}`);
              await db.update(postsTable).set({ apifyStatus: "found" }).where(eq(postsTable.id, postId));
            }
          } else if (attempt === 0) {
            // Quick 5s check missed — schedule the full 5-minute scan
            console.log(`[post-intent] Quick scan missed — scheduling 5-min scan for post ${postId}`);
            setTimeout(() => { void runScan(1); }, 5 * 60 * 1000);
          } else if (attempt === 1) {
            console.log(`[post-intent] Attempt 1 not found — scheduling retry in 5 min for post ${postId}`);
            setTimeout(() => { void runScan(2); }, 5 * 60 * 1000);
          } else {
            await db.update(postsTable).set({ apifyStatus: "not_found" }).where(eq(postsTable.id, postId));
            console.log(`[post-intent] No tweet detected after all attempts for post ${postId}`);
          }
        } catch (err) {
          console.error(`[post-intent] Scan attempt ${attempt} error:`, err);
          if (attempt < 2) {
            setTimeout(() => { void runScan(attempt + 1); }, 5 * 60 * 1000);
          } else {
            await db.update(postsTable).set({ apifyStatus: "not_found" }).where(eq(postsTable.id, postId)).catch(() => {});
          }
        }
      };

      // Quick scan at 5 seconds; if missed, cascades to 5-min and 10-min retries
      setTimeout(() => { void runScan(0); }, 5 * 1000);
    } else {
      // No handle or hashtag — mark not_found so user can claim manually
      await db.update(postsTable).set({ apifyStatus: "not_found" }).where(eq(postsTable.id, post.id));
    }

    return res.json({ postId: post.id, message: "Post intent recorded. Scanning now — we'll retry at 5 and 10 minutes if needed." });
  } catch (err) {
    console.error("[campaigns/:id/post-intent POST]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /campaigns/:id/post-status — poll scan status for this KOL's latest post
router.get("/campaigns/:id/post-status", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const campaignId = req.params.id;

    const [kol] = await db
      .select({ id: kolProfilesTable.id })
      .from(kolProfilesTable)
      .where(eq(kolProfilesTable.userId, session.userId))
      .limit(1);
    if (!kol) return res.status(400).json({ error: "KOL profile not found" });

    const posts = await db
      .select()
      .from(postsTable)
      .where(and(eq(postsTable.campaignId, campaignId), eq(postsTable.kolProfileId, kol.id)))
      .orderBy(desc(postsTable.createdAt))
      .limit(1);

    if (!posts.length) return res.json({ apifyStatus: null });

    const post = posts[0];
    return res.json({
      postId: post.id,
      status: post.status,
      apifyStatus: post.apifyStatus,
      tweetUrl: post.tweetUrl,
      tweetCreatedAt: post.tweetCreatedAt?.toISOString() ?? null,
      creditsEarned: post.creditsEarned,
    });
  } catch (err) {
    console.error("[campaigns/:id/post-status GET]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /campaigns/:id/claim-post — manual claim: verify tweet URL and approve
router.post("/campaigns/:id/claim-post", async (req, res) => {
  try {
    const session = await requireAuth(req, res);
    if (!session) return;

    const campaignId = req.params.id;
    const { tweetUrl } = req.body as { tweetUrl?: string };

    if (!tweetUrl) return res.status(400).json({ error: "tweetUrl required" });

    const [kol] = await db
      .select()
      .from(kolProfilesTable)
      .where(eq(kolProfilesTable.userId, session.userId))
      .limit(1);
    if (!kol) return res.status(400).json({ error: "KOL profile not found" });

    // Dedup — check if this URL is already tracked and approved
    const urlClaimed = await db
      .select({ id: postsTable.id, status: postsTable.status })
      .from(postsTable)
      .where(
        and(
          eq(postsTable.campaignId, campaignId),
          eq(postsTable.kolProfileId, kol.id),
          eq(postsTable.tweetUrl, tweetUrl),
        ),
      )
      .limit(1);

    if (urlClaimed.length > 0 && urlClaimed[0].status === "approved") {
      return res.status(409).json({ error: "already_tracked" });
    }

    // Fetch campaign for hashtag validation
    const [campaign] = await db
      .select({ maxPricePerPost: campaignsTable.maxPricePerPost, hashtag: campaignsTable.hashtag })
      .from(campaignsTable)
      .where(eq(campaignsTable.id, campaignId))
      .limit(1);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    // Verify tweet via Apify — strict, no trust-on-error; hashtag validated inside verifyPostUrl
    let canonicalUrl: string = tweetUrl;
    let tweetText: string | null = null;
    let tweetCreatedAt: Date | null = null;
    try {
      const result = await verifyPostUrl(tweetUrl, campaign.hashtag ?? undefined);
      canonicalUrl = result.url || tweetUrl;
      tweetText = result.text;
      tweetCreatedAt = result.createdAt ?? null;
    } catch (err) {
      if (err instanceof ApifyVerifyError) {
        if (err.code === "NOT_FOUND") {
          return res.status(422).json({ error: "not_found", message: err.message });
        }
        if (err.code === "MISSING_HASHTAG") {
          return res.status(422).json({ error: "missing_hashtag", hashtag: err.hashtag ?? campaign.hashtag, message: err.message });
        }
      }
      console.error("[claim-post] Apify verification error:", err);
      return res.status(503).json({ error: "verification_unavailable", message: "Verification service is temporarily unavailable. Please try again in a few minutes." });
    }

    // Re-check dedup using canonical URL — covers URL normalization variants from Apify
    const canonicalClaimed = await db
      .select({ id: postsTable.id, status: postsTable.status })
      .from(postsTable)
      .where(
        and(
          eq(postsTable.campaignId, campaignId),
          eq(postsTable.kolProfileId, kol.id),
          eq(postsTable.tweetUrl, canonicalUrl),
        ),
      )
      .limit(1);
    if (canonicalClaimed.length > 0 && canonicalClaimed[0].status === "approved") {
      return res.status(409).json({ error: "already_tracked", message: "This tweet has already been tracked and approved for this campaign." });
    }

    // Find existing pending post or create new one
    const [match] = await db
      .select({ id: campaignKolMatchesTable.id, priceAgreed: campaignKolMatchesTable.priceAgreed })
      .from(campaignKolMatchesTable)
      .where(
        and(
          eq(campaignKolMatchesTable.campaignId, campaignId),
          eq(campaignKolMatchesTable.kolProfileId, kol.id),
        ),
      )
      .limit(1);

    const creditsEarned = match?.priceAgreed ?? campaign.maxPricePerPost ?? 100;
    const today = new Date().toISOString().split("T")[0];

    const [pendingPost] = await db
      .select({ id: postsTable.id })
      .from(postsTable)
      .where(
        and(
          eq(postsTable.campaignId, campaignId),
          eq(postsTable.kolProfileId, kol.id),
          eq(postsTable.status, "pending"),
        ),
      )
      .limit(1);

    let postId: string;
    if (pendingPost) {
      postId = pendingPost.id;
    } else {
      const [newPost] = await db
        .insert(postsTable)
        .values({
          campaignId,
          kolProfileId: kol.id,
          matchId: match?.id ?? null,
          status: "pending",
          intentAt: new Date(),
          apifyStatus: "found",
          tweetUrl: canonicalUrl,
          tweetText,
          tweetCreatedAt,
          creditsEarned,
          postedDate: today,
        })
        .returning();
      postId = newPost.id;
    }

    await approvePostAndPay(postId, canonicalUrl, tweetText, tweetCreatedAt);

    // Re-read the approved post to get the actual creditsEarned (approvePostAndPay may have corrected it)
    const [approvedPost] = await db
      .select({ creditsEarned: postsTable.creditsEarned })
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .limit(1);
    const finalCreditsEarned = approvedPost?.creditsEarned ?? creditsEarned;

    return res.json({
      postId,
      creditsEarned: finalCreditsEarned,
      message: `Tweet verified! ${finalCreditsEarned} credits added to your account.`,
    });
  } catch (err) {
    console.error("[campaigns/:id/claim-post POST]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

