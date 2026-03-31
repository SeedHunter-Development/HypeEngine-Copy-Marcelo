# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

### `artifacts/hypeengine` (`@workspace/hypeengine`)

**HypeEngine** — A mobile-first Next.js 15 (App Router) web app for crypto influencer marketing. Connects Crypto Projects (Clients) with KOLs (Key Opinion Leaders) for Twitter/X campaigns.

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind v4 via `@tailwindcss/postcss`, custom CSS classes
- **Brand colors**: Background `#11152C` (dark navy), text `#FFF5E7` (cream), orange gradient `#FBAC32 → #F29236`
- **Font**: Nunito Sans (Google Fonts via `next/font/google`)
- **Port**: 25387
- **Data**: Full PostgreSQL persistence via Express API server (`@workspace/api-server`). All browser `/api/*` traffic is proxied to Express (port 8080) — Next.js `app/api/*` routes are dead code/stubs.
- **Auth**: HTTP-only JWT cookie sessions (`he_session`, HS256, 7 days). Cookie set/cleared by Express. Next.js middleware (`middleware.ts`) protects `/admin/*` routes by reading and verifying the session cookie server-side.
- **Demo accounts** (all password `demo123`): `admin@demo.com` (admin), `client@demo.com` (client, 5000 credits), `kol@demo.com` / `kol2@demo.com` / `kol3@demo.com` (KOLs)
- **Routes**:
  - `/auth` — Login / Signup with role selection
  - `/setup` — Profile setup wizard (post-signup)
  - `/dashboard` — Client dashboard (credits, campaigns overview)
  - `/campaigns` — Client campaign list with search/filter
  - `/campaigns/new` — 3-step campaign creation wizard (2-checkbox service agreement in Step 3)
  - `/campaigns/detail?id={id}` — Campaign detail with metrics and post tracker (static page using search params)
  - `/credits` — Client credits balance and buy credits modal
  - `/profile` — Client profile editing
  - `/kol` — KOL dashboard (earnings, hot campaigns sorted by completion)
  - `/kol/campaigns` — KOL campaign feed with Discover/My Posts tabs (Proof of Delivery)
  - `/kol/campaigns/detail?id={id}` — Campaign detail with Post to X flow (modal), static page using search params
  - `/kol/credits` — KOL earnings and withdraw modal
  - `/kol/profile` — KOL profile with post history
- **Key features**:
  - 1-post-per-campaign-per-day rule, KOL reward multiplier based on followers
  - Simulated Twitter post flow with success modal showing credits earned
  - Campaign creation uses 2-checkbox service agreement (credit auth + ToS)
  - Credits properly deducted on campaign launch and added on KOL post
  - KOL "My Posts" tab with Proof of Delivery (metrics: views, likes, engagement per post)
  - Campaign detail uses search params (`?id=`) not dynamic routes — compatible with static export
- **Build**: `pnpm --filter @workspace/hypeengine run build` — produces static files in `dist/public/`
- **IMPORTANT**: Campaign detail pages use `/campaigns/detail?id=` and `/kol/campaigns/detail?id=` (NOT `/campaigns/[id]`). The old `[id]` routes still exist for backward compatibility with initial campaigns only.
- **Prompt 5 COMPLETE** — full tracking, analytics, delivery scoring, and feedback loop:
  - `lib/tracking/links.ts`: `generateTrackingLink()` — unique 8-char refCode (`he_xxxxxx`), auto-called on PATCH match → booked
  - `app/r/[refCode]/route.ts`: click redirect — IP hash, cookie `he_ref=`, 302 → destination+?he_ref=
  - `app/api/track/pixel.js/route.ts`: JS pixel served as `application/javascript` — `window.HypeEngine.trackConversion(type, value, meta)`, auto-fires pageview
  - `app/api/track/conversion/route.ts`: POST conversion with full CORS headers, writes to `tracking_conversions`
  - `app/api/campaigns/[id]/analytics/route.ts`: real-time aggregation — clicks/unique/conversions by type/ctr/cpa/kolBreakdown/recentEvents[10]/pixelStatus
  - `lib/analytics/delivery-score.ts`: `scoreCampaignDelivery(campaignId)` — 6-dimension scoring (engagement, reply quality, compliance, CTR, conv rate, satisfaction), saves to `kol_campaign_scores` + `campaign_results`
  - `lib/analytics/feedback-loop.ts`: `updateKolProfileFromCampaignHistory(kolProfileId)` — recency-weighted CPA/convRate/satisfaction/price-competitiveness back to `kol_profiles`
  - `app/api/campaigns/[id]/complete/route.ts`: POST complete — saves ratings, calls scoreCampaignDelivery + updateKolProfileFromCampaignHistory, marks status=completed
  - `app/api/kol/performance/route.ts`: GET performance history for KOL profile page
  - UI: ClientCampaignDetail — Campaign Performance analytics section, KOL Performance table, Tracking Setup (script tags + copy + test pixel + event log), Complete Campaign button → per-KOL rating modal → summary modal
  - UI: KOL profile page — Performance History section (4-stat grid, price multiplier explainer, per-campaign cards with score/clicks/conv/rating/feedback)
  - Matching engine: clientSatisfaction >4.0 adds +5% match score, <2.5 subtracts -10%; historicalCpa activates with ≥1 real data point
