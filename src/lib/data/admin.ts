import "server-only";
import { getDb } from "@/lib/db";
import { reconcileAccount } from "@/lib/domain/ledger";

export function programMetrics() {
  const db = getDb();
  const totals = db
    .prepare(
      "SELECT COUNT(*) AS merchants, COALESCE(SUM(available),0) AS available, COALESCE(SUM(pending),0) AS pending, COALESCE(SUM(lifetime_earned),0) AS lifetime, COALESCE(SUM(redeemed),0) AS redeemed FROM point_accounts",
    )
    .get() as { merchants: number; available: number; pending: number; lifetime: number; redeemed: number };
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const recent = db
    .prepare(
      "SELECT COUNT(*) AS n, COALESCE(SUM(points_cost),0) AS points FROM redemptions WHERE created_at >= ? AND status NOT IN ('canceled','failed')",
    )
    .get(since) as { n: number; points: number };
  const open = db
    .prepare("SELECT status, COUNT(*) AS n FROM redemptions WHERE status IN ('requested','processing','shipped') GROUP BY status")
    .all() as { status: string; n: number }[];
  const pendingFundings = (db.prepare("SELECT COUNT(*) AS n FROM funding_events WHERE status = 'pending'").get() as { n: number }).n;
  const openCallbacks = (db.prepare("SELECT COUNT(*) AS n FROM support_requests WHERE status = 'open'").get() as { n: number }).n;
  const openReferrals = (
    db.prepare("SELECT COUNT(*) AS n FROM referrals WHERE status IN ('submitted','in_review')").get() as { n: number }
  ).n;
  const merchantIds = (db.prepare("SELECT merchant_id FROM point_accounts").all() as { merchant_id: string }[]).map((r) => r.merchant_id);
  const mismatched = merchantIds.filter((id) => !reconcileAccount(db, id).matches);
  return {
    ...totals,
    redemptions30d: recent.n,
    points30d: recent.points,
    openClaims: Object.fromEntries(open.map((o) => [o.status, o.n])) as Record<string, number>,
    openClaimsTotal: open.reduce((a, b) => a + b.n, 0),
    pendingFundings,
    openCallbacks,
    openReferrals,
    reconciliation: { checked: merchantIds.length, mismatched },
  };
}

export function merchantNames(): Record<string, string> {
  const rows = getDb().prepare("SELECT id, business_name FROM merchants").all() as { id: string; business_name: string }[];
  return Object.fromEntries(rows.map((r) => [r.id, r.business_name]));
}
