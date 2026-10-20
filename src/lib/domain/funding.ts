import { z } from "zod";
import type { DB } from "@/lib/db";
import { inWriteTransaction, newId, nowIso } from "@/lib/db";
import type { FundingEvent, FundingEventStatus, FundingSourceSystem } from "./types";
import { pointsForFunding } from "./settings";
import { getSettings } from "./settings-store";
import { postEntry, ensureAccount } from "./ledger";
import { checkFundingMilestones } from "./milestones";
import { writeAudit, type Actor } from "./audit";
import { DomainError } from "./errors";

/**
 * Normalized funding event accepted from any upstream system (Salesforce, an
 * n8n workflow, a CSV import, or the admin simulator). Mapping from upstream
 * objects and fields to this shape happens in the integration adapter, not here.
 */
export const fundingEventInputSchema = z.object({
  source: z.enum(["salesforce", "n8n", "manual", "simulated"]),
  externalId: z.string().trim().min(1).max(120),
  merchantRef: z.string().trim().min(1).max(120),
  dealType: z.enum(["initial", "renewal"]),
  fundedAmountCents: z.number().int().positive().max(100_000_000_00),
  fundedAt: z.string().datetime({ offset: true }),
});

export type FundingEventInput = z.infer<typeof fundingEventInputSchema>;

type FundingRow = {
  id: string;
  merchant_id: string;
  source: FundingSourceSystem;
  external_id: string;
  deal_type: "initial" | "renewal";
  funded_amount_cents: number;
  funded_at: string;
  points: number;
  status: FundingEventStatus;
  released_at: string | null;
  simulated: number;
  created_at: string;
};

function mapFunding(row: FundingRow): FundingEvent {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    source: row.source,
    externalId: row.external_id,
    dealType: row.deal_type,
    fundedAmountCents: row.funded_amount_cents,
    fundedAt: row.funded_at,
    points: row.points,
    status: row.status,
    releasedAt: row.released_at,
    simulated: row.simulated === 1,
    createdAt: row.created_at,
  };
}

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function resolveMerchantRef(db: DB, ref: string): string | null {
  const row = db.prepare("SELECT id FROM merchants WHERE id = ? OR external_ref = ?").get(ref, ref) as
    | { id: string }
    | undefined;
  return row?.id ?? null;
}

/**
 * Records a funding event and its pending points. Idempotent on
 * (source, externalId): replays of the same event return the original record
 * and never post a second ledger entry.
 */
export function recordFundingEvent(
  db: DB,
  rawInput: unknown,
  opts: { actor?: Actor | null; payload?: unknown; recordedAt?: string } = {},
): { event: FundingEvent; duplicate: boolean } {
  const parsed = fundingEventInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new DomainError("invalid_input", parsed.error.issues[0]?.message ?? "Invalid funding event.");
  const input = parsed.data;

  return inWriteTransaction(db, () => {
    const existing = db
      .prepare("SELECT * FROM funding_events WHERE source = ? AND external_id = ?")
      .get(input.source, input.externalId) as FundingRow | undefined;
    if (existing) return { event: mapFunding(existing), duplicate: true };

    const merchantId = resolveMerchantRef(db, input.merchantRef);
    if (!merchantId) throw new DomainError("not_found", `No merchant matches reference “${input.merchantRef}”.`);
    ensureAccount(db, merchantId);

    const settings = getSettings(db);
    const points = pointsForFunding(input.fundedAmountCents, input.dealType, settings);
    const id = newId("fe");
    const createdAt = opts.recordedAt ?? nowIso();
    db.prepare(
      `INSERT INTO funding_events (id, merchant_id, source, external_id, deal_type, funded_amount_cents, funded_at, points, status,
        released_at, simulated, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?, ?)`,
    ).run(
      id,
      merchantId,
      input.source,
      input.externalId,
      input.dealType,
      input.fundedAmountCents,
      input.fundedAt,
      points,
      input.source === "simulated" ? 1 : 0,
      opts.payload === undefined ? null : JSON.stringify(opts.payload),
      createdAt,
    );
    if (points > 0) {
      postEntry(db, {
        merchantId,
        type: "earn_pending",
        availableDelta: 0,
        pendingDelta: points,
        title: input.dealType === "renewal" ? "Renewal funding" : "Initial funding",
        detail: `${formatUsd(input.fundedAmountCents)} funded`,
        refType: "funding_event",
        refId: id,
        idempotencyKey: `funding:${input.source}:${input.externalId}:earn`,
        createdBy: opts.actor?.id ?? null,
        createdAt: input.fundedAt,
      });
    }
    writeAudit(db, {
      actor: opts.actor ?? null,
      action: "funding.record",
      entityType: "funding_event",
      entityId: id,
      merchantId,
      summary: `Recorded ${input.dealType} funding of ${formatUsd(input.fundedAmountCents)} (${points.toLocaleString()} pending points) from ${input.source}`,
      after: input,
      createdAt: opts.recordedAt,
    });
    const event = mapFunding(db.prepare("SELECT * FROM funding_events WHERE id = ?").get(id) as FundingRow);
    return { event, duplicate: false };
  });
}

