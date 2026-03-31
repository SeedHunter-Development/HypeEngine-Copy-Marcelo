import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  real,
  jsonb,
  date,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── TABLE 1: users ──────────────────────────────────────────────────────────
export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().$type<"client" | "kol" | "admin">(),
  name: text("name"),
  bio: text("bio"),
  country: text("country"),
  language: text("language"),
  companyName: text("company_name"),
  jobTitle: text("job_title"),
  websiteUrl: text("website_url"),
  twitterAccount: text("twitter_account"),
  credits: integer("credits").default(0),
  setupComplete: boolean("setup_complete").default(false),
  agreedToTerms: boolean("agreed_to_terms").default(false),
  walletConnected: boolean("wallet_connected").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

// ─── TABLE 2: kol_profiles ───────────────────────────────────────────────────
export const kolProfilesTable = pgTable("kol_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id).unique().notNull(),
  twitterHandle: text("twitter_handle").unique().notNull(),
  twitterFollowers: integer("twitter_followers").default(0),
  twitterFollowing: integer("twitter_following").default(0),
  niches: text("niches").array(),
  primaryLanguage: text("primary_language"),
  secondaryLanguages: text("secondary_languages").array(),
  contentVerticals: jsonb("content_verticals"),
  verticalWeights: jsonb("vertical_weights"),
  avgPostsPerDay: real("avg_posts_per_day"),
  originalVsRtRatio: real("original_vs_rt_ratio"),
  threadFrequency: real("thread_frequency"),
  shillFrequency: real("shill_frequency"),
  projectMentions: text("project_mentions").array(),
  avgLikes: real("avg_likes"),
  avgRetweets: real("avg_retweets"),
  avgReplies: real("avg_replies"),
  engagementRate: real("engagement_rate"),
  rtToLikeRatio: real("rt_to_like_ratio"),
  engagementConsistency: real("engagement_consistency"),
  quoteTweetRatio: real("quote_tweet_ratio"),
  replyLangDist: jsonb("reply_lang_dist"),
  followerSampleGeo: jsonb("follower_sample_geo"),
  followerCryptoPct: real("follower_crypto_pct"),
  replyQualityScore: real("reply_quality_score"),
  twitterScoreValue: real("twitter_score_value"),
  notableFollowers: jsonb("notable_followers"),
  vcFollowerCount: integer("vc_follower_count").default(0),
  exchangeFollowerCount: integer("exchange_follower_count").default(0),
  followerGrowthTrend: text("follower_growth_trend").$type<"steady" | "spiking" | "declining" | "new">(),
  authenticityScore: real("authenticity_score"),
  engRateFlag: real("eng_rate_flag"),
  consistencyFlag: real("consistency_flag"),
  replyQualityFlag: real("reply_quality_flag"),
  followerSampleFlag: real("follower_sample_flag"),
  campaignsCompleted: integer("campaigns_completed").default(0),
  avgCpaByGoal: jsonb("avg_cpa_by_goal"),
  convRateByVertical: jsonb("conv_rate_by_vertical"),
  clientSatisfaction: real("client_satisfaction"),
  priceCompetitiveness: real("price_competitiveness"),
  totalPostsVerified: integer("total_posts_verified").default(0),
  totalPostsDeleted: integer("total_posts_deleted").default(0),
  postPayoutDeletions: integer("post_payout_deletions").default(0),
  postReliabilityRate: real("post_reliability_rate").default(1.0),
  lastDataRefresh: timestamp("last_data_refresh"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertKolProfileSchema = createInsertSchema(kolProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKolProfile = z.infer<typeof insertKolProfileSchema>;
export type KolProfile = typeof kolProfilesTable.$inferSelect;

// ─── TABLE 3: campaigns ──────────────────────────────────────────────────────
export const campaignsTable = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => usersTable.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  hashtag: text("hashtag"),
  postTemplates: text("post_templates").array(),
  credits: integer("credits").notNull(),
  maxPricePerPost: integer("max_price_per_post"),
  maxPostsPerKolPerDay: integer("max_posts_per_kol_per_day"),
  maxPostsPerKolTotal: integer("max_posts_per_kol_total"),
  targetNiches: text("target_niches").array(),
  targetCountry: text("target_country"),
  targetLanguage: text("target_language"),
  campaignGoal: text("campaign_goal").$type<"conversion" | "awareness" | "community">(),
  landingPageUrl: text("landing_page_url"),
  ctaText: text("cta_text"),
  ctaPlacement: text("cta_placement").default("end_of_tweet").$type<"end_of_tweet" | "replace_in_template">(),
  aiPersonalization: boolean("ai_personalization").default(true),
  status: text("status").default("draft").$type<"draft" | "active" | "paused" | "completed">(),
  usedCredits: integer("used_credits").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type DbCampaign = typeof campaignsTable.$inferSelect;

// ─── TABLE 4: campaign_kol_matches ───────────────────────────────────────────
export const campaignKolMatchesTable = pgTable("campaign_kol_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id).notNull(),
  kolProfileId: uuid("kol_profile_id").references(() => kolProfilesTable.id).notNull(),
  matchScore: real("match_score"),
  matchBreakdown: jsonb("match_breakdown"),
  status: text("status").default("recommended").$type<"recommended" | "booked" | "active" | "completed" | "rejected">(),
  priceAgreed: integer("price_agreed"),
  generatedTweetText: text("generated_tweet_text"),
  originalTemplate: text("original_template"),
  customTweetText: text("custom_tweet_text"),
  trackingLinkVerified: boolean("tracking_link_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  unique().on(t.campaignId, t.kolProfileId),
]);

export const insertCampaignKolMatchSchema = createInsertSchema(campaignKolMatchesTable).omit({ id: true, createdAt: true });
export type InsertCampaignKolMatch = z.infer<typeof insertCampaignKolMatchSchema>;
export type CampaignKolMatch = typeof campaignKolMatchesTable.$inferSelect;

// ─── TABLE 5: posts ──────────────────────────────────────────────────────────
export const postsTable = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id).notNull(),
  kolProfileId: uuid("kol_profile_id").references(() => kolProfilesTable.id).notNull(),
  matchId: uuid("match_id").references(() => campaignKolMatchesTable.id),
  tweetUrl: text("tweet_url"),
  tweetText: text("tweet_text"),
  status: text("status").default("pending").$type<"pending" | "approved" | "rejected">(),
  creditsEarned: integer("credits_earned").default(0),
  trackingLinkPresent: boolean("tracking_link_present").default(false),
  trackingLinkId: uuid("tracking_link_id"),
  intentAt: timestamp("intent_at"),
  apifyStatus: text("apify_status").$type<"scanning" | "found" | "not_found">(),
  tweetCreatedAt: timestamp("tweet_created_at"),
  postedDate: date("posted_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, createdAt: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type DbPost = typeof postsTable.$inferSelect;

// ─── TABLE 6: transactions ───────────────────────────────────────────────────
export const transactionsTable = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id).notNull(),
  type: text("type").notNull().$type<"deposit" | "spend" | "earn" | "withdraw">(),
  amount: integer("amount").notNull(),
  description: text("description"),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type DbTransaction = typeof transactionsTable.$inferSelect;

// ─── TABLE 7: tracking_links ─────────────────────────────────────────────────
export const trackingLinksTable = pgTable("tracking_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id).notNull(),
  kolProfileId: uuid("kol_profile_id").references(() => kolProfilesTable.id).notNull(),
  matchId: uuid("match_id").references(() => campaignKolMatchesTable.id),
  refCode: text("ref_code").unique().notNull(),
  destinationUrl: text("destination_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTrackingLinkSchema = createInsertSchema(trackingLinksTable).omit({ id: true, createdAt: true });
export type InsertTrackingLink = z.infer<typeof insertTrackingLinkSchema>;
export type TrackingLink = typeof trackingLinksTable.$inferSelect;

// ─── TABLE 8: tracking_clicks ────────────────────────────────────────────────
export const trackingClicksTable = pgTable("tracking_clicks", {
  id: uuid("id").primaryKey().defaultRandom(),
  trackingLinkId: uuid("tracking_link_id").references(() => trackingLinksTable.id).notNull(),
  kolProfileId: uuid("kol_profile_id").references(() => kolProfilesTable.id).notNull(),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id).notNull(),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  referer: text("referer"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertTrackingClickSchema = createInsertSchema(trackingClicksTable).omit({ id: true });
export type InsertTrackingClick = z.infer<typeof insertTrackingClickSchema>;
export type TrackingClick = typeof trackingClicksTable.$inferSelect;

// ─── TABLE 9: tracking_conversions ───────────────────────────────────────────
export const trackingConversionsTable = pgTable("tracking_conversions", {
  id: uuid("id").primaryKey().defaultRandom(),
  trackingLinkId: uuid("tracking_link_id").references(() => trackingLinksTable.id),
  kolProfileId: uuid("kol_profile_id").references(() => kolProfilesTable.id).notNull(),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id).notNull(),
  eventType: text("event_type").notNull().$type<"signup" | "deposit" | "trade" | "install" | "custom">(),
  eventValue: real("event_value"),
  metadata: jsonb("metadata"),
  source: text("source").notNull().default("pixel"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertTrackingConversionSchema = createInsertSchema(trackingConversionsTable).omit({ id: true });
export type InsertTrackingConversion = z.infer<typeof insertTrackingConversionSchema>;
export type TrackingConversion = typeof trackingConversionsTable.$inferSelect;

// ─── TABLE 10: campaign_results ──────────────────────────────────────────────
export const campaignResultsTable = pgTable("campaign_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id).notNull().unique(),
  totalClicks: integer("total_clicks").default(0),
  uniqueClicks: integer("unique_clicks").default(0),
  totalConversions: integer("total_conversions").default(0),
  totalConversionValue: real("total_conversion_value").default(0),
  avgCpa: real("avg_cpa"),
  avgCtr: real("avg_ctr"),
  overallDeliveryScore: real("overall_delivery_score"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCampaignResultSchema = createInsertSchema(campaignResultsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCampaignResult = z.infer<typeof insertCampaignResultSchema>;
export type CampaignResult = typeof campaignResultsTable.$inferSelect;

// ─── TABLE 11: kol_campaign_scores ───────────────────────────────────────────
export const kolCampaignScoresTable = pgTable("kol_campaign_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id).notNull(),
  kolProfileId: uuid("kol_profile_id").references(() => kolProfilesTable.id).notNull(),
  matchId: uuid("match_id").references(() => campaignKolMatchesTable.id),
  clicks: integer("clicks").default(0),
  uniqueClicks: integer("unique_clicks").default(0),
  conversions: integer("conversions").default(0),
  conversionValue: real("conversion_value").default(0),
  tweetUrl: text("tweet_url"),
  tweetLikes: integer("tweet_likes"),
  tweetRetweets: integer("tweet_retweets"),
  tweetReplies: integer("tweet_replies"),
  tweetViews: integer("tweet_views"),
  tweetReplyQuality: real("tweet_reply_quality"),
  contentComplianceScore: real("content_compliance_score"),
  engagementDeliveryScore: real("engagement_delivery_score"),
  clickThroughRate: real("click_through_rate"),
  conversionRate: real("conversion_rate"),
  costPerAcquisition: real("cost_per_acquisition"),
  clientRating: real("client_rating"),
  clientFeedback: text("client_feedback"),
  deliveryScore: real("delivery_score"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertKolCampaignScoreSchema = createInsertSchema(kolCampaignScoresTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKolCampaignScore = z.infer<typeof insertKolCampaignScoreSchema>;
export type KolCampaignScore = typeof kolCampaignScoresTable.$inferSelect;

// ─── TABLE 12: kol_follower_snapshots ────────────────────────────────────────
export const kolFollowerSnapshotsTable = pgTable("kol_follower_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  kolProfileId: uuid("kol_profile_id").references(() => kolProfilesTable.id).notNull(),
  followerCount: integer("follower_count").notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  unique().on(t.kolProfileId, t.snapshotDate),
]);

export const insertKolFollowerSnapshotSchema = createInsertSchema(kolFollowerSnapshotsTable).omit({ id: true, createdAt: true });
export type InsertKolFollowerSnapshot = z.infer<typeof insertKolFollowerSnapshotSchema>;
export type KolFollowerSnapshot = typeof kolFollowerSnapshotsTable.$inferSelect;

// ─── TABLE 13: notifications ─────────────────────────────────────────────────
export const notificationsTable = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id).notNull(),
  type: text("type").notNull().$type<"verification_passed" | "verification_failed" | "payout_released" | "escrow_returned" | "post_approved">(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
