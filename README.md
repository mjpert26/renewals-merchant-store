# Big Think Rewards

A merchant rewards portal for Big Think Capital. Merchants earn points each time their business is funded, including renewals, and redeem them for gift cards, merchandise, experiences, business services and charitable giving. Renewals and marketing staff manage the catalog, fulfill claims, inspect balances and apply audited adjustments from a separate admin area.

This is a complete, runnable first version operating in **demo mode**: all merchants, balances and claims are sample data, and no real gift cards, shipments, emails or funding records are created.

## Quick start

Requirements: Node.js 20 or later (developed on Node 22) and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The SQLite database is created and seeded automatically at `data/rewards.db` on first request.

### Demo accounts

The sign-in page lists every demo account; no password is needed.

| Account | Role | What to look at |
| --- | --- | --- |
| Jordan Reyes, Coastal Kitchen & Co. | Merchant, Gold | Primary fixture: 5,250 available, 3,200 pending, 7,750 lifetime, 2,500 redeemed |
| Priya Natarajan, Harbor Light Bakery | Merchant, Silver | Small balance, one claim awaiting fulfillment |
| Marcus Bell, Summit Ridge Auto Care | Merchant, Platinum | Platinum rewards, an in-progress claim, an open callback request |
| Alyssa Moreno | Staff, Renewals Manager | Admin area |
| Devon Park | Staff, Marketing Lead | Admin area |

To start over with clean demo data: stop the server, run `npm run db:reset`, and start it again.

## Deploying to Vercel

1. Import the repository in Vercel. The framework preset (Next.js) and build settings are detected automatically.
2. Under Project Settings → Environment Variables, add `SESSION_SECRET` with a random value of at least 32 characters (for example, the output of `openssl rand -hex 32` on macOS or Linux, or this PowerShell command on Windows: `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | % { $_.ToString('x2') })`). Without it, the sign-in page shows a setup message and sign-in is disabled.
3. Redeploy so the variable takes effect.

On Vercel the demo database is created in the function's temporary directory (`/tmp`), because the rest of the filesystem is read-only. That database is seeded automatically but is **per instance and temporary**: it resets on cold starts and is not shared between concurrent instances, so claims made in one session can disappear. This is acceptable for a click-through demo. Before real use, move persistence to a hosted database.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server (`SESSION_SECRET` required) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Domain behavior tests (ledger, redemption, idempotency, isolation) |
| `npm run e2e` | Browser end-to-end checks against a running server (see header of `scripts/e2e.ts`) |
| `npm run screenshots` | Full-page desktop and mobile screenshots plus overflow and console-error checks |
| `npm run db:reset` | Recreate the demo database |

## Environment variables

See `.env.example`. None are needed for local development.

| Variable | Default | Notes |
| --- | --- | --- |
| `SESSION_SECRET` | Development-only fallback | Required in production, 32+ characters |
| `DEMO_MODE` | `true` | `false` disables persona sign-in and simulated funding |
| `REWARDS_DB_PATH` | `data/rewards.db` (`/tmp/rewards.db` on Vercel) | SQLite file location |
| `FUNDING_WEBHOOK_SECRET` | unset | Enables the funding integration endpoints |

## What is implemented

### Merchant experience

- **Overview**: greeting, available, pending, lifetime and redeemed points, tier progress, membership card, recommended next reward, featured rewards, recent activity, claims and milestones.
- **Rewards catalog**: image-led cards, search, category filters, sorting, and an "Affordable with my points" filter. Cards show cost, availability, stock and tier restrictions.
- **Reward detail and redemption**: imagery, description, delivery method, eligibility, terms, denominations and options, delivery details, and a confirmation step showing points spent and the balance after. Submission leads to a receipt with fulfillment status.
- **Points activity**: searchable, filterable history grouped by month, with pending-release expectations.
- **Claim history**: in-progress and completed claims with progress steps, receipts and timelines.
- **Member benefits**: Silver, Gold and Platinum tiers with progression and configurable benefits; milestones.
- **Referrals**: referral link with copy and share, referral submission with consent, and referral status.
- **Help and preferences**: how points work (generated from live settings), call, text and email links, callback requests, and notification preferences that save automatically.
- Loading, empty, error, not-found, pending, success, insufficient-points, tier-locked, out-of-stock and unavailable states.

### Admin experience (`/admin`, staff only)

- Dashboard with program totals, fulfillment queue, ledger reconciliation status and recent changes.
- Claims queue with a fulfillment drawer. Canceling or failing a claim requires a reason, refunds points and restores stock.
- Merchant search and detail: balances, funding events (release and reverse), full ledger, claims, referrals, audit trail, audited point adjustments, and a funding simulator (demo mode).
- Reward catalog editor: descriptions, imagery, categories, price options, stock, tier eligibility, featured and live flags.
- Program settings editor: earning rate, release rule, bonuses, tiers, limits, expiration and support contacts. A change reason is required and history is kept.
- Referrals and callback requests; filterable audit log.

