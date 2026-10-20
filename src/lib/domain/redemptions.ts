import { z } from "zod";
import type { DB } from "@/lib/db";
import { inWriteTransaction, newId, nowIso } from "@/lib/db";
import type {
  Redemption,
  RedemptionDetails,
  RedemptionEvent,
  RedemptionStatus,
  RewardCategory,
  DeliveryMethod,
} from "./types";
import { getReward, availabilityFor } from "./rewards";
import { getAccount, postEntry } from "./ledger";
import { getSettings } from "./settings-store";
import { tierFor } from "./settings";
import { writeAudit, type Actor } from "./audit";
import { DomainError } from "./errors";
import { providerFor } from "@/lib/integrations/fulfillment";

import { STATUS_LABELS } from "./status-labels";
export { STATUS_LABELS };

// Allowed staff transitions. Canceled and failed are terminal and refund points.
const TRANSITIONS: Record<RedemptionStatus, RedemptionStatus[]> = {
  requested: ["processing", "shipped", "fulfilled", "canceled", "failed"],
  processing: ["shipped", "fulfilled", "canceled", "failed"],
  shipped: ["fulfilled", "failed"],
  fulfilled: [],
  canceled: [],
  failed: [],
};

export function nextStatuses(status: RedemptionStatus): RedemptionStatus[] {
  return TRANSITIONS[status];
}

const addressSchema = z.object({
  recipient: z.string().trim().min(2, "Enter the recipient's name.").max(80),
  line1: z.string().trim().min(3, "Enter a street address.").max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2, "Enter a city.").max(60),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a two-letter state code."),
  postalCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code."),
});

export const redeemInputSchema = z.object({
  rewardId: z.string().min(1),
  variantId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(100),
  expectedCost: z.number().int().positive(),
  details: z
    .object({
      deliveryEmail: z.string().trim().email("Enter a valid email address.").optional(),
      shippingAddress: addressSchema.optional(),
      optionValue: z.string().trim().max(120).optional(),
      preferredTiming: z.string().trim().max(200).optional(),
      note: z.string().trim().max(500).optional(),
    })
    .default({}),
});

export type RedeemInput = z.infer<typeof redeemInputSchema>;

type RedemptionRow = {
  id: string;
  reference: string;
  merchant_id: string;
  reward_id: string;
  variant_id: string;
  reward_name: string;
  variant_label: string;
  reward_image: string;
  category: RewardCategory;
  delivery_method: DeliveryMethod;
  points_cost: number;
  balance_after: number;
  status: RedemptionStatus;
  details: string;
  fulfillment_provider: string;
  fulfillment_note: string | null;
  tracking_info: string | null;
  simulated: number;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
};

function mapRedemption(db: DB, row: RedemptionRow): Redemption {
  const events = db
    .prepare("SELECT * FROM redemption_events WHERE redemption_id = ? ORDER BY created_at, rowid")
    .all(row.id) as { id: string; redemption_id: string; status: RedemptionStatus; note: string | null; actor: string | null; created_at: string }[];
  return {
    id: row.id,
    reference: row.reference,
    merchantId: row.merchant_id,
    rewardId: row.reward_id,
    variantId: row.variant_id,
    rewardName: row.reward_name,
    variantLabel: row.variant_label,
    rewardImage: row.reward_image,
    category: row.category,
    deliveryMethod: row.delivery_method,
    pointsCost: row.points_cost,
    balanceAfter: row.balance_after,
    status: row.status,
    details: JSON.parse(row.details) as RedemptionDetails,
    fulfillmentProvider: row.fulfillment_provider,
    fulfillmentNote: row.fulfillment_note,
    trackingInfo: row.tracking_info,
    simulated: row.simulated === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    events: events.map(
      (e): RedemptionEvent => ({
        id: e.id,
        redemptionId: e.redemption_id,
        status: e.status,
        note: e.note,
        actor: e.actor,
        createdAt: e.created_at,
      }),
    ),
  };
}

