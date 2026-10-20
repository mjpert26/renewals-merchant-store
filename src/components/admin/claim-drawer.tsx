"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Dialog as RadixDialog } from "radix-ui";
import { toast } from "sonner";
import type { Redemption, RedemptionStatus } from "@/lib/domain/types";
import { STATUS_LABELS } from "@/lib/domain/status-labels";
import { DELIVERY_LABELS } from "@/lib/domain/catalog-helpers";
import { updateClaimStatusAction } from "@/app/actions/admin";
import { SheetContent } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/primitives";
import { ClaimStatusBadge, ClaimTimeline } from "@/components/rewards/claim-status";
import { formatDateTime, formatPoints } from "@/lib/utils";

const ACTION_LABELS: Partial<Record<RedemptionStatus, string>> = {
  processing: "Mark preparing",
  shipped: "Mark shipped",
  fulfilled: "Mark delivered",
  canceled: "Cancel and refund",
  failed: "Mark failed and refund",
};

export function ClaimDrawer({
  claim,
  merchantName,
  transitions,
  closeHref,
}: {
  claim: Redemption;
  merchantName: string;
  transitions: RedemptionStatus[];
  closeHref: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState(claim.trackingInfo ?? "");
  const [refundMode, setRefundMode] = useState<RedemptionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const forward = transitions.filter((t) => t !== "canceled" && t !== "failed");
  const backward = transitions.filter((t) => t === "canceled" || t === "failed");
  const d = claim.details;

  function apply(status: RedemptionStatus) {
    setError(null);
    start(async () => {
      const result = await updateClaimStatusAction({
        redemptionId: claim.id,
        status,
        note: note.trim() || undefined,
        trackingInfo: status === "shipped" ? tracking.trim() || undefined : undefined,
      });
      if (result.ok) {
        toast.success(`${claim.reference} marked ${STATUS_LABELS[status].toLowerCase()}`);
        setNote("");
        setRefundMode(null);
        router.refresh();
      } else setError(result.error);
    });
  }

  return (
    <RadixDialog.Root open onOpenChange={(open) => !open && router.push(closeHref, { scroll: false })}>
      <SheetContent title={`${claim.rewardName}`} description={`${claim.reference} · ${merchantName}`}>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl">
              <Image src={claim.rewardImage} alt="" fill sizes="80px" className="object-cover" />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-ink">{claim.variantLabel}</p>
              {d.option && (
                <p className="text-ink-2">
                  {d.option.label}: <span className="font-semibold text-ink">{d.option.value}</span>
                </p>
              )}
              <p className="num text-ink-3">{formatPoints(claim.pointsCost)} points reserved</p>
            </div>
            <ClaimStatusBadge status={claim.status} />
          </div>

          <dl className="grid gap-4 rounded-2xl border border-line bg-surface-2/40 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-3">Requested</dt>
              <dd className="text-ink">{formatDateTime(claim.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Fulfillment</dt>
              <dd className="text-ink">{claim.simulated ? "Manual queue (demo)" : claim.fulfillmentProvider}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-ink-3">{DELIVERY_LABELS[claim.deliveryMethod]}</dt>
              <dd className="text-ink">
                {d.deliveryEmail ??
                  (d.shippingAddress
                    ? `${d.shippingAddress.recipient}, ${d.shippingAddress.line1}${d.shippingAddress.line2 ? `, ${d.shippingAddress.line2}` : ""}, ${d.shippingAddress.city}, ${d.shippingAddress.state} ${d.shippingAddress.postalCode}`
                    : "Contact the merchant to arrange")}
              </dd>
              {d.preferredTiming && <dd className="text-ink-2">Preferred timing: {d.preferredTiming}</dd>}
              {d.note && <dd className="text-ink-2">Merchant note: {d.note}</dd>}
            </div>
            {claim.trackingInfo && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-ink-3">Tracking</dt>
                <dd className="font-mono text-ink">{claim.trackingInfo}</dd>
              </div>
            )}
          </dl>

          {transitions.length > 0 ? (
            <section aria-labelledby="claim-actions" className="space-y-4">
              <h3 id="claim-actions" className="text-sm font-semibold text-ink">
                Update status
              </h3>
              {error && <Notice tone="danger">{error}</Notice>}
              {refundMode ? (
                <div className="space-y-3 rounded-2xl border border-[rgb(244_113_116/0.3)] bg-danger-soft/50 p-4">
                  <p className="text-sm text-ink-2">
                    This returns <span className="num font-semibold text-ink">{formatPoints(claim.pointsCost)} points</span> to the merchant and
                    restocks the reward. The merchant sees your reason.
                  </p>
                  <Field label="Reason (required)" htmlFor="refund-reason">
                    <Textarea id="refund-reason" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="e.g. Size out of stock; merchant asked to cancel." />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="danger" loading={pending} disabled={note.trim().length < 5} onClick={() => apply(refundMode)}>
                      {ACTION_LABELS[refundMode]}
                    </Button>
                    <Button variant="ghost" onClick={() => setRefundMode(null)} disabled={pending}>
                      Keep claim
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {forward.includes("shipped") && (
                    <Field label="Tracking number" htmlFor="tracking" optional hint="Shown to the merchant on their receipt.">
                      <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Carrier and tracking number" />
                    </Field>
                  )}
                  <Field label="Note to merchant" htmlFor="claim-note" optional hint="Added to the claim timeline.">
                    <Input id="claim-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Code sent to the email on file" />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {forward.map((t) => (
                      <Button key={t} variant={t === "fulfilled" ? "primary" : "secondary"} loading={pending} onClick={() => apply(t)}>
                        {ACTION_LABELS[t]}
                      </Button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                    {backward.map((t) => (
                      <Button key={t} variant="danger" size="sm" onClick={() => setRefundMode(t)}>
                        {ACTION_LABELS[t]}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </section>
          ) : (
            <Notice tone="brand">This claim is closed. No further changes can be made.</Notice>
          )}

          <section aria-labelledby="claim-history">
            <h3 id="claim-history" className="mb-4 text-sm font-semibold text-ink">
              History
            </h3>
            <ClaimTimeline claim={claim} />
          </section>
        </div>
      </SheetContent>
    </RadixDialog.Root>
  );
}
