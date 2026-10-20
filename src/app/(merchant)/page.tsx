import Link from "next/link";
import Image from "next/image";
import { ArrowRight, PackageCheck } from "lucide-react";
import { requireMerchantPage } from "@/lib/auth/session";
import { loadMerchantContext, memberNumber } from "@/lib/data/merchant";
import { listRewards, availabilityFor, minPoints } from "@/lib/domain/rewards";
import { listLedger } from "@/lib/domain/ledger";
import { listRedemptions, STATUS_LABELS } from "@/lib/domain/redemptions";
import { milestoneStatuses } from "@/lib/domain/milestones";
import { isDismissed } from "@/lib/domain/engagement";
import { PointsPanel } from "@/components/rewards/points-panel";
import { RewardCard } from "@/components/rewards/reward-card";
import { ActivityRow } from "@/components/rewards/activity";
import { MilestoneList } from "@/components/rewards/milestones";
import { AnniversaryNotice } from "@/components/rewards/anniversary-notice";
import { Card, SectionHeader, Badge, EmptyState } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";
import AnimatedContent from "@/components/reactbits/AnimatedContent";
import { formatDate, formatPoints } from "@/lib/utils";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const user = await requireMerchantPage();
  const { db, merchant, account, tier, settings, fundedDeals } = loadMerchantContext(user.merchantId);
  const rewards = listRewards(db);
  const ctx = { tier: tier.current.id, available: account.available };
  const withAvailability = rewards.map((r) => ({ reward: r, availability: availabilityFor(r, ctx) }));
  const ledger = listLedger(db, merchant.id);
  const claims = listRedemptions(db, { merchantId: merchant.id });
  const activeClaims = claims.filter((c) => c.status !== "canceled" && c.status !== "failed");
  const milestones = milestoneStatuses(db, merchant, settings);

  // Next step: the most valuable reward the merchant can claim right now,
  // preferring featured rewards. Falls back to the closest one within reach.
  const claimable = withAvailability
    .filter((x) => x.availability.state === "available")
    .sort((a, b) => Number(b.reward.featured) - Number(a.reward.featured) || minPoints(b.reward) - minPoints(a.reward));
  const closest = withAvailability
    .filter((x) => x.availability.state === "insufficient")
    .sort((a, b) => minPoints(a.reward) - minPoints(b.reward))[0];
  const nextStep = claimable[0] ?? closest;

  const featured = withAvailability
    .filter((x) => x.reward.featured && x.reward.id !== nextStep?.reward.id)
    .concat(withAvailability.filter((x) => !x.reward.featured && x.availability.state === "available"))
    .slice(0, 4);

  const anniversary = milestones.find((m) => m.code === "anniversary_1" && m.achievedAt);
  const showAnniversary =
    anniversary &&
    Date.now() - new Date(anniversary.achievedAt!).getTime() < 90 * 86_400_000 &&
    !isDismissed(db, merchant.id, "anniversary_1");

  const pendingFunding = ledger.find((e) => e.type === "earn_pending");

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[32px]">
            Welcome back, {merchant.ownerFirstName}
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-2">
            Your rewards from funding with Big Think Capital, and what you can claim today.
          </p>
        </div>
        <p className="text-xs text-ink-3">
          {merchant.businessName} · Member since {formatDate(merchant.memberSince, "short")}
        </p>
      </header>

      {showAnniversary && (
        <AnniversaryNotice points={anniversary!.pointsAwarded ?? settings.bonuses.anniversary} />
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] [&>*]:min-w-0">
        <PointsPanel
          available={account.available}
          pending={account.pending}
          lifetimeEarned={account.lifetimeEarned}
          redeemed={account.redeemed}
          fundedDeals={fundedDeals}
          rewardsClaimed={activeClaims.length}
          tier={{ id: tier.current.id, name: tier.current.name }}
          nextTier={tier.next ? { name: tier.next.name, pointsToNext: tier.pointsToNext, progress: tier.progress } : null}
          releaseRule={`Spendable after ${settings.release.onTimePaymentsRequired} on-time payments`}
          card={{
            businessName: merchant.businessName,
            memberName: `${merchant.ownerFirstName} ${merchant.ownerLastName}`,
            memberSince: formatDate(merchant.memberSince, "short"),
            memberNumber: memberNumber(merchant.id, merchant.externalRef),
          }}
        />

        {nextStep ? (
          <Card className="flex flex-col overflow-hidden p-0">
            <div className="relative aspect-[16/10] xl:aspect-[4/3]">
              <Image src={nextStep.reward.image} alt="" fill priority sizes="(min-width: 1280px) 300px, 100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" aria-hidden />
              <span className="absolute left-4 top-4">
                <Badge tone={nextStep.availability.state === "available" ? "success" : "brand"} className="bg-[#06140e]/80 backdrop-blur">
                  {nextStep.availability.state === "available" ? "Ready to claim" : "Almost there"}
                </Badge>
              </span>
            </div>
            <div className="flex flex-1 flex-col p-5 pt-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Your next reward</p>
              <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.01em] text-ink">{nextStep.reward.name}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{nextStep.reward.tagline}</p>
              <p className="num mt-4 text-sm text-ink-2">
                {nextStep.availability.state === "available" ? (
                  <>
                    <span className="font-bold text-ink">{formatPoints(minPoints(nextStep.reward))} pts</span> ·{" "}
                    {formatPoints(account.available - minPoints(nextStep.reward))} left after
                  </>
                ) : (
                  <>
                    <span className="font-bold text-ink">
                      {formatPoints(nextStep.availability.state === "insufficient" ? nextStep.availability.shortBy : 0)} pts
                    </span>{" "}
                    to go
                  </>
                )}
              </p>
              <Link href={`/rewards/${nextStep.reward.slug}`} className={buttonClasses("secondary", "md", "mt-4 w-full")}>
                View reward
              </Link>
            </div>
          </Card>
        ) : null}
      </div>

      <section aria-labelledby="picked-heading">
        <SectionHeader
          id="picked-heading"
          title="Picked for you"
          description="Popular rewards, with what you can claim today marked."
          action={
            <Link href="/rewards" className="flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:text-ink">
              Browse all rewards <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        />
        <AnimatedContent distance={24} duration={0.6} stagger={0.06} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 [&>*]:min-w-0">
          {featured.map(({ reward, availability }) => (
            <RewardCard key={reward.id} reward={reward} availability={availability} available={account.available} />
          ))}
        </AnimatedContent>
      </section>

      <AnimatedContent distance={24} duration={0.6} className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="p-5 sm:p-6">
          <SectionHeader
            title="Recent activity"
            description={`Points from funding stay pending until ${settings.release.onTimePaymentsRequired} on-time payments clear.`}
            action={
              <Link href="/activity" className="text-sm font-semibold text-brand-ink hover:text-ink">
                View all
              </Link>
            }
          />
          {ledger.length ? (
            <ul className="-my-1 divide-y divide-line">
              {ledger.slice(0, 5).map((entry) => (
                <ActivityRow key={entry.id} entry={entry} compact />
              ))}
            </ul>
          ) : (
            <EmptyState title="No activity yet" description="Points appear here as soon as your first funding is recorded." />
          )}
          {pendingFunding && (
            <p className="mt-4 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2">
              <span className="font-semibold text-warn">{formatPoints(account.pending)} pts pending</span> from your{" "}
              {formatDate(pendingFunding.createdAt, "short")} renewal. They become spendable after{" "}
              {settings.release.onTimePaymentsRequired} on-time payments, typically about {settings.release.typicalDays} days.
            </p>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <SectionHeader
              title="Your claims"
              action={
                <Link href="/claims" className="text-sm font-semibold text-brand-ink hover:text-ink">
                  History
                </Link>
              }
              className="mb-3"
            />
            {claims.length ? (
              <ul className="space-y-1">
                {claims.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/claims/${c.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2"
                    >
                      <span className="relative h-10 w-12 shrink-0 overflow-hidden rounded-lg">
                        <Image src={c.rewardImage} alt="" fill sizes="48px" className="object-cover" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{c.rewardName}</span>
                        <span className="block text-xs text-ink-3">
                          {formatDate(c.createdAt)} · {formatPoints(c.pointsCost)} pts
                        </span>
                      </span>
                      <Badge tone={c.status === "fulfilled" ? "success" : c.status === "canceled" || c.status === "failed" ? "danger" : "brand"} dot>
                        {STATUS_LABELS[c.status]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<PackageCheck className="h-5 w-5" />}
                title="No claims yet"
                description="Rewards you claim will show up here with their delivery status."
                className="py-8"
              />
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionHeader
              title="Milestones"
              description="We celebrate the big moments with bonus points."
              action={
                <Link href="/benefits#milestones" className="text-sm font-semibold text-brand-ink hover:text-ink">
                  All
                </Link>
              }
              className="mb-2"
            />
            <MilestoneList milestones={milestones.slice(0, 4)} layout="list" />
          </Card>
        </div>
      </AnimatedContent>
    </div>
  );
}
