import Link from "next/link";
import { Check, Crown, Repeat, UserPlus, CalendarHeart } from "lucide-react";
import { requireMerchantPage } from "@/lib/auth/session";
import { loadMerchantContext } from "@/lib/data/merchant";
import { milestoneStatuses } from "@/lib/domain/milestones";
import { Card, PageHeader, SectionHeader, Badge } from "@/components/ui/primitives";
import { MilestoneList } from "@/components/rewards/milestones";
import AnimatedContent from "@/components/reactbits/AnimatedContent";
import { cn, formatPoints } from "@/lib/utils";

export const metadata = { title: "Member benefits" };

export default async function BenefitsPage() {
  const user = await requireMerchantPage();
  const { db, merchant, account, tier, settings } = loadMerchantContext(user.merchantId);
  const tiers = [...settings.tiers].sort((a, b) => a.threshold - b.threshold);
  const currentIndex = tiers.findIndex((t) => t.id === tier.current.id);
  const milestones = milestoneStatuses(db, merchant, settings);

  return (
    <>
      <PageHeader
        eyebrow="Member benefits"
        title={
          <>
            You&apos;re a <span className="text-gold-ink">{tier.current.name}</span> member
          </>
        }
        description="Your tier is based on lifetime points earned, so it never goes down when you redeem. Every tier keeps the perks of the tiers below it."
      />

      <Card className="mb-8 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-ink-3">Lifetime points earned</p>
            <p className="num mt-1 text-3xl font-bold tracking-[-0.02em] text-ink">{formatPoints(account.lifetimeEarned)}</p>
          </div>
          <p className="text-sm text-ink-2">
            {tier.next ? (
              <>
                <span className="num font-semibold text-ink">{formatPoints(tier.pointsToNext)}</span> more to reach{" "}
                <span className="font-semibold text-gold-ink">{tier.next.name}</span>
              </>
            ) : (
              "You've reached our highest tier."
            )}
          </p>
        </div>
        {/* Segmented track across all tiers */}
        <div
          className="mt-5 grid grid-cols-3 gap-1.5"
          role="img"
          aria-label={
            tier.next
              ? `${tier.current.name} tier, ${Math.round(tier.progress * 100)}% of the way to ${tier.next.name}`
              : `${tier.current.name} tier, highest level reached`
          }
        >
          {tiers.map((t, i) => {
            const next = tiers[i + 1];
            const fill =
              i < currentIndex ? 1 : i > currentIndex ? 0 : next ? (account.lifetimeEarned - t.threshold) / (next.threshold - t.threshold) : 1;
            return (
              <div key={t.id}>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#b8934a,#ead29c)]" style={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }} />
                </div>
                <p className="mt-2 flex justify-between text-xs">
                  <span className={cn("font-semibold", i <= currentIndex ? "text-gold-ink" : "text-ink-3")}>{t.name}</span>
                  <span className="num text-ink-3">{formatPoints(t.threshold)}</span>
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <AnimatedContent distance={20} stagger={0.08} className="grid gap-4 md:grid-cols-3">
        {tiers.map((t, i) => {
          const current = i === currentIndex;
          const unlocked = i <= currentIndex;
          return (
            <section
              key={t.id}
              aria-label={`${t.name} tier`}
              className={cn(
                "relative flex flex-col rounded-card border p-6",
                current
                  ? "border-[rgb(216_181_109/0.4)] bg-[linear-gradient(160deg,rgb(216_181_109/0.12),rgb(13_22_40/0.9)_55%)] shadow-[0_30px_60px_-30px_rgb(216_181_109/0.35)]"
                  : "border-line bg-surface/70",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Crown className={cn("h-5 w-5", unlocked ? "text-gold-ink" : "text-ink-3")} aria-hidden />
                  <h2 className="text-lg font-semibold text-ink">{t.name}</h2>
                </div>
                {current ? <Badge tone="gold">Your tier</Badge> : unlocked ? <Badge tone="success">Unlocked</Badge> : null}
              </div>
              <p className="num mt-1.5 text-[13px] text-ink-3">
                {t.threshold === 0 ? "Starting tier" : `${formatPoints(t.threshold)} lifetime points`}
              </p>
              <ul className="mt-5 space-y-2.5">
                {t.benefits.map((b) => (
                  <li key={b} className="flex gap-2.5 text-sm text-ink-2">
                    <Check className={cn("mt-0.5 h-4 w-4 shrink-0", unlocked ? "text-success" : "text-ink-3")} aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>
              {!unlocked && (
                <p className="mt-auto pt-5 text-xs text-ink-3">
                  <span className="num font-semibold text-ink-2">{formatPoints(t.threshold - account.lifetimeEarned)}</span> points to unlock
                </p>
              )}
            </section>
          );
        })}
      </AnimatedContent>

      <section className="mt-12" aria-labelledby="faster-heading">
        <SectionHeader id="faster-heading" title="Ways to level up faster" />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Repeat,
              title: "Renew with us",
              body: `Every funding earns ${settings.earning.pointsPerHundredDollars} points per $100, including every renewal.`,
              href: "/help#contact",
              cta: "Talk to your team",
            },
            {
              icon: UserPlus,
              title: "Refer a business",
              body: `Earn ${formatPoints(settings.bonuses.referralFunded)} bonus points when a business you refer gets funded.`,
              href: "/referrals",
              cta: "Refer a business",
            },
            {
              icon: CalendarHeart,
              title: "Celebrate milestones",
              body: `Anniversaries and funding milestones add bonus points automatically, up to ${formatPoints(settings.bonuses.paidInFull)} at a time.`,
              href: "#milestones",
              cta: "See milestones",
            },
          ].map(({ icon: Icon, title, body, href, cta }) => (
            <Card key={title} className="flex flex-col p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand-ink" aria-hidden>
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-ink">{title}</h3>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-3">{body}</p>
              <Link href={href} className="mt-4 text-sm font-semibold text-brand-ink hover:text-ink">
                {cta} →
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-12 scroll-mt-28" id="milestones" aria-labelledby="milestones-heading">
        <SectionHeader
          id="milestones-heading"
          title="Milestones"
          description="We celebrate the big moments with bonus points. No action is needed on your part."
        />
        <MilestoneList milestones={milestones} />
      </section>
    </>
  );
}
