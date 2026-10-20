import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase, type DB } from "@/lib/db";
import { getAccount, reconcileAccount, listLedger } from "@/lib/domain/ledger";
import { recordFundingEvent, releaseFundingEvent, reverseFundingEvent } from "@/lib/domain/funding";
import { redeemReward, updateRedemptionStatus, getRedemption, listRedemptions } from "@/lib/domain/redemptions";
import { getReward, saveReward } from "@/lib/domain/rewards";
import { adjustPoints, getMerchantSummary } from "@/lib/domain/merchants";
import { submitReferral, updateReferralStatus } from "@/lib/domain/engagement";
import { listAudit } from "@/lib/domain/audit";
import { DomainError } from "@/lib/domain/errors";
import type { Actor } from "@/lib/domain/audit";

const JORDAN: Actor = { id: "usr_jordan", name: "Jordan Reyes" };
const STAFF: Actor = { id: "usr_alyssa", name: "Alyssa Moreno" };

function freshDb(): DB {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rewards-test-"));
  return openDatabase(path.join(dir, "test.db"));
}

function expectDomainError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`Expected DomainError ${code}`);
}

let key = 0;
const nextKey = () => `test-key-${Date.now()}-${++key}`;

describe("demo fixture", () => {
  it("matches the mockup balances and reconciles with the ledger", () => {
    const db = freshDb();
    const summary = getMerchantSummary(db, "mer_coastal");
    expect(summary.account).toEqual({
      merchantId: "mer_coastal",
      available: 5250,
      pending: 3200,
      lifetimeEarned: 7750,
      redeemed: 2500,
    });
    expect(summary.tier.current.id).toBe("gold");
    expect(summary.tier.pointsToNext).toBe(7250);
    expect(summary.fundedDeals).toBe(4);
    for (const id of ["mer_coastal", "mer_harbor", "mer_summit"]) {
      expect(reconcileAccount(db, id).matches).toBe(true);
    }
  });
});