function makeReference(db: DB): string {
  for (;;) {
    const ref = `BTR-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!db.prepare("SELECT 1 FROM redemptions WHERE reference = ?").get(ref)) return ref;
  }
}

export function addRedemptionEvent(
  db: DB,
  redemptionId: string,
  status: RedemptionStatus,
  note: string | null,
  actor: string | null,
  at = nowIso(),
) {
  db.prepare(
    "INSERT INTO redemption_events (id, redemption_id, status, note, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(newId("re"), redemptionId, status, note, actor, at);
}

/**
 * Redeems a reward for a merchant. All validation happens here on the server
 * inside one write transaction:
 *  - the reward and option exist, are active, and the client's price matches
 *  - the merchant's tier is eligible and inventory remains
 *  - the spendable balance covers the cost (pending points never count)
 * Points are deducted, inventory is reserved and the claim is created
 * atomically. Re-submitting the same idempotency key returns the original
 * claim instead of charging twice.
 */
export function redeemReward(
  db: DB,
  merchantId: string,
  rawInput: unknown,
  actor: Actor,
): { redemption: Redemption; duplicate: boolean } {
  const parsed = redeemInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new DomainError("invalid_input", parsed.error.issues[0]?.message ?? "Check the form and try again.");
  const input = parsed.data;

  return inWriteTransaction(db, () => {
    const prior = db.prepare("SELECT * FROM redemptions WHERE idempotency_key = ?").get(input.idempotencyKey) as
      | RedemptionRow
      | undefined;
    if (prior) {
      if (prior.merchant_id !== merchantId) throw new DomainError("idempotency_conflict", "This request was already used.");
      return { redemption: mapRedemption(db, prior), duplicate: true };
    }

    const reward = getReward(db, input.rewardId);
    if (!reward) throw new DomainError("reward_unavailable", "This reward is no longer available.");
    const variant = reward.variants.find((v) => v.id === input.variantId);
    if (!variant) throw new DomainError("reward_unavailable", "That option is no longer available. Please choose another.");
    if (variant.pointsCost !== input.expectedCost) {
      throw new DomainError("invalid_input", "The price of this reward changed. Review the new price and try again.");
    }

    const settings = getSettings(db);
    const account = getAccount(db, merchantId);
    const tier = tierFor(account.lifetimeEarned, settings).current.id;
    const availability = availabilityFor(reward, { tier, available: account.available }, variant);
    switch (availability.state) {
      case "inactive":
        throw new DomainError("reward_unavailable", "This reward is no longer available.");
      case "tier_locked":
        throw new DomainError("tier_locked", `This reward unlocks at ${availability.requires} status.`);
      case "out_of_stock":
        throw new DomainError("out_of_stock", "This reward is out of stock right now.");
      case "insufficient":
        throw new DomainError(
          "insufficient_points",
          `You need ${availability.shortBy.toLocaleString()} more available points for this reward.`,
        );
      default:
        break;
    }

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { n } = db
      .prepare(
        "SELECT COUNT(*) AS n FROM redemptions WHERE merchant_id = ? AND created_at >= ? AND status NOT IN ('canceled','failed')",
      )
      .get(merchantId, monthStart.toISOString()) as { n: number };
    if (n >= settings.limits.maxRedemptionsPerMonth) {
      throw new DomainError(
        "limit_reached",
        `You've reached the limit of ${settings.limits.maxRedemptionsPerMonth} rewards per month. It resets on the 1st.`,
      );
    }

    // Delivery details required by the reward's delivery method.
    const details: RedemptionDetails = {};
    if (reward.deliveryMethod === "digital_email") {
      if (!input.details.deliveryEmail) throw new DomainError("invalid_input", "Enter the email address for delivery.");
      details.deliveryEmail = input.details.deliveryEmail;
    }
    if (reward.deliveryMethod === "shipped") {
      if (!input.details.shippingAddress) throw new DomainError("invalid_input", "Enter a shipping address.");
      details.shippingAddress = input.details.shippingAddress;
    }
    if (reward.optionField) {
      const value = input.details.optionValue;
      if (!value || !reward.optionField.choices.includes(value)) {
        throw new DomainError("invalid_input", `Choose ${reward.optionField.label.toLowerCase()}.`);
      }
      details.option = { label: reward.optionField.label, value };
    }
    if (input.details.preferredTiming) details.preferredTiming = input.details.preferredTiming;
    if (input.details.note) details.note = input.details.note;

    if (reward.inventory !== null) {
      const res = db.prepare("UPDATE rewards SET inventory = inventory - 1 WHERE id = ? AND inventory > 0").run(reward.id);
      if (res.changes === 0) throw new DomainError("out_of_stock", "This reward just sold out.");
    }

    const id = newId("rd");
    const reference = makeReference(db);
    const now = nowIso();
    const provider = providerFor(reward.deliveryMethod);

    postEntry(db, {
      merchantId,
      type: "redeem",
      availableDelta: -variant.pointsCost,
      pendingDelta: 0,
      title: `Redeemed: ${reward.name}`,
      detail: variant.label,
      refType: "redemption",
      refId: id,
      idempotencyKey: `redeem:${input.idempotencyKey}`,
      createdBy: actor.id,
      createdAt: now,
    });
    const balanceAfter = getAccount(db, merchantId).available;

    db.prepare(
      `INSERT INTO redemptions (id, reference, merchant_id, reward_id, variant_id, reward_name, variant_label, reward_image, category,
        delivery_method, points_cost, balance_after, status, details, fulfillment_provider, fulfillment_note, tracking_info, simulated,
        idempotency_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, NULL, NULL, ?, ?, ?, ?)`,
    ).run(
      id,
      reference,
      merchantId,
      reward.id,
      variant.id,
      reward.name,
      variant.label,
      reward.image,
      reward.category,
      reward.deliveryMethod,
      variant.pointsCost,
      balanceAfter,
      JSON.stringify(details),
      provider.id,
      provider.live ? 0 : 1,
      input.idempotencyKey,
      now,
      now,
    );
    addRedemptionEvent(db, id, "requested", "Reward requested and points reserved.", actor.name, now);
    writeAudit(db, {
      actor,
      action: "redemption.create",
      entityType: "redemption",
      entityId: id,
      merchantId,
      summary: `Redeemed ${reward.name} (${variant.label}) for ${variant.pointsCost.toLocaleString()} points`,
    });
    return { redemption: mapRedemption(db, db.prepare("SELECT * FROM redemptions WHERE id = ?").get(id) as RedemptionRow), duplicate: false };
  });
}

