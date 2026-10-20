import type { DB } from "@/lib/db";
import { newId, nowIso } from "@/lib/db";
import type { LedgerEntry, LedgerEntryType, PointAccount } from "./types";
import { DomainError } from "./errors";

export interface PostEntryInput {
  merchantId: string;
  type: LedgerEntryType;
  availableDelta: number;
  pendingDelta: number;
  title: string;
  detail?: string | null;
  refType?: string | null;
  refId?: string | null;
  idempotencyKey: string;
  reason?: string | null;
  createdBy?: string | null;
  createdAt?: string;
}

export interface PostEntryResult {
  entry: LedgerEntry;
  duplicate: boolean;
}

// Which signs each entry type may carry. Anything else is rejected so that,
// for example, a "redeem" can never add points.
const SIGN_RULES: Record<LedgerEntryType, { available: -1 | 0 | 1 | "any"; pending: -1 | 0 | 1 }> = {
  earn_pending: { available: 0, pending: 1 },
  release: { available: 1, pending: -1 },
  pending_reversal: { available: 0, pending: -1 },
  bonus: { available: 1, pending: 0 },
  redeem: { available: -1, pending: 0 },
  refund: { available: 1, pending: 0 },
  adjustment: { available: "any", pending: 0 },
  expiration: { available: -1, pending: 0 },
};

function checkSign(value: number, rule: -1 | 0 | 1 | "any", label: string) {
  if (!Number.isInteger(value)) throw new DomainError("invalid_amount", `${label} must be a whole number of points.`);
  if (rule === "any") {
    if (value === 0) throw new DomainError("invalid_amount", "Adjustment amount cannot be zero.");
    return;
  }
  if (rule === 0 && value !== 0) throw new DomainError("invalid_amount", `${label} must be zero for this entry type.`);
  if (rule === 1 && value <= 0) throw new DomainError("invalid_amount", `${label} must be positive for this entry type.`);
  if (rule === -1 && value >= 0) throw new DomainError("invalid_amount", `${label} must be negative for this entry type.`);
}