- **Prompt 6 COMPLETE** — AI tweet generation with embedded tracking links:
  - `lib/tracking/tweet-generator.ts`: `generatePersonalizedTweet(campaignId, kolProfileId, matchId, variation?)` — picks best template by KOL's contentVerticals, calls OpenAI gpt-4o-mini to adapt to KOL's voice, embeds trackingUrl (ctaPlacement: end_of_tweet / replace_in_template `{link}`), appends hashtag, fits under 280 chars (3-step trim: remove hashtag → shorten CTA → hard truncate). Also `generateAllTweetsForCampaign(campaignId)` for batch.
  - `app/api/campaigns/[id]/matches/[matchId]/route.ts` PATCH: on status=booked, after generateTrackingLink → auto-calls generatePersonalizedTweet, stores in match.generatedTweetText + originalTemplate
  - `app/api/kol/tweet/route.ts` GET `?campaignId&userId` — joins user→kol_profiles→matches→tracking_links, returns matchId, generatedTweetText, customTweetText, trackingUrl, refCode, status
  - `app/api/campaigns/[id]/matches/[matchId]/tweet/route.ts` PATCH — saves customTweetText to match. POST — "I Already Posted" flow: checks refCode in pasted tweet text, sets trackingLinkPresent, saves to posts table with trackingLinkId
  - `app/api/campaigns/[id]/matches/[matchId]/tweet/regenerate/route.ts` POST — calls generatePersonalizedTweet with variation=true, clears customTweetText, persists new generatedTweetText
  - UI: KolCampaignDetail — "Your Tweet" card replaces "Post Templates": Twitter-style dark preview with tracking URL highlighted in blue, char count, Edit (textarea with tracking-missing warning), Save, Regenerate (with spinner), Copy Tweet button + "Open in X/Twitter" blue button. "I Already Posted" modal — tweet URL + text paste → "Verify Tracking Link" → green ShieldCheck (present) / yellow ShieldAlert (missing) → submit creates post record
- **Task #2 COMPLETE** — Post Tracking: Automatic & Manual Tweet Detection (replaces old escrow/7-day verification system):
  - **Schema**: Added `intentAt`, `apifyStatus` (`scanning|found|not_found`), `tweetCreatedAt` to `posts` table; `post_approved` notification type added
  - **Escrow removed**: Deleted `lib/payments/escrow.ts` and `lib/payments/verification.ts`; `post_verifications` table kept in schema (no data loss); `admin/verify` and `admin/spot-check` routes stubbed
  - **Apify detection** (`artifacts/api-server/src/lib/apify.ts`):
    - `detectHashtagPost(handle, hashtag)` — scans KOL's recent 50 tweets for one containing the campaign hashtag (same actor `61RPP7dywgiy0JPD0`)
    - `verifyPostUrl(tweetUrl)` — parses handle+tweetId from URL, scans recent 200 tweets to verify tweet exists; trusts claim if Apify is down
  - **3 new Express endpoints** (`POST /api/campaigns/:id/post-intent`, `GET /api/campaigns/:id/post-status`, `POST /api/campaigns/:id/claim-post`):
    - `post-intent`: records post record (status=pending, apifyStatus=scanning), kicks off background Apify scan after 10 min via `setTimeout`
    - `post-status`: returns latest post's apifyStatus for polling
    - `claim-post`: verifies tweet URL via Apify, calls `approvePostAndPay` (credits KOL, creates earn transaction, sends `post_approved` notification)
    - `approvePostAndPay` helper: idempotent — updates post (status=approved, apifyStatus=found, tweetUrl, tweetCreatedAt), adds credits to KOL user, increments campaign.usedCredits
  - **UI — KolCampaignDetail** (full rewrite of posting/claiming flow):
    - "Post to X Now" → preview modal → "Post to X" button calls `post-intent`, opens Twitter, shows scanning stage
    - Scan status banner on main page: `pending` (spinner, "~10 min"), `found` (green check + credits), `not_found` (orange warning, claim manually)
    - 30-second polling of `post-status` while scan is pending; credits updated via `updateUser` when found
    - "Already Posted? Claim Credits" → URL-only form → calls `claim-post` → instant verification + credits; no tweet text field
    - Removed escrow state card (escrowInfo, escrowPostId, 4-checkpoint timeline)