/** Hands a new claim to its fulfillment provider. Runs after the points transaction commits. */
export async function submitToFulfillment(db: DB, redemptionId: string) {
  const row = db.prepare("SELECT * FROM redemptions WHERE id = ?").get(redemptionId) as RedemptionRow | undefined;
  if (!row) return;
  const redemption = mapRedemption(db, row);
  const provider = providerFor(redemption.deliveryMethod);
  try {
    const { note } = await provider.submit(redemption);
    db.prepare("UPDATE redemptions SET fulfillment_note = ?, updated_at = ? WHERE id = ?").run(note, nowIso(), redemptionId);
  } catch (error) {
    console.error("Fulfillment submission failed", error);
    db.prepare("UPDATE redemptions SET fulfillment_note = ?, updated_at = ? WHERE id = ?").run(
      "Automatic submission failed. Fulfill manually.",
      nowIso(),
      redemptionId,
    );
  }
}

/** Staff-only status change. Canceled and failed claims refund points and restore inventory. */
export function updateRedemptionStatus(
  db: DB,
  redemptionId: string,
  next: RedemptionStatus,
  actor: Actor,
  opts: { note?: string; trackingInfo?: string } = {},
): Redemption {
  return inWriteTransaction(db, () => {
    const row = db.prepare("SELECT * FROM redemptions WHERE id = ?").get(redemptionId) as RedemptionRow | undefined;
    if (!row) throw new DomainError("not_found", "Claim not found.");
    if (!TRANSITIONS[row.status].includes(next)) {
      throw new DomainError("invalid_transition", `A ${STATUS_LABELS[row.status].toLowerCase()} claim cannot move to ${STATUS_LABELS[next].toLowerCase()}.`);
    }
    const refund = next === "canceled" || next === "failed";
    if (refund && !opts.note?.trim()) {
      throw new DomainError("reason_required", "Add a reason so the merchant understands why their points were returned.");
    }
    const now = nowIso();
    if (refund) {
      postEntry(db, {
        merchantId: row.merchant_id,
        type: "refund",
        availableDelta: row.points_cost,
        pendingDelta: 0,
        title: `Points returned: ${row.reward_name}`,
        detail: opts.note ?? null,
        refType: "redemption",
        refId: row.id,
        idempotencyKey: `refund:${row.id}`,
        reason: opts.note ?? null,
        createdBy: actor.id,
        createdAt: now,
      });
      db.prepare("UPDATE rewards SET inventory = inventory + 1 WHERE id = ? AND inventory IS NOT NULL").run(row.reward_id);
    }
    db.prepare(
      "UPDATE redemptions SET status = ?, tracking_info = COALESCE(?, tracking_info), updated_at = ? WHERE id = ?",
    ).run(next, opts.trackingInfo?.trim() || null, now, row.id);
    const defaultNote: Partial<Record<RedemptionStatus, string>> = {
      processing: "Your reward is being prepared.",
      shipped: "Your reward has shipped.",
      fulfilled: "Your reward has been delivered.",
    };
    addRedemptionEvent(
      db,
      row.id,
      next,
      [opts.note?.trim() || defaultNote[next] || null, refund ? `${row.points_cost.toLocaleString()} points returned to your balance.` : null]
        .filter(Boolean)
        .join(" ") || null,
      actor.name,
      now,
    );
    writeAudit(db, {
      actor,
      action: `redemption.${next}`,
      entityType: "redemption",
      entityId: row.id,
      merchantId: row.merchant_id,
      summary: `${row.reference} moved from ${STATUS_LABELS[row.status]} to ${STATUS_LABELS[next]}`,
      reason: opts.note ?? null,
      before: { status: row.status },
      after: { status: next, trackingInfo: opts.trackingInfo ?? null },
    });
    return mapRedemption(db, db.prepare("SELECT * FROM redemptions WHERE id = ?").get(row.id) as RedemptionRow);
  });
}

export function listRedemptions(db: DB, filter: { merchantId?: string; status?: RedemptionStatus | "open" } = {}) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.merchantId) {
    clauses.push("merchant_id = ?");
    params.push(filter.merchantId);
  }
  if (filter.status === "open") clauses.push("status IN ('requested','processing','shipped')");
  else if (filter.status) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM redemptions ${where} ORDER BY created_at DESC`).all(...params) as RedemptionRow[];
  return rows.map((r) => mapRedemption(db, r));
}

/** Fetches a claim. When merchantId is given, claims owned by other merchants are reported as not found. */
export function getRedemption(db: DB, id: string, scope: { merchantId?: string } = {}): Redemption | null {
  const row = db.prepare("SELECT * FROM redemptions WHERE id = ? OR reference = ?").get(id, id) as RedemptionRow | undefined;
  if (!row) return null;
  if (scope.merchantId && row.merchant_id !== scope.merchantId) return null;
  return mapRedemption(db, row);
}
