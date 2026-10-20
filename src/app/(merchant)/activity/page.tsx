import { Clock3 } from "lucide-react";
import { requireMerchantPage } from "@/lib/auth/session";
import { loadMerchantContext } from "@/lib/data/merchant";
import { listLedger } from "@/lib/domain/ledger";
import { listFundingEvents } from "@/lib/domain/funding";
import { Card, PageHeader, Stat } from "@/components/ui/primitives";
import { ActivityBrowser } from "@/components/rewards/activity-browser";
import { formatDate, formatPoints, formatUsd } from "@/lib/utils";

export const metadata = { title: "Points activity" };

export default async function ActivityPage() {
  const user = await requireMerchantPage();
  const { db, merchant, account, settings } = loadMerchantContext(user.merchantId);
  const entries = listLedger(db, merchant.id);
  const pendingFundings = listFundingEvents(db, merchant.id).filter((f) => f.status === "pending");

  return (
    <>
      <PageHeader
        eyebrow="Points activity"
        title="Every point, accounted for"
        description="Funding awards, bonuses, redemptions and adjustments, newest first. Pending points become spendable once payment conditions are met."
      />

      <Card className="mb-6 grid grid-cols-2 gap-6 p-5 sm:p-6 md:grid-cols-4">
        <Stat label="Available" value={formatPoints(account.available)} hint="Ready to spend" />
        <Stat label="Pending" value={<span className="text-warn">{formatPoints(account.pending)}</span>} hint="Not yet spendable" />
        <Stat label="Lifetime earned" value={formatPoints(account.lifetimeEarned)} hint="Counts toward your tier" />
        <Stat label="Redeemed" value={formatPoints(account.redeemed)} hint="Spent on rewards" />
      </Card>

      {pendingFundings.length > 0 && (
        <div className="mb-6 space-y-3">
          {pendingFundings.map((f) => {
            const expected = new Date(new Date(f.fundedAt).getTime() + settings.release.typicalDays * 86_400_000).toISOString();
            return (
              <div key={f.id} className="flex flex-col gap-3 rounded-2xl border border-[rgb(242_184_75/0.22)] bg-warn-soft/60 p-4 sm:flex-row sm:items-center">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn-soft text-warn" aria-hidden>
                  <Clock3 className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-ink">
                    <span className="num">{formatPoints(f.points)}</span> points pending from your {formatDate(f.fundedAt)}{" "}
                    {f.dealType} ({formatUsd(f.fundedAmountCents)})
                  </p>
                  <p className="text-ink-2">
                    Released after {settings.release.onTimePaymentsRequired} on-time payments. Expected around{" "}
                    <span className="font-medium text-ink">{formatDate(expected, "long")}</span>.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ActivityBrowser entries={entries} />
    </>
  );
}
