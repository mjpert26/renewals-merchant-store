import Image from "next/image";
import Link from "next/link";
import { ChevronRight, PackageCheck } from "lucide-react";
import { requireMerchantPage } from "@/lib/auth/session";
import { listRedemptions } from "@/lib/domain/redemptions";
import { loadMerchantContext } from "@/lib/data/merchant";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";
import { ClaimProgress, ClaimStatusBadge } from "@/components/rewards/claim-status";
import { formatDate, formatPoints } from "@/lib/utils";

export const metadata = { title: "Claim history" };

export default async function ClaimsPage() {
  const user = await requireMerchantPage();
  const { db, account } = loadMerchantContext(user.merchantId);
  const claims = listRedemptions(db, { merchantId: user.merchantId });
  const open = claims.filter((c) => ["requested", "processing", "shipped"].includes(c.status));
  const done = claims.filter((c) => !open.includes(c));

  return (
    <>
      <PageHeader
        eyebrow="Claim history"
        title="Your rewards, on their way"
        description="Every reward you've claimed, with where it is now. Select a claim for its receipt and full timeline."
      />
      {claims.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PackageCheck className="h-5 w-5" />}
            title="You haven't claimed a reward yet"
            description="When you do, you'll be able to follow it here from request to delivery."
            action={
              <Link href="/rewards" className={buttonClasses("primary")}>
                Explore rewards
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-10">
          {open.length > 0 && (
            <section aria-labelledby="open-heading">
              <h2 id="open-heading" className="mb-4 text-[17px] font-semibold text-ink">
                In progress
              </h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {open.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/claims/${c.id}`}
                      className="block rounded-card border border-line bg-surface/80 p-5 shadow-card transition-colors hover:border-line-strong"
                    >
                      <div className="flex items-center gap-4">
                        <span className="relative h-14 w-[72px] shrink-0 overflow-hidden rounded-xl">
                          <Image src={c.rewardImage} alt="" fill sizes="72px" className="object-cover" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-ink">{c.rewardName}</p>
                          <p className="text-[13px] text-ink-3">
                            {c.variantLabel} · {formatPoints(c.pointsCost)} pts · {c.reference}
                          </p>
                        </div>
                        <ClaimStatusBadge status={c.status} />
                      </div>
                      <div className="mt-5">
                        <ClaimProgress claim={c} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {done.length > 0 && (
            <section aria-labelledby="done-heading">
              <h2 id="done-heading" className="mb-4 text-[17px] font-semibold text-ink">
                {open.length ? "Completed" : "All claims"}
              </h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">
                  {done.map((c) => (
                    <li key={c.id}>
                      <Link href={`/claims/${c.id}`} className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-2 sm:px-5">
                        <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg">
                          <Image src={c.rewardImage} alt="" fill sizes="64px" className="object-cover" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-ink">{c.rewardName}</p>
                          <p className="truncate text-[13px] text-ink-3">
                            {formatDate(c.createdAt)} · {c.variantLabel} · {c.reference}
                          </p>
                        </div>
                        <p className="num hidden text-sm font-semibold text-ink sm:block">−{formatPoints(c.pointsCost)}</p>
                        <ClaimStatusBadge status={c.status} />
                        <ChevronRight className="hidden h-4 w-4 text-ink-3 sm:block" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {account.available > 0 && (
            <div className="flex flex-col items-start justify-between gap-4 rounded-card border border-line bg-[linear-gradient(110deg,rgb(47_107_255/0.12),transparent_60%)] p-5 sm:flex-row sm:items-center sm:p-6">
              <div>
                <p className="font-semibold text-ink">Ready for your next reward?</p>
                <p className="mt-0.5 text-sm text-ink-2">
                  You have <span className="num font-semibold text-ink">{formatPoints(account.available)} points</span> to spend.
                </p>
              </div>
              <Link href="/rewards" className={buttonClasses("primary")}>
                Explore rewards
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