type LedgerRow = {
  id: string;
  merchant_id: string;
  type: LedgerEntryType;
  available_delta: number;
  pending_delta: number;
  title: string;
  detail: string | null;
  ref_type: string | null;
  ref_id: string | null;
  idempotency_key: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

export function mapLedgerRow(row: LedgerRow): LedgerEntry {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    type: row.type,
    availableDelta: row.available_delta,
    pendingDelta: row.pending_delta,
    title: row.title,
    detail: row.detail,
    refType: row.ref_type,
    refId: row.ref_id,
    idempotencyKey: row.idempotency_key,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Posts a ledger entry and updates the account projection. Must be called
 * inside a write transaction. Idempotent on idempotencyKey: re-posting the
 * same key returns the original entry and changes nothing.
 */
export function postEntry(db: DB, input: PostEntryInput): PostEntryResult {
  if (!db.inTransaction) throw new Error("postEntry must run inside a write transaction");

  const existing = db
    .prepare("SELECT * FROM ledger_entries WHERE idempotency_key = ?")
    .get(input.idempotencyKey) as LedgerRow | undefined;
  if (existing) {
    if (existing.merchant_id !== input.merchantId) {
      throw new DomainError("idempotency_conflict", "This request key was already used for a different account.");
    }
    return { entry: mapLedgerRow(existing), duplicate: true };
  }

  const rule = SIGN_RULES[input.type];
  checkSign(input.availableDelta, rule.available, "Available change");
  checkSign(input.pendingDelta, rule.pending, "Pending change");

  if (input.type === "adjustment" && !input.reason?.trim()) {
    throw new DomainError("reason_required", "A reason is required for manual adjustments.");
  }

  const account = getAccount(db, input.merchantId);
  if (account.available + input.availableDelta < 0) {
    throw new DomainError("insufficient_points", "Not enough available points for this transaction.");
  }
  if (account.pending + input.pendingDelta < 0) {
    throw new DomainError("insufficient_pending", "Not enough pending points for this transaction.");
  }

  let lifetimeDelta = 0;
  let redeemedDelta = 0;
  switch (input.type) {
    case "release":
    case "bonus":
    case "adjustment":
      lifetimeDelta = input.availableDelta;
      break;
    case "redeem":
      redeemedDelta = -input.availableDelta;
      break;
    case "refund":
      redeemedDelta = -input.availableDelta;
      break;
    default:
      break;
  }
  if (account.redeemed + redeemedDelta < 0) {
    throw new DomainError("invalid_refund", "Refund exceeds the points redeemed on this account.");
  }

  const createdAt = input.createdAt ?? nowIso();
  const entry: LedgerEntry = {
    id: newId("le"),
    merchantId: input.merchantId,
    type: input.type,
    availableDelta: input.availableDelta,
    pendingDelta: input.pendingDelta,
    title: input.title,
    detail: input.detail ?? null,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    idempotencyKey: input.idempotencyKey,
    reason: input.reason ?? null,
    createdBy: input.createdBy ?? null,
    createdAt,
  };

  db.prepare(
    `INSERT INTO ledger_entries (id, merchant_id, type, available_delta, pending_delta, title, detail, ref_type, ref_id,
      idempotency_key, reason, created_by, created_at)
     VALUES (@id, @merchantId, @type, @availableDelta, @pendingDelta, @title, @detail, @refType, @refId,
      @idempotencyKey, @reason, @createdBy, @createdAt)`,
  ).run(entry);

  db.prepare(
    `UPDATE point_accounts
       SET available = available + ?, pending = pending + ?, lifetime_earned = lifetime_earned + ?,
           redeemed = redeemed + ?, updated_at = ?
     WHERE merchant_id = ?`,
  ).run(input.availableDelta, input.pendingDelta, lifetimeDelta, redeemedDelta, nowIso(), input.merchantId);

  return { entry, duplicate: false };
}

export function ensureAccount(db: DB, merchantId: string) {
  db.prepare(
    "INSERT OR IGNORE INTO point_accounts (merchant_id, available, pending, lifetime_earned, redeemed, updated_at) VALUES (?, 0, 0, 0, 0, ?)",
  ).run(merchantId, nowIso());
}

export function getAccount(db: DB, merchantId: string): PointAccount {
  const row = db
    .prepare("SELECT merchant_id, available, pending, lifetime_earned, redeemed FROM point_accounts WHERE merchant_id = ?")
    .get(merchantId) as
    | { merchant_id: string; available: number; pending: number; lifetime_earned: number; redeemed: number }
    | undefined;
  if (!row) throw new DomainError("not_found", "Points account not found.");
  return {
    merchantId: row.merchant_id,
    available: row.available,
    pending: row.pending,
    lifetimeEarned: row.lifetime_earned,
    redeemed: row.redeemed,
  };
}

/** Recomputes balances from the ledger. Used by tests and the admin reconciliation check. */
export function reconcileAccount(db: DB, merchantId: string) {
  const sums = db
    .prepare(
      `SELECT
         COALESCE(SUM(available_delta), 0) AS available,
         COALESCE(SUM(pending_delta), 0) AS pending,
         COALESCE(SUM(CASE WHEN type IN ('release','bonus','adjustment') THEN available_delta ELSE 0 END), 0) AS lifetime,
         COALESCE(SUM(CASE WHEN type IN ('redeem','refund') THEN -available_delta ELSE 0 END), 0) AS redeemed
       FROM ledger_entries WHERE merchant_id = ?`,
    )
    .get(merchantId) as { available: number; pending: number; lifetime: number; redeemed: number };
  const account = getAccount(db, merchantId);
  const ledger = {
    available: sums.available,
    pending: sums.pending,
    lifetimeEarned: sums.lifetime,
    redeemed: sums.redeemed,
  };
  const matches =
    ledger.available === account.available &&
    ledger.pending === account.pending &&
    ledger.lifetimeEarned === account.lifetimeEarned &&
    ledger.redeemed === account.redeemed;
  return { account, ledger, matches };
}

export function listLedger(db: DB, merchantId: string): LedgerEntry[] {
  const rows = db
    .prepare("SELECT * FROM ledger_entries WHERE merchant_id = ? ORDER BY created_at DESC, rowid DESC")
    .all(merchantId) as LedgerRow[];
  return rows.map(mapLedgerRow);
}