describe("redemption", () => {
  let db: DB;
  beforeEach(() => {
    db = freshDb();
  });

  it("redeems an eligible reward, deducts points and records a claim", () => {
    const reward = getReward(db, "premium-headphones")!;
    const stockBefore = reward.inventory!;
    const variant = reward.variants[0];
    const { redemption, duplicate } = redeemReward(
      db,
      "mer_coastal",
      {
        rewardId: reward.id,
        variantId: variant.id,
        idempotencyKey: nextKey(),
        expectedCost: 4500,
        details: {
          optionValue: "Midnight",
          shippingAddress: { recipient: "Jordan Reyes", line1: "418 King Street", city: "Charleston", state: "SC", postalCode: "29403" },
        },
      },
      JORDAN,
    );
    expect(duplicate).toBe(false);
    expect(redemption.status).toBe("requested");
    expect(redemption.balanceAfter).toBe(750);
    const account = getAccount(db, "mer_coastal");
    expect(account.available).toBe(750);
    expect(account.redeemed).toBe(7000);
    expect(account.pending).toBe(3200);
    expect(listLedger(db, "mer_coastal")[0].type).toBe("redeem");
    expect(reconcileAccount(db, "mer_coastal").matches).toBe(true);
    expect(getReward(db, "premium-headphones")!.inventory).toBe(stockBefore - 1);
  });

  it("returns the original claim when the same submission is repeated", () => {
    const reward = getReward(db, "digital-prepaid-card")!;
    const input = {
      rewardId: reward.id,
      variantId: reward.variants[1].id,
      idempotencyKey: nextKey(),
      expectedCost: 3000,
      details: { deliveryEmail: "jordan@coastalkitchenco.com" },
    };
    const first = redeemReward(db, "mer_coastal", input, JORDAN);
    const second = redeemReward(db, "mer_coastal", input, JORDAN);
    expect(second.duplicate).toBe(true);
    expect(second.redemption.id).toBe(first.redemption.id);
    expect(getAccount(db, "mer_coastal").available).toBe(2250);
    expect(listRedemptions(db, { merchantId: "mer_coastal" })).toHaveLength(3);
  });

  it("rejects rewards the merchant cannot afford and never spends pending points", () => {
    const reward = getReward(db, "digital-prepaid-card")!;
    // $100 card costs 6,000. Available is 5,250; pending 3,200 must not count.
    expectDomainError(
      () =>
        redeemReward(
          db,
          "mer_coastal",
          {
            rewardId: reward.id,
            variantId: reward.variants[2].id,
            idempotencyKey: nextKey(),
            expectedCost: 6000,
            details: { deliveryEmail: "jordan@coastalkitchenco.com" },
          },
          JORDAN,
        ),
      "insufficient_points",
    );
    expect(getAccount(db, "mer_coastal").available).toBe(5250);
  });

  it("rejects tier-locked, out-of-stock and inactive rewards", () => {
    const watch = getReward(db, "smart-watch")!;
    expectDomainError(
      () =>
        redeemReward(
          db,
          "mer_coastal",
          { rewardId: watch.id, variantId: watch.variants[0].id, idempotencyKey: nextKey(), expectedCost: 8000, details: {} },
          JORDAN,
        ),
      "tier_locked",
    );
    const padfolio = getReward(db, "leather-padfolio")!;
    expectDomainError(
      () =>
        redeemReward(
          db,
          "mer_coastal",
          { rewardId: padfolio.id, variantId: padfolio.variants[0].id, idempotencyKey: nextKey(), expectedCost: 1800, details: {} },
          JORDAN,
        ),
      "out_of_stock",
    );
    const trees = getReward(db, "plant-100-trees")!;
    saveReward(
      db,
      trees.id,
      {
        ...trees,
        variants: trees.variants.map((v) => ({ ...v })),
        active: false,
      },
      STAFF,
    );
    expectDomainError(
      () =>
        redeemReward(
          db,
          "mer_coastal",
          { rewardId: trees.id, variantId: trees.variants[0].id, idempotencyKey: nextKey(), expectedCost: 1000, details: {} },
          JORDAN,
        ),
      "reward_unavailable",
    );
    expect(getAccount(db, "mer_coastal").available).toBe(5250);
  });

  it("rejects a stale price sent by the client", () => {
    const reward = getReward(db, "plant-100-trees")!;
    expectDomainError(
      () =>
        redeemReward(
          db,
          "mer_coastal",
          { rewardId: reward.id, variantId: reward.variants[0].id, idempotencyKey: nextKey(), expectedCost: 10, details: {} },
          JORDAN,
        ),
      "invalid_input",
    );
  });

  it("cannot overspend when many different requests arrive for the same balance", () => {
    const reward = getReward(db, "credit-concierge-review")!; // 2,500 points
    const results = Array.from({ length: 5 }, () => {
      try {
        return redeemReward(
          db,
          "mer_coastal",
          { rewardId: reward.id, variantId: reward.variants[0].id, idempotencyKey: nextKey(), expectedCost: 2500, details: {} },
          JORDAN,
        );
      } catch (error) {
        return error;
      }
    });
    const successes = results.filter((r) => !(r instanceof Error));
    expect(successes).toHaveLength(2);
    expect(getAccount(db, "mer_coastal").available).toBe(250);
    expect(reconcileAccount(db, "mer_coastal").matches).toBe(true);
  });

  it("refunds points and restores inventory when staff cancel a claim", () => {
    const reward = getReward(db, "premium-headphones")!;
    const stockBefore = reward.inventory!;
    const { redemption } = redeemReward(
      db,
      "mer_coastal",
      {
        rewardId: reward.id,
        variantId: reward.variants[0].id,
        idempotencyKey: nextKey(),
        expectedCost: 4500,
        details: {
          optionValue: "Silver",
          shippingAddress: { recipient: "Jordan Reyes", line1: "418 King Street", city: "Charleston", state: "SC", postalCode: "29403" },
        },
      },
      JORDAN,
    );
    expectDomainError(() => updateRedemptionStatus(db, redemption.id, "canceled", STAFF), "reason_required");
    updateRedemptionStatus(db, redemption.id, "canceled", STAFF, { note: "Color backordered; merchant asked to cancel." });
    expect(getAccount(db, "mer_coastal").available).toBe(5250);
    expect(getAccount(db, "mer_coastal").redeemed).toBe(2500);
    expect(getReward(db, "premium-headphones")!.inventory).toBe(stockBefore);
    expectDomainError(() => updateRedemptionStatus(db, redemption.id, "fulfilled", STAFF), "invalid_transition");
    expect(reconcileAccount(db, "mer_coastal").matches).toBe(true);
  });
});

