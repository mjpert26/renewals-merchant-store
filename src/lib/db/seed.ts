import type { DB } from "./index";
import { CATALOG, IMAGE_FOR_SLUG } from "./catalog";
import { DEFAULT_SETTINGS } from "@/lib/domain/settings";
import { ensureAccount } from "@/lib/domain/ledger";
import { recordFundingEvent, releaseFundingEvent } from "@/lib/domain/funding";
import { awardMilestone } from "@/lib/domain/milestones";
import { submitReferral, updateReferralStatus, requestCallback } from "@/lib/domain/engagement";
import { redeemReward, updateRedemptionStatus } from "@/lib/domain/redemptions";
import { getReward } from "@/lib/domain/rewards";
import type { Actor } from "@/lib/domain/audit";
import type { RedemptionStatus } from "@/lib/domain/types";

// Demo fixture. Every balance is produced by replaying history through the
// same domain functions the app uses, so the ledger reconciles by construction.
//
// Coastal Kitchen & Co. (the primary demo account) ends with:
//   available 5,250 · pending 3,200 · lifetime earned 7,750 · redeemed 2,500 · Gold

const SYSTEM: Actor = { id: "system", name: "Funding import (demo)" };
const ALYSSA: Actor = { id: "usr_alyssa", name: "Alyssa Moreno" };

const MERCHANTS = [
  {
    id: "mer_coastal",
    business_name: "Coastal Kitchen & Co.",
    owner_first_name: "Jordan",
    owner_last_name: "Reyes",
    email: "jordan@coastalkitchenco.com",
    phone: "(843) 555-0136",
    city: "Charleston",
    state: "SC",
    industry: "Restaurant",
    member_since: "2025-08-12T15:00:00.000Z",
    referral_code: "COASTAL-JR",
    account_manager: "Alyssa Moreno",
    external_ref: "DEMO-ACCT-10482",
  },
  {
    id: "mer_harbor",
    business_name: "Harbor Light Bakery",
    owner_first_name: "Priya",
    owner_last_name: "Natarajan",
    email: "priya@harborlightbakery.com",
    phone: "(207) 555-0191",
    city: "Portland",
    state: "ME",
    industry: "Bakery",
    member_since: "2026-04-02T14:00:00.000Z",
    referral_code: "HARBOR-PN",
    account_manager: "Devon Park",
    external_ref: "DEMO-ACCT-11207",
  },
  {
    id: "mer_summit",
    business_name: "Summit Ridge Auto Care",
    owner_first_name: "Marcus",
    owner_last_name: "Bell",
    email: "marcus@summitridgeauto.com",
    phone: "(303) 555-0164",
    city: "Denver",
    state: "CO",
    industry: "Auto repair",
    member_since: "2024-03-18T16:00:00.000Z",
    referral_code: "SUMMIT-MB",
    account_manager: "Alyssa Moreno",
    external_ref: "DEMO-ACCT-09315",
  },
];

const USERS = [
  { id: "usr_jordan", email: "jordan@coastalkitchenco.com", name: "Jordan Reyes", role: "merchant", title: "Owner", merchant_id: "mer_coastal" },
  { id: "usr_priya", email: "priya@harborlightbakery.com", name: "Priya Natarajan", role: "merchant", title: "Owner", merchant_id: "mer_harbor" },
  { id: "usr_marcus", email: "marcus@summitridgeauto.com", name: "Marcus Bell", role: "merchant", title: "Owner", merchant_id: "mer_summit" },
  { id: "usr_alyssa", email: "alyssa.moreno@bigthinkcapital.com", name: "Alyssa Moreno", role: "admin", title: "Renewals Manager", merchant_id: null },
  { id: "usr_devon", email: "devon.park@bigthinkcapital.com", name: "Devon Park", role: "admin", title: "Marketing Lead", merchant_id: null },
];

