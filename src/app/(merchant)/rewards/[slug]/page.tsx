import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Truck, Mail, CalendarClock, HandHeart, CreditCard, ShieldCheck } from "lucide-react";
import { requireMerchantPage } from "@/lib/auth/session";
import { loadMerchantContext } from "@/lib/data/merchant";
import { getReward, listRewards, availabilityFor, CATEGORY_LABELS, DELIVERY_LABELS } from "@/lib/domain/rewards";
import { RedeemPanel } from "@/components/rewards/redeem-panel";
import { RewardCard } from "@/components/rewards/reward-card";
import { SectionHeader } from "@/components/ui/primitives";
import type { DeliveryMethod } from "@/lib/domain/types";

const DELIVERY_ICONS: Record<DeliveryMethod, typeof Truck> = {
  digital_email: Mail,
  shipped: Truck,
  scheduled: CalendarClock,
  account_credit: CreditCard,
  donation: HandHeart,
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };
}

export default async function RewardDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireMerchantPage();
  const { db, merchant, account, tier, settings } = loadMerchantContext(user.merchantId);
  const reward = getReward(db, slug);
  if (!reward) notFound();

  const ctx = { tier: tier.current.id, available: account.available };
  const availability = availabilityFor(reward, ctx);
  const DeliveryIcon = DELIVERY_ICONS[reward.deliveryMethod];
  const related = listRewards(db)
    .filter((r) => r.id !== reward.id && r.category === reward.category)
    .concat(listRewards(db).filter((r) => r.id !== reward.id && r.category !== reward.category && r.featured))
    .slice(0, 4);
  const tierNames = Object.fromEntries(settings.tiers.map((t) => [t.id, { name: t.name, threshold: t.threshold }]));

  return (
    <div>
      <Link
        href="/rewards"
        className="mb-6 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-ink-3 transition-colors hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden /> All rewards
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10 xl:gap-14 [&>*]:min-w-0">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] border border-line bg-surface-2 shadow-card">
            <Image src={reward.image} alt={`${reward.name} illustration`} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>

          <div className="mt-8 space-y-8">
            <section aria-labelledby="about-heading">
              <h2 id="about-heading" className="text-[17px] font-semibold text-ink">
                About this reward
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{reward.description}</p>
            </section>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-2xl border border-line bg-surface/60 p-4">
                <DeliveryIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" aria-hidden />
                <div>
                  <dt className="text-xs font-medium text-ink-3">Delivery</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">{DELIVERY_LABELS[reward.deliveryMethod]}</dd>
                  <dd className="text-[13px] text-ink-3">{reward.deliveryEstimate}</dd>
                </div>
              </div>
              <div className="flex gap-3 rounded-2xl border border-line bg-surface/60 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-ink" aria-hidden />
                <div>
                  <dt className="text-xs font-medium text-ink-3">Eligibility</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">
                    {reward.minTier === "silver" ? "All members" : `${tierNames[reward.minTier].name} members and above`}
                  </dd>
                  <dd className="text-[13px] text-ink-3">
                    {reward.inventory === null ? "Always available" : reward.inventory === 0 ? "Currently out of stock" : `${reward.inventory} available`}
                  </dd>
                </div>
              </div>
            </dl>

            <section aria-labelledby="terms-heading">
              <h2 id="terms-heading" className="text-[17px] font-semibold text-ink">
                Terms
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-3">{reward.terms}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-3">
                Points are deducted when you submit a claim. If we can&apos;t fulfill it, the points go straight back to your balance.
                Rewards may be reportable as income; we&apos;ll send any required tax forms.
              </p>
            </section>
          </div>
        </div>

        <div className="lg:sticky lg:top-[100px] lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-ink">{CATEGORY_LABELS[reward.category]}</p>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink">{reward.name}</h1>
          <p className="mt-2 text-[15px] text-ink-2">{reward.tagline}</p>

          <RedeemPanel
            reward={reward}
            availability={availability}
            available={account.available}
            pending={account.pending}
            lifetimeEarned={account.lifetimeEarned}
            requiredTier={tierNames[reward.minTier]}
            releaseRule={`after ${settings.release.onTimePaymentsRequired} on-time payments`}
            defaults={{
              email: merchant.email,
              recipient: `${merchant.ownerFirstName} ${merchant.ownerLastName}`,
              city: merchant.city,
              state: merchant.state,
            }}
          />
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-16">
          <SectionHeader id="related-heading" title="You might also like" />
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 [&>*]:min-w-0">
            {related.map((r) => (
              <li key={r.id}>
                <RewardCard reward={r} availability={availabilityFor(r, ctx)} available={account.available} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
