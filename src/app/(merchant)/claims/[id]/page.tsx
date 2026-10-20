import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, LifeBuoy } from "lucide-react";
import { requireMerchantPage } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getRedemption } from "@/lib/domain/redemptions";
import { DELIVERY_LABELS } from "@/lib/domain/rewards";
import { Card, Notice } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";
import { ClaimProgress, ClaimStatusBadge, ClaimTimeline } from "@/components/rewards/claim-status";
import { PrintButton } from "@/components/rewards/print-button";
import { formatDateTime, formatPoints } from "@/lib/utils";

export const metadata = { title: "Claim receipt" };

export default async function ClaimDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireMerchantPage();
  // Scoped lookup: another merchant's claim is indistinguishable from a missing one.
  const claim = getRedemption(getDb(), id, { merchantId: user.merchantId });
  if (!claim) notFound();
  const justCreated = sp.new === "1";
  const d = claim.details;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/claims" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Claim history
      </Link>

      {justCreated && (
        <div className="mb-6 animate-fade-up overflow-hidden rounded-[22px] border border-[rgb(60_207_145/0.25)] bg-[linear-gradient(120deg,rgb(60_207_145/0.14),rgb(47_107_255/0.06))] p-6 text-center sm:p-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success text-[#04150d] shadow-[0_0_0_8px_rgb(60_207_145/0.15)]" aria-hidden>
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-ink">Your reward is on its way</h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-2">
            We&apos;ve received your claim and reserved your points. You&apos;ll get updates by email as it moves along.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/rewards" className={buttonClasses("secondary")}>
              Keep browsing
            </Link>
            <Link href="/" className={buttonClasses("ghost")}>
              Back to overview
            </Link>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-line p-5 sm:flex-row sm:items-center sm:p-6">
          <span className="relative h-24 w-32 shrink-0 overflow-hidden rounded-2xl">
            <Image src={claim.rewardImage} alt="" fill sizes="128px" className="object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">Receipt · {claim.reference}</p>
            {justCreated ? (
              <h2 className="mt-1 text-xl font-semibold text-ink">{claim.rewardName}</h2>
            ) : (
              <h1 className="mt-1 text-xl font-semibold text-ink">{claim.rewardName}</h1>
            )}
            <p className="text-sm text-ink-3">
              {claim.variantLabel}
              {d.option ? ` · ${d.option.label}: ${d.option.value}` : ""}
            </p>
          </div>
          <ClaimStatusBadge status={claim.status} />
        </div>

        <div className="border-b border-line p-5 sm:p-6">
          <ClaimProgress claim={claim} />
          {claim.trackingInfo && (
            <p className="mt-5 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
              Tracking: <span className="font-mono text-ink">{claim.trackingInfo}</span>
            </p>
          )}
        </div>

        <div className="grid gap-8 p-5 sm:p-6 md:grid-cols-2">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-ink-3">Requested</dt>
              <dd className="mt-0.5 text-ink">{formatDateTime(claim.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-3">Delivery</dt>
              <dd className="mt-0.5 text-ink">{DELIVERY_LABELS[claim.deliveryMethod]}</dd>
              {d.deliveryEmail && <dd className="text-ink-2">{d.deliveryEmail}</dd>}
              {d.shippingAddress && (
                <dd className="text-ink-2">
                  {d.shippingAddress.recipient}
                  <br />
                  {d.shippingAddress.line1}
                  {d.shippingAddress.line2 ? `, ${d.shippingAddress.line2}` : ""}
                  <br />
                  {d.shippingAddress.city}, {d.shippingAddress.state} {d.shippingAddress.postalCode}
                </dd>
              )}
              {d.preferredTiming && <dd className="text-ink-2">Preferred timing: {d.preferredTiming}</dd>}
              {d.note && <dd className="text-ink-2">Note: {d.note}</dd>}
            </div>
            <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
              <div className="flex justify-between">
                <dt className="text-ink-3">Points spent</dt>
                <dd className="num font-semibold text-ink">{formatPoints(claim.pointsCost)}</dd>
              </div>
              <div className="mt-2 flex justify-between">
                <dt className="text-ink-3">Balance after claim</dt>
                <dd className="num font-semibold text-ink">{formatPoints(claim.balanceAfter)}</dd>
              </div>
            </div>
          </dl>
          <div>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">Timeline</h2>
            <ClaimTimeline claim={claim} />
          </div>
        </div>
      </Card>

      {claim.simulated && (
        <Notice tone="brand" className="mt-5">
          Demo environment: this claim is fulfilled by Big Think Capital staff from the admin queue. No real order or gift card is
          created.
        </Notice>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/help#contact" className="inline-flex items-center gap-2 text-sm font-medium text-brand-ink hover:text-ink">
          <LifeBuoy className="h-4 w-4" aria-hidden /> Questions about this claim?
        </Link>
        <PrintButton />
      </div>
    </div>
  );
}