## Points ledger design

- `ledger_entries` is the source of truth. Every change is an explicit, typed transaction: `earn_pending`, `release`, `pending_reversal`, `bonus`, `redeem`, `refund`, `adjustment`, `expiration`. Sign rules per type are enforced in code.
- `point_accounts` is a projection updated in the same transaction as each ledger write, with database `CHECK` constraints so spendable and pending balances can never go negative. `reconcileAccount()` recomputes balances from the ledger; the admin dashboard and tests use it.
- Pending points never count toward spendable balance. Lifetime points (which set the tier) are not reduced by redemptions.
- Every ledger entry carries a unique idempotency key. Funding events are unique on `(source, external_id)`, so repeated imports or webhook deliveries cannot award points twice. Redemptions are unique on a client-generated request key, so double clicks and retries return the original claim.
- Redemptions validate, on the server and inside a single `BEGIN IMMEDIATE` transaction: the merchant (from the session, never the client), the reward and option, the expected price, tier eligibility, stock, the monthly limit, and the spendable balance. Points are deducted and stock reserved atomically.
- Canceled or failed claims post an explicit `refund` entry and restore stock.
- Staff actions write to `audit_log` with actor, reason and before and after values.

## Security and permissions

- Merchant and staff roles are checked in every page, Server Function and Route Handler (`src/lib/auth/session.ts`). The proxy (`src/proxy.ts`) only redirects signed-out visitors.
- Merchant data access is always scoped by the session's merchant ID. Another merchant's claim is indistinguishable from a missing one.
- Integration endpoints require a bearer token compared in constant time and are disabled when no secret is configured.

## Integrations and simulated services

| Area | Status in this version |
| --- | --- |
| Authentication | Demo persona sign-in with signed cookies. Replace with the company identity provider (`src/lib/auth`). |
| Persistence | SQLite via `better-sqlite3` behind domain functions in `src/lib/domain`. Suitable for the demo and a single instance; move to a managed database before multi-instance hosting. |
| Funding events | `POST /api/integrations/funding-events` accepts normalized events from Salesforce or n8n. Upstream object and field mapping is intentionally not assumed; see `src/lib/integrations/funding-source.ts`. The admin funding simulator creates events marked as simulated. |
| Point release | `POST /api/integrations/funding-events/release` for a payment-tracking workflow, or the Release button in the admin area. |
| Reward fulfillment | Manual staff queue behind the `FulfillmentProvider` interface (`src/lib/integrations/fulfillment.ts`). No gift card vendor is connected. |
| Email notifications | Preferences are stored; no emails are sent. |
| Anniversary bonuses | "Run daily jobs" in the admin dashboard awards due anniversaries. Schedule it in production. |

### Funding webhook example

```bash
curl -X POST http://localhost:3000/api/integrations/funding-events \
  -H "Authorization: Bearer $FUNDING_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"source":"n8n","events":[{"externalId":"DEAL-123","merchantRef":"DEMO-ACCT-11207","dealType":"renewal","fundedAmount":50000,"fundedAt":"2026-10-20T15:00:00Z"}]}'
```

Each event returns `created`, `duplicate` or `error`. Re-sending the same payload is safe.

## Design system and components

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Radix UI primitives, Lucide icons, Sonner toasts.
- Design tokens live in `src/app/globals.css`: deep navy canvas, layered slate surfaces, electric blue actions and restrained gold for membership status.
- React Bits components in `src/components/reactbits`:
  - `Counter`: animated points balance with a screen-reader label.
  - `SpotlightCard`: lighting and depth on reward cards.
  - `AnimatedContent`: section entrances below the fold.
  - `DarkVeil`: restrained animated background for the points panel, tinted to the brand, with a static gradient fallback.
  - `MembershipCard`: adapted from the React Bits Pro `credit-card` component, with no card details or flip, tilt only for mouse pointers, page scrolling preserved on touch devices, and a static card under reduced motion.
- Every animation respects `prefers-reduced-motion`. Focus is visible on every interactive element.
- Reward imagery in `public/images/rewards` was generated for this prototype and contains no third-party brands.

## Decisions still needed from the business

All of the following are configurable placeholders until approved:

1. Earning rate (currently 2 points per $100 funded) and whether renewals earn a multiplier.
2. Release rule for pending points (currently 8 on-time payments, about 60 days) and the system of record for payment status.
3. Tier thresholds (Gold 5,000 and Platinum 15,000 lifetime points) and tier benefits.
4. Bonus amounts for milestones, anniversaries and referrals, and whether the referred business also receives a bonus and how it is applied.
5. Referral and redemption limits, point expiration policy, and point liability accounting.
6. Reward catalog, point prices, vendors and the gift card fulfillment provider.
7. Tax reporting treatment for rewards and the program terms and conditions.
8. The Salesforce or n8n field mapping for funding events, merchant identifiers and payment status.
9. Identity provider for merchant and staff sign-in, and the production database.
