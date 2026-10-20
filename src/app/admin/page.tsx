import Link from "next/link";
import { CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { programMetrics, merchantNames } from "@/lib/data/admin";
import { listRedemptions } from "@/lib/domain/redemptions";
import { listAudit } from "@/lib/domain/audit";
import { Card, PageHeader, SectionHeader, Stat, Notice, EmptyState } from "@/components/ui/primitives";
import { ClaimStatusBadge } from "@/components/rewards/claim-status";
import { RunJobsButton } from "@/components/admin/run-jobs-button";
import { formatPoints, relativeDays, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const user = await requireAdminPage();
  const db = getDb();
  const m = programMetrics();
  const names = merchantNames();
  const queue = listRedemptions(db, { status: "open" }).slice(0, 6);
  const audit = listAudit(db, { limit: 8 });

  return (
    <>
      <PageHeader
        eyebrow="Rewards admin"
        title={`Good to see you, ${user.name.split(" ")[0]}`}
        description="Program health, the fulfillment queue and recent changes."
        action={<RunJobsButton />}
      />

      <Card className="mb-6 grid grid-cols-2 gap-6 p-5 sm:p-6 lg:grid-cols-5">
        <Stat label="Claims to fulfill" value={<span className={m.openClaimsTotal ? "text-warn" : undefined}>{m.openClaimsTotal}</span>} hint="Requested, preparing or shipped" />
        <Stat label="Spendable points outstanding" value={formatPoints(m.available)} hint={`Across ${m.merchants} merchants`} />
        <Stat label="Pending points" value={formatPoints(m.pending)} hint={`${m.pendingFundings} fundings awaiting release`} />
        <Stat label="Redeemed, last 30 days" value={formatPoints(m.points30d)} hint={`${m.redemptions30d} claims`} />
        <Stat label="Lifetime points issued" value={formatPoints(m.lifetime)} />
      </Card>

      <div className="mb-8">
        {m.reconciliation.mismatched.length === 0 ? (
          <Notice tone="success" icon={<CheckCircle2 className="h-4 w-4" />} title="Ledger reconciled">
            All {m.reconciliation.checked} merchant balances match their transaction history.
          </Notice>
        ) : (
          <Notice tone="danger" icon={<AlertTriangle className="h-4 w-4" />} title="Balance mismatch detected">
            {m.reconciliation.mismatched.length} account(s) don&apos;t match the ledger: {m.reconciliation.mismatched.join(", ")}. Pause
            adjustments and escalate to engineering.
          </Notice>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="p-5 sm:p-6">
          <SectionHeader
            title="Fulfillment queue"
            description="Oldest first is fairest. Every claim already has its points reserved."
            action={
              <Link href="/admin/claims" className="flex items-center gap-1 text-sm font-semibold text-brand-ink hover:text-ink">
                Open queue <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
          {queue.length ? (
            <ul className="-my-1 divide-y divide-line">
              {queue.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/claims?claim=${c.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {c.rewardName} <span className="font-normal text-ink-3">· {c.variantLabel}</span>
                      </p>
                      <p className="truncate text-xs text-ink-3">
                        {names[c.merchantId]} · {c.reference} · {relativeDays(c.createdAt)}
                      </p>
                    </div>
                    <ClaimStatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Queue is clear" description="New claims will appear here as merchants redeem." className="py-8" />
          )}
        </Card>

        <div className="space-y-6">
          <Card className="grid grid-cols-2 gap-4 p-5 sm:p-6">
            <Link href="/admin/referrals" className="rounded-2xl border border-line bg-surface-2/40 p-4 hover:border-line-strong">
              <p className="text-xs text-ink-3">Referrals to review</p>
              <p className="num mt-1 text-2xl font-semibold text-ink">{m.openReferrals}</p>
            </Link>
            <Link href="/admin/referrals#callbacks" className="rounded-2xl border border-line bg-surface-2/40 p-4 hover:border-line-strong">
              <p className="text-xs text-ink-3">Callback requests</p>
              <p className="num mt-1 text-2xl font-semibold text-ink">{m.openCallbacks}</p>
            </Link>
          </Card>
          <Card className="p-5 sm:p-6">
            <SectionHeader
              title="Recent changes"
              action={
                <Link href="/admin/audit" className="text-sm font-semibold text-brand-ink hover:text-ink">
                  Audit log
                </Link>
              }
              className="mb-3"
            />
            <ul className="space-y-3">
              {audit.map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="text-ink-2">{a.summary}</p>
                  <p className="text-xs text-ink-3">
                    {a.actorName ?? "System"} · {formatDateTime(a.createdAt)}
                    {a.merchantId && names[a.merchantId] ? ` · ${names[a.merchantId]}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
