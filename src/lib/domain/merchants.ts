import { z } from "zod";
import type { DB } from "@/lib/db";
import { inWriteTransaction, newId } from "@/lib/db";
import type { Merchant, PointAccount } from "./types";
import { getAccount, postEntry } from "./ledger";
import { getSettings } from "./settings-store";
import { tierFor, type TierStatus } from "./settings";
import { writeAudit, type Actor } from "./audit";
import { DomainError } from "./errors";

type MerchantRow = {
  id: string;
  business_name: string;
  owner_first_name: string;
  owner_last_name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  industry: string;
  member_since: string;
  referral_code: string;
  account_manager: string;
  external_ref: string | null;
};

function mapMerchant(row: MerchantRow): Merchant {
  return {
    id: row.id,
    businessName: row.business_name,
    ownerFirstName: row.owner_first_name,
    ownerLastName: row.owner_last_name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    state: row.state,
    industry: row.industry,
    memberSince: row.member_since,
    referralCode: row.referral_code,
    accountManager: row.account_manager,
    externalRef: row.external_ref,
  };
}

export function getMerchant(db: DB, id: string): Merchant | null {
  const row = db.prepare("SELECT * FROM merchants WHERE id = ?").get(id) as MerchantRow | undefined;
  return row ? mapMerchant(row) : null;
}

export interface MerchantSummary {
  merchant: Merchant;
  account: PointAccount;
  tier: TierStatus;
  fundedDeals: number;
  openClaims: number;
}

export function getMerchantSummary(db: DB, merchantId: string): MerchantSummary {
  const merchant = getMerchant(db, merchantId);
  if (!merchant) throw new DomainError("not_found", "Merchant not found.");
  const account = getAccount(db, merchantId);
  const settings = getSettings(db);
  const { deals } = db
    .prepare("SELECT COUNT(*) AS deals FROM funding_events WHERE merchant_id = ? AND status != 'reversed'")
    .get(merchantId) as { deals: number };
  const { open } = db
    .prepare("SELECT COUNT(*) AS open FROM redemptions WHERE merchant_id = ? AND status IN ('requested','processing','shipped')")
    .get(merchantId) as { open: number };
  return { merchant, account, tier: tierFor(account.lifetimeEarned, settings), fundedDeals: deals, openClaims: open };
}

export function searchMerchants(db: DB, query: string): MerchantSummary[] {
  const q = `%${query.trim().toLowerCase()}%`;
  const rows = db
    .prepare(
      `SELECT id FROM merchants
       WHERE ? = '%%' OR lower(business_name) LIKE ? OR lower(owner_first_name || ' ' || owner_last_name) LIKE ?
          OR lower(email) LIKE ? OR lower(COALESCE(external_ref, '')) LIKE ? OR lower(city) LIKE ?
       ORDER BY business_name`,
    )
    .all(q, q, q, q, q, q) as { id: string }[];
  return rows.map((r) => getMerchantSummary(db, r.id));
}

export const adjustmentSchema = z.object({
  merchantId: z.string().min(1),
  direction: z.enum(["credit", "debit"]),
  points: z.coerce.number().int().min(1, "Enter at least 1 point.").max(100_000, "Adjustments above 100,000 points need a database change request."),
  reason: z.string().trim().min(10, "Describe the reason in at least 10 characters.").max(500),
  idempotencyKey: z.string().min(8).max(100),
});

/** Staff point adjustment. Always audited; debits cannot overdraw the spendable balance. */
export function adjustPoints(db: DB, raw: unknown, actor: Actor) {
  const parsed = adjustmentSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError("invalid_input", parsed.error.issues[0]?.message ?? "Check the adjustment.");
  const input = parsed.data;
  return inWriteTransaction(db, () => {
    if (!getMerchant(db, input.merchantId)) throw new DomainError("not_found", "Merchant not found.");
    const before = getAccount(db, input.merchantId);
    const delta = input.direction === "credit" ? input.points : -input.points;
    const { entry, duplicate } = postEntry(db, {
      merchantId: input.merchantId,
      type: "adjustment",
      availableDelta: delta,
      pendingDelta: 0,
      title: input.direction === "credit" ? "Points added by Big Think Capital" : "Points correction",
      detail: input.reason,
      refType: "adjustment",
      refId: null,
      idempotencyKey: `adjust:${input.idempotencyKey}`,
      reason: input.reason,
      createdBy: actor.id,
    });
    if (!duplicate) {
      writeAudit(db, {
        actor,
        action: "points.adjust",
        entityType: "ledger_entry",
        entityId: entry.id,
        merchantId: input.merchantId,
        summary: `${delta > 0 ? "Added" : "Removed"} ${Math.abs(delta).toLocaleString()} points`,
        reason: input.reason,
        before,
        after: getAccount(db, input.merchantId),
      });
    }
    return { entry, duplicate };
  });
}

export function newMerchantId() {
  return newId("mer");
}