describe("funding events", () => {
  it("awards pending points once per external id, even when replayed", () => {
    const db = freshDb();
    const event = {
      source: "n8n",
      externalId: "DEMO-FUND-REPLAY-1",
      merchantRef: "DEMO-ACCT-11207",
      dealType: "renewal",
      fundedAmountCents: 50_000_00,
      fundedAt: "2026-10-19T15:00:00.000Z",
    };
    const first = recordFundingEvent(db, event);
    const second = recordFundingEvent(db, event);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.event.id).toBe(first.event.id);
    expect(getAccount(db, "mer_harbor").pending).toBe(1000);
    // Release is also single-shot.
    releaseFundingEvent(db, first.event.id, STAFF);
    expectDomainError(() => releaseFundingEvent(db, first.event.id, STAFF), "invalid_transition");
    const account = getAccount(db, "mer_harbor");
    expect(account.pending).toBe(0);
    expect(account.available).toBe(250 + 1000);
    expect(reconcileAccount(db, "mer_harbor").matches).toBe(true);
  });

  it("reverses pending points with a reason", () => {
    const db = freshDb();
    const pending = db.prepare("SELECT id FROM funding_events WHERE merchant_id = 'mer_coastal' AND status = 'pending'").get() as {
      id: string;
    };
    expectDomainError(() => reverseFundingEvent(db, pending.id, STAFF, " "), "reason_required");
    reverseFundingEvent(db, pending.id, STAFF, "Deal unwound before first payment.");
    expect(getAccount(db, "mer_coastal").pending).toBe(0);
    expect(getAccount(db, "mer_coastal").available).toBe(5250);
  });

  it("rejects events for unknown merchants", () => {
    const db = freshDb();
    expectDomainError(
      () =>
        recordFundingEvent(db, {
          source: "salesforce",
          externalId: "X-1",
          merchantRef: "nope",
          dealType: "initial",
          fundedAmountCents: 100,
          fundedAt: "2026-10-19T15:00:00.000Z",
        }),
      "not_found",
    );
  });
});

describe("adjustments and audit", () => {
  it("requires a reason, cannot overdraw and writes an audit entry", () => {
    const db = freshDb();
    expectDomainError(
      () => adjustPoints(db, { merchantId: "mer_harbor", direction: "credit", points: 100, reason: "", idempotencyKey: nextKey() }, STAFF),
      "invalid_input",
    );
    expectDomainError(
      () =>
        adjustPoints(
          db,
          { merchantId: "mer_harbor", direction: "debit", points: 5000, reason: "Testing an overdraw attempt", idempotencyKey: nextKey() },
          STAFF,
        ),
      "insufficient_points",
    );
    const k = nextKey();
    adjustPoints(db, { merchantId: "mer_harbor", direction: "credit", points: 300, reason: "Goodwill credit for a delayed order", idempotencyKey: k }, STAFF);
    adjustPoints(db, { merchantId: "mer_harbor", direction: "credit", points: 300, reason: "Goodwill credit for a delayed order", idempotencyKey: k }, STAFF);
    expect(getAccount(db, "mer_harbor").available).toBe(550);
    const audit = listAudit(db, { merchantId: "mer_harbor" }).filter((a) => a.action === "points.adjust");
    expect(audit).toHaveLength(1);
    expect(audit[0].reason).toBe("Goodwill credit for a delayed order");
    expect(reconcileAccount(db, "mer_harbor").matches).toBe(true);
  });
});

describe("referrals", () => {
  it("awards the referral bonus once when funded", () => {
    const db = freshDb();
    const referral = submitReferral(
      db,
      "mer_harbor",
      { businessName: "Bayside Florist", ownerName: "Lena Ortiz", contact: "lena@baysideflorist.com", consent: true },
      { id: "usr_priya", name: "Priya Natarajan" },
    );
    updateReferralStatus(db, referral.id, "funded", STAFF);
    expectDomainError(() => updateReferralStatus(db, referral.id, "funded", STAFF), "invalid_transition");
    expect(getAccount(db, "mer_harbor").available).toBe(250 + 1500);
    expectDomainError(
      () =>
        submitReferral(
          db,
          "mer_harbor",
          { businessName: "Bayside Florist", ownerName: "Lena Ortiz", contact: "lena@baysideflorist.com", consent: true },
          { id: "usr_priya", name: "Priya Natarajan" },
        ),
      "duplicate",
    );
  });
});

describe("merchant isolation", () => {
  it("does not return another merchant's claim", () => {
    const db = freshDb();
    const summitClaim = listRedemptions(db, { merchantId: "mer_summit" })[0];
    expect(getRedemption(db, summitClaim.id, { merchantId: "mer_coastal" })).toBeNull();
    expect(getRedemption(db, summitClaim.id, { merchantId: "mer_summit" })?.id).toBe(summitClaim.id);
  });
});