function seedCatalog(db: DB) {
  const now = new Date().toISOString();
  CATALOG.forEach((item, index) => {
    const id = `rw_${item.slug.replace(/-/g, "_")}`;
    db.prepare(
      `INSERT INTO rewards (id, slug, name, category, tagline, description, image, min_tier, delivery_method, delivery_estimate, terms,
        inventory, active, featured, option_field, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      item.slug,
      item.name,
      item.category,
      item.tagline,
      item.description,
      IMAGE_FOR_SLUG[item.slug],
      item.minTier,
      item.deliveryMethod,
      item.deliveryEstimate,
      item.terms,
      item.inventory,
      item.active === false ? 0 : 1,
      item.featured ? 1 : 0,
      item.optionField ? JSON.stringify(item.optionField) : null,
      index,
      now,
    );
    item.variants.forEach((v, vi) => {
      db.prepare(
        "INSERT INTO reward_variants (id, reward_id, label, points_cost, value_cents, active, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)",
      ).run(`${id}_v${vi + 1}`, id, v.label, v.points, v.valueCents ?? null, vi);
    });
  });
}

function fund(db: DB, merchantId: string, externalId: string, dealType: "initial" | "renewal", dollars: number, fundedAt: string) {
  return recordFundingEvent(
    db,
    {
      source: "salesforce",
      externalId,
      merchantRef: merchantId,
      dealType,
      fundedAmountCents: dollars * 100,
      fundedAt,
    },
    { actor: SYSTEM, recordedAt: fundedAt },
  ).event;
}

/** Moves the timestamps of the most recent claim activity back to a historical date. */
function backdate(db: DB, redemptionId: string, at: string, opts: { created?: boolean } = {}) {
  const lastEvent = db
    .prepare("SELECT id FROM redemption_events WHERE redemption_id = ? ORDER BY rowid DESC LIMIT 1")
    .get(redemptionId) as { id: string };
  db.prepare("UPDATE redemption_events SET created_at = ? WHERE id = ?").run(at, lastEvent.id);
  db.prepare("UPDATE redemptions SET updated_at = ? WHERE id = ?").run(at, redemptionId);
  db.prepare("UPDATE audit_log SET created_at = ? WHERE rowid = (SELECT MAX(rowid) FROM audit_log)").run(at);
  if (opts.created) {
    db.prepare("UPDATE redemptions SET created_at = ? WHERE id = ?").run(at, redemptionId);
    db.prepare("UPDATE ledger_entries SET created_at = ? WHERE ref_type = 'redemption' AND ref_id = ? AND type = 'redeem'").run(
      at,
      redemptionId,
    );
  }
}

function backdateReferral(db: DB, referralId: string, at: string) {
  db.prepare("UPDATE referrals SET created_at = ?, updated_at = ? WHERE id = ?").run(at, at, referralId);
  db.prepare("UPDATE audit_log SET created_at = ? WHERE entity_type = 'referral' AND entity_id = ? AND action = 'referral.submit'").run(
    at,
    referralId,
  );
}

function redeem(
  db: DB,
  merchantId: string,
  actor: Actor,
  slug: string,
  variantIndex: number,
  details: Record<string, unknown>,
  history: [RedemptionStatus, string, string?][],
) {
  const reward = getReward(db, slug)!;
  const variant = reward.variants[variantIndex];
  const { redemption } = redeemReward(
    db,
    merchantId,
    {
      rewardId: reward.id,
      variantId: variant.id,
      idempotencyKey: `seed-${merchantId}-${slug}-${history[0][1]}`,
      expectedCost: variant.pointsCost,
      details,
    },
    actor,
  );
  db.prepare("UPDATE redemptions SET fulfillment_note = ? WHERE id = ?").run(
    `Queued for staff fulfillment: ${reward.name} (${variant.label}).`,
    redemption.id,
  );
  backdate(db, redemption.id, history[0][1], { created: true });
  for (const [status, at, tracking] of history.slice(1)) {
    updateRedemptionStatus(db, redemption.id, status, ALYSSA, { trackingInfo: tracking });
    backdate(db, redemption.id, at);
  }
  return redemption;
}

export function seedDemoData(db: DB) {
  db.transaction(() => {
    db.prepare("INSERT INTO program_settings (id, value, updated_at, updated_by) VALUES (1, ?, ?, ?)").run(
      JSON.stringify(DEFAULT_SETTINGS),
      "2025-07-01T12:00:00.000Z",
      "Program launch defaults",
    );
    for (const m of MERCHANTS) {
      db.prepare(
        `INSERT INTO merchants (id, business_name, owner_first_name, owner_last_name, email, phone, city, state, industry, member_since,
          referral_code, account_manager, external_ref, created_at)
         VALUES (@id, @business_name, @owner_first_name, @owner_last_name, @email, @phone, @city, @state, @industry, @member_since,
          @referral_code, @account_manager, @external_ref, @member_since)`,
      ).run(m);
      ensureAccount(db, m.id);
    }
    for (const u of USERS) {
      db.prepare("INSERT INTO users (id, email, name, role, title, merchant_id) VALUES (@id, @email, @name, @role, @title, @merchant_id)").run(u);
    }
    seedCatalog(db);
    const settings = DEFAULT_SETTINGS;

    // ---- Coastal Kitchen & Co. ----
    const jordan: Actor = { id: "usr_jordan", name: "Jordan Reyes" };
    const c1 = fund(db, "mer_coastal", "DEMO-FUND-2025-0812", "initial", 60000, "2025-08-12T15:00:00.000Z");
    releaseFundingEvent(db, c1.id, SYSTEM, "2025-10-14T13:00:00.000Z");
    const c2 = fund(db, "mer_coastal", "DEMO-FUND-2026-0120", "renewal", 85000, "2026-01-20T15:00:00.000Z");
    releaseFundingEvent(db, c2.id, SYSTEM, "2026-03-24T13:00:00.000Z");
    const c3 = fund(db, "mer_coastal", "DEMO-FUND-2026-0506", "renewal", 117500, "2026-05-06T15:00:00.000Z");
    redeem(
      db,
      "mer_coastal",
      jordan,
      "digital-prepaid-card",
      0,
      { deliveryEmail: "jordan@coastalkitchenco.com" },
      [
        ["requested", "2026-06-10T17:20:00.000Z"],
        ["fulfilled", "2026-06-11T14:05:00.000Z"],
      ],
    );
    releaseFundingEvent(db, c3.id, SYSTEM, "2026-07-08T13:00:00.000Z");
    const ref = submitReferral(
      db,
      "mer_coastal",
      { businessName: "Palmetto Print Shop", ownerName: "Dana Whitaker", contact: "(843) 555-0177", consent: true },
      jordan,
    );
    backdateReferral(db, ref.id, "2026-06-02T16:00:00.000Z");
    updateReferralStatus(db, ref.id, "funded", ALYSSA, "2026-07-22T15:30:00.000Z");
    awardMilestone(db, "mer_coastal", "anniversary_1", settings, "2026-08-12T15:00:00.000Z");
    redeem(
      db,
      "mer_coastal",
      jordan,
      "branded-welcome-kit",
      0,
      {
        optionValue: "L",
        shippingAddress: {
          recipient: "Jordan Reyes",
          line1: "418 King Street",
          city: "Charleston",
          state: "SC",
          postalCode: "29403",
        },
      },
      [
        ["requested", "2026-08-20T18:45:00.000Z"],
        ["processing", "2026-08-21T13:10:00.000Z"],
        ["shipped", "2026-08-22T20:00:00.000Z", "UPS 1Z 84V 2E1 03 5521 7790"],
        ["fulfilled", "2026-08-26T19:30:00.000Z"],
      ],
    );
    fund(db, "mer_coastal", "DEMO-FUND-2026-0915", "renewal", 160000, "2026-09-15T15:00:00.000Z");
    const ref2 = submitReferral(
      db,
      "mer_coastal",
      { businessName: "Marsh Hen Coffee Roasters", ownerName: "Eli Brooks", contact: "eli@marshhencoffee.com", consent: true },
      jordan,
    );
    backdateReferral(db, ref2.id, "2026-10-06T14:00:00.000Z");
    db.prepare("UPDATE referrals SET status = 'in_review', updated_at = ? WHERE id = ?").run("2026-10-09T15:00:00.000Z", ref2.id);

    // ---- Harbor Light Bakery ----
    const priya: Actor = { id: "usr_priya", name: "Priya Natarajan" };
    const h1 = fund(db, "mer_harbor", "DEMO-FUND-2026-0402", "initial", 45000, "2026-04-02T14:00:00.000Z");
    releaseFundingEvent(db, h1.id, SYSTEM, "2026-06-05T13:00:00.000Z");
    redeem(
      db,
      "mer_harbor",
      priya,
      "cafe-gift-card",
      0,
      { deliveryEmail: "priya@harborlightbakery.com" },
      [["requested", "2026-10-18T12:15:00.000Z"]],
    );

    // ---- Summit Ridge Auto Care ----
    const marcus: Actor = { id: "usr_marcus", name: "Marcus Bell" };
    const s1 = fund(db, "mer_summit", "DEMO-FUND-2024-0318", "initial", 150000, "2024-03-18T16:00:00.000Z");
    releaseFundingEvent(db, s1.id, SYSTEM, "2024-05-20T13:00:00.000Z");
    const s2 = fund(db, "mer_summit", "DEMO-FUND-2024-0916", "renewal", 200000, "2024-09-16T16:00:00.000Z");
    releaseFundingEvent(db, s2.id, SYSTEM, "2024-11-18T13:00:00.000Z");
    awardMilestone(db, "mer_summit", "anniversary_1", settings, "2025-03-18T16:00:00.000Z");
    const s3 = fund(db, "mer_summit", "DEMO-FUND-2025-0414", "renewal", 250000, "2025-04-14T16:00:00.000Z");
    releaseFundingEvent(db, s3.id, SYSTEM, "2025-06-16T13:00:00.000Z");
    redeem(
      db,
      "mer_summit",
      marcus,
      "premium-headphones",
      0,
      {
        optionValue: "Midnight",
        shippingAddress: { recipient: "Marcus Bell", line1: "2250 S Broadway", city: "Denver", state: "CO", postalCode: "80210" },
      },
      [
        ["requested", "2025-06-30T15:00:00.000Z"],
        ["shipped", "2025-07-02T18:00:00.000Z", "FedEx 7781 2240 9913"],
        ["fulfilled", "2025-07-05T17:00:00.000Z"],
      ],
    );
    redeem(
      db,
      "mer_summit",
      marcus,
      "dinner-for-two",
      0,
      { deliveryEmail: "marcus@summitridgeauto.com" },
      [
        ["requested", "2025-12-05T19:00:00.000Z"],
        ["fulfilled", "2025-12-08T15:00:00.000Z"],
      ],
    );
    awardMilestone(db, "mer_summit", "anniversary_2", settings, "2026-03-18T16:00:00.000Z");
    const s4 = fund(db, "mer_summit", "DEMO-FUND-2026-0217", "renewal", 180000, "2026-02-17T16:00:00.000Z");
    releaseFundingEvent(db, s4.id, SYSTEM, "2026-04-20T13:00:00.000Z");
    redeem(
      db,
      "mer_summit",
      marcus,
      "smart-watch",
      0,
      {
        optionValue: "Medium/Large",
        shippingAddress: { recipient: "Marcus Bell", line1: "2250 S Broadway", city: "Denver", state: "CO", postalCode: "80210" },
      },
      [
        ["requested", "2026-10-14T16:40:00.000Z"],
        ["processing", "2026-10-15T14:00:00.000Z"],
      ],
    );
    fund(db, "mer_summit", "DEMO-FUND-2026-1002", "renewal", 220000, "2026-10-02T16:00:00.000Z");
    requestCallback(db, "mer_summit", { topic: "Renewal or new funding", preferredTime: "Morning (9–12)", phone: "(303) 555-0164" });
  })();
}
