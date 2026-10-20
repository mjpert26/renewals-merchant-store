import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getMerchant, getMerchantSummary } from "@/lib/domain/merchants";
import { listLedger, reconcileAccount } from "@/lib/domain/ledger";
import { listFundingEvents } from "@/lib/domain/funding";
import { listRedemptions } from "@/lib/domain/redemptions";
import { listReferrals, REFERRAL_STATUS_LABELS } from "@/lib/domain/engagement";
import { listAudit } from "@/lib/domain/audit";
import { Card, PageHeader, SectionHeader, Stat, Badge, EmptyState } from "@/components/ui/primitives";
import { DataTable, Th, Td } from "@/components/admin/table";
import { ENTRY_META } from "@/components/rewards/activity";
import { ClaimStatusBadge } from "@/components/rewards/claim-status";
import { AdjustPointsDialog, SimulateFundingDialog, FundingActions } from "@/components/admin/merchant-actions";
import { isDemoMode } from "@/lib/env";
import { cn, formatDate, formatDateTime, formatPoints, formatUsd } from "@/lib/utils";

export const metadata = { title: "Merchant" };

export default async function AdminMerchantPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const db = getDb();
  const merchant = getMerchant(db, id);
  if (!merchant) notFound();
  const { account, tier, fundedDeals } = getMerchantSummary(db, id);
  const ledger = listLedger(db, id);
  const fundings = listFundingEvents(db, id);
  const claims = listRedemptions(db, { merchantId: id });
  const referrals = listReferrals(db, id);
  const audit = listAudit(db, { merchantId: id, limit: 20 });
  const recon = reconcileAccount(db, id);

  return (
    <>
      <Link href="/admin/merchants" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Merchants
      </Link>
      <PageHeader
        eyebrow={`${merchant.industry} · ${merchant.city}, ${merchant.state}`}
        title={merchant.businessName}
        description={
          <>
            {merchant.ownerFirstName} {merchant.ownerLastName} · {merchant.email} · {merchant.phone} · Ref {merchant.externalRef} · Account
            manager {merchant.accountManager}
          </>
        }
        action={
          <div className="flex flex-wrap gap-2">
            {isDemoMode() && <SimulateFundingDialog merchantId={merchant.id} businessName={merchant.businessName} />}
            <AdjustPointsDialog merchantId={merchant.id} businessName={merchant.businessName} available={account.available} />
          </div>
        }
      />

      <Card className="mb-4 grid grid-cols-2 gap-6 p-5 sm:p-6 lg:grid-cols-5">
        <Stat label="Available" value={formatPoints(account.available)} />
        <Stat label="Pending" value={<span className="text-warn">{formatPoints(account.pending)}</span>} />
        <Stat label="Lifetime earned" value={formatPoints(account.lifetimeEarned)} hint={`${fundedDeals} funded deals`} />
        <Stat label="Redeemed" value={formatPoints(account.redeemed)} />
        <Stat
          label="Tier"
          value={<span className="text-gold-ink">{tier.current.name}</span>}
          hint={tier.next ? `${formatPoints(tier.pointsToNext)} to ${tier.next.name}` : "Top tier"}
        />
      </Card>
      <p className={cn("mb-8 flex items-center gap-2 text-xs", recon.matches ? "text-success" : "text-danger")}>
        {recon.matches ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
        {recon.matches
          ? `Balances reconcile with ${ledger.length} ledger entries.`
          : "Balances do not match the ledger. Do not adjust this account until engineering investigates."}
      </p>

      <section className="mb-10" aria-labelledby="fundings-heading">
        <SectionHeader
          id="fundings-heading"
          title="Funding events"
          description="Each event is keyed by its source system and external ID, so re-imports never double-award points."
        />
        <DataTable label="Funding events">
          <thead>
            <tr>
              <Th>Funded</Th>
              <Th>Deal</Th>
              <Th>Source · External ID</Th>
              <Th className="text-right">Amount</Th>
              <Th className="text-right">Points</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {fundings.map((f) => (
              <tr key={f.id}>
                <Td>{formatDate(f.fundedAt)}</Td>
                <Td className="capitalize">{f.dealType}</Td>
                <Td>
                  <span className="font-mono text-xs">
                    {f.source} · {f.externalId}
                  </span>
                  {f.simulated && <Badge className="ml-2">Simulated</Badge>}
                </Td>
                <Td className="num text-right">{formatUsd(f.fundedAmountCents)}</Td>
                <Td className="num text-right font-semibold text-ink">{formatPoints(f.points)}</Td>
                <Td>
                  <Badge tone={f.status === "released" ? "success" : f.status === "pending" ? "warn" : "neutral"} dot>
                    {f.status === "released" ? `Released ${f.releasedAt ? formatDate(f.releasedAt) : ""}` : f.status === "pending" ? "Pending" : "Reversed"}
                  </Badge>
                </Td>
                <Td className="text-right">{f.status === "pending" && <FundingActions fundingEventId={f.id} points={f.points} />}</Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </section>

      <div className="space-y-6">
        <section aria-labelledby="ledger-heading">
          <SectionHeader id="ledger-heading" title="Ledger" description="Every balance change, newest first." />
          <DataTable label="Ledger entries">
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Entry</Th>
                <Th>Type</Th>
                <Th className="text-right">Available</Th>
                <Th className="text-right">Pending</Th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap">{formatDate(e.createdAt)}</Td>
                  <Td>
                    <p className="text-ink">{e.title}</p>
                    {(e.detail || e.reason) && <p className="text-xs text-ink-3">{e.reason ?? e.detail}</p>}
                  </Td>
                  <Td>
                    <Badge tone={ENTRY_META[e.type].tone}>{ENTRY_META[e.type].label}</Badge>
                  </Td>
                  <Td className={cn("num text-right", e.availableDelta > 0 ? "text-success" : e.availableDelta < 0 ? "text-ink" : "text-ink-3")}>
                    {e.availableDelta ? `${e.availableDelta > 0 ? "+" : "−"}${formatPoints(e.availableDelta)}` : "—"}
                  </Td>
                  <Td className={cn("num text-right", e.pendingDelta ? "text-warn" : "text-ink-3")}>
                    {e.pendingDelta ? `${e.pendingDelta > 0 ? "+" : "−"}${formatPoints(e.pendingDelta)}` : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
          <Card className="p-5">
            <SectionHeader title="Claims" className="mb-3" />
            {claims.length ? (
              <ul className="divide-y divide-line">
                {claims.map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/claims?tab=all&claim=${c.id}`} className="flex items-center gap-3 py-3 hover:text-ink">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{c.rewardName}</p>
                        <p className="text-xs text-ink-3">
                          {formatDate(c.createdAt)} · {formatPoints(c.pointsCost)} pts · {c.reference}
                        </p>
                      </div>
                      <ClaimStatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No claims" className="py-6" />
            )}
          </Card>
          <Card className="p-5">
            <SectionHeader title="Referrals" className="mb-3" />
            {referrals.length ? (
              <ul className="divide-y divide-line">
                {referrals.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0 truncate text-ink">{r.businessName}</span>
                    <Badge tone={r.status === "funded" ? "success" : "neutral"}>{REFERRAL_STATUS_LABELS[r.status]}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No referrals" className="py-6" />
            )}
          </Card>
          <Card className="p-5">
            <SectionHeader
              title="Audit trail"
              action={
                <Link href={`/admin/audit?merchant=${merchant.id}`} className="text-sm font-semibold text-brand-ink hover:text-ink">
                  All
                </Link>
              }
              className="mb-3"
            />
            <ul className="space-y-3">
              {audit.slice(0, 8).map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="text-ink-2">{a.summary}</p>
                  {a.reason && <p className="text-xs text-ink-3">Reason: {a.reason}</p>}
                  <p className="text-xs text-ink-3">
                    {a.actorName ?? "System"} · {formatDateTime(a.createdAt)}
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