/** Releases a funding event's pending points once payment conditions are met. */
export function releaseFundingEvent(db: DB, fundingEventId: string, actor: Actor | null, at?: string) {
  return inWriteTransaction(db, () => {
    const row = db.prepare("SELECT * FROM funding_events WHERE id = ?").get(fundingEventId) as FundingRow | undefined;
    if (!row) throw new DomainError("not_found", "Funding event not found.");
    if (row.status !== "pending") {
      throw new DomainError("invalid_transition", `This funding is already ${row.status}.`);
    }
    const releasedAt = at ?? nowIso();
    if (row.points > 0) {
      postEntry(db, {
        merchantId: row.merchant_id,
        type: "release",
        availableDelta: row.points,
        pendingDelta: -row.points,
        title: "Pending points released",
        detail: `${row.deal_type === "renewal" ? "Renewal" : "Initial"} funding of ${formatUsd(row.funded_amount_cents)}`,
        refType: "funding_event",
        refId: row.id,
        idempotencyKey: `funding:${row.source}:${row.external_id}:release`,
        createdBy: actor?.id ?? null,
        createdAt: releasedAt,
      });
    }
    db.prepare("UPDATE funding_events SET status = 'released', released_at = ? WHERE id = ?").run(releasedAt, row.id);
    checkFundingMilestones(db, row.merchant_id, getSettings(db), releasedAt);
    writeAudit(db, {
      actor,
      action: "funding.release",
      entityType: "funding_event",
      entityId: row.id,
      merchantId: row.merchant_id,
      summary: `Released ${row.points.toLocaleString()} pending points`,
      createdAt: releasedAt,
    });
    return mapFunding(db.prepare("SELECT * FROM funding_events WHERE id = ?").get(row.id) as FundingRow);
  });
}

/** Removes pending points for a funding that did not meet release conditions. */
export function reverseFundingEvent(db: DB, fundingEventId: string, actor: Actor, reason: string) {
  if (!reason.trim()) throw new DomainError("reason_required", "A reason is required to reverse pending points.");
  return inWriteTransaction(db, () => {
    const row = db.prepare("SELECT * FROM funding_events WHERE id = ?").get(fundingEventId) as FundingRow | undefined;
    if (!row) throw new DomainError("not_found", "Funding event not found.");
    if (row.status !== "pending") throw new DomainError("invalid_transition", "Only pending points can be reversed.");
    if (row.points > 0) {
      postEntry(db, {
        merchantId: row.merchant_id,
        type: "pending_reversal",
        availableDelta: 0,
        pendingDelta: -row.points,
        title: "Pending points removed",
        detail: reason,
        refType: "funding_event",
        refId: row.id,
        idempotencyKey: `funding:${row.source}:${row.external_id}:reverse`,
        reason,
        createdBy: actor.id,
      });
    }
    db.prepare("UPDATE funding_events SET status = 'reversed' WHERE id = ?").run(row.id);
    writeAudit(db, {
      actor,
      action: "funding.reverse",
      entityType: "funding_event",
      entityId: row.id,
      merchantId: row.merchant_id,
      summary: `Reversed ${row.points.toLocaleString()} pending points`,
      reason,
    });
  });
}

export function listFundingEvents(db: DB, merchantId: string): FundingEvent[] {
  return (
    db.prepare("SELECT * FROM funding_events WHERE merchant_id = ? ORDER BY funded_at DESC").all(merchantId) as FundingRow[]
  ).map(mapFunding);
}
