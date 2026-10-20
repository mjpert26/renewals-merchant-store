"use client";

import Link from "next/link";
import { ArrowRight, Clock3, Info } from "lucide-react";
import { DarkVeil } from "@/components/reactbits/DarkVeil";
import Counter from "@/components/reactbits/Counter";
import { MembershipCard } from "@/components/reactbits/MembershipCard";
import { buttonClasses } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import type { TierId } from "@/lib/domain/types";
import { formatPoints } from "@/lib/utils";

export interface PointsPanelProps {
  available: number;
  pending: number;
  lifetimeEarned: number;
  redeemed: number;
  fundedDeals: number;
  rewardsClaimed: number;
  tier: { id: TierId; name: string };
  nextTier: { name: string; pointsToNext: number; progress: number } | null;
  releaseRule: string;
  card: { businessName: string; memberName: string; memberSince: string; memberNumber: string };
}

export function PointsPanel(props: PointsPanelProps) {
  const { available, pending, lifetimeEarned, redeemed, fundedDeals, rewardsClaimed, tier, nextTier, releaseRule, card } = props;
  return (
    <section
      aria-labelledby="points-heading"
      className="relative isolate overflow-hidden rounded-[24px] border border-[rgb(120_150_220/0.18)] bg-[linear-gradient(160deg,#0f1b36_0%,#0a1328_55%,#08101f_100%)] shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.06)]"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 isolate opacity-50" aria-hidden>
        <DarkVeil color="#2f6bff" speed={0.18} brightness={0.32} glow={0.15} grain={0.02} mouseInteraction={false} quality={0.45} />
        {/* Tints the veil's luminance into the brand blue so it never reads as grey. */}
        <div className="absolute inset-0 bg-[#2457e6] mix-blend-color" />
      </div>
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_85%_at_88%_18%,rgb(47_107_255/0.28),transparent_70%),linear-gradient(90deg,#0a1328_0%,rgb(10_19_40/0.85)_45%,rgb(10_19_40/0.5)_100%)]"
        aria-hidden
      />

      <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)] md:items-center lg:p-9">
        <div className="min-w-0">
          <p id="points-heading" className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
            Available points
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">Ready to spend</span>
          </p>
          <div className="mt-3 text-ink">
            <Counter
              value={available}
              fontSize="clamp(52px, 8vw, 76px)"
              fontWeight={700}
              textColor="#f3f6fd"
              className="tracking-[-0.04em]"
              stagger={0.03}
              duration={0.9}
            />
          </div>
          <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-white/[0.08] pt-5">
            <div className="min-w-0">
              <dt className="flex items-center gap-1 text-xs font-medium text-ink-3">
                <Clock3 className="h-3.5 w-3.5" aria-hidden /> Pending
              </dt>
              <dd className="num mt-1 text-lg font-semibold text-warn sm:text-xl">{formatPoints(pending)}</dd>
              <dd className="mt-0.5 text-[11px] leading-snug text-ink-3">{releaseRule}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-ink-3">Lifetime earned</dt>
              <dd className="num mt-1 text-lg font-semibold text-ink sm:text-xl">{formatPoints(lifetimeEarned)}</dd>
              <dd className="mt-0.5 text-[11px] text-ink-3">
                {fundedDeals} funded deal{fundedDeals === 1 ? "" : "s"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-ink-3">Redeemed</dt>
              <dd className="num mt-1 text-lg font-semibold text-ink sm:text-xl">{formatPoints(redeemed)}</dd>
              <dd className="mt-0.5 text-[11px] text-ink-3">
                {rewardsClaimed} reward{rewardsClaimed === 1 ? "" : "s"} claimed
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            {nextTier ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-gold-ink">{tier.name}</span>
                  <span className="text-ink-3">
                    <span className="num font-semibold text-ink-2">{formatPoints(nextTier.pointsToNext)}</span> pts to {nextTier.name}
                  </span>
                </div>
                <Progress value={nextTier.progress} tone="gold" label={`Progress to ${nextTier.name} status`} />
              </>
            ) : (
              <p className="text-xs text-gold-ink">You&apos;ve reached our highest tier. Thank you for your loyalty.</p>
            )}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/rewards" className={buttonClasses("primary", "lg")}>
              Explore rewards <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/help#how-it-works" className={buttonClasses("ghost", "lg", "px-3")}>
              <Info className="h-4 w-4" aria-hidden /> How points work
            </Link>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[340px] md:max-w-none">
          <MembershipCard tier={tier.id} {...card} />
        </div>
      </div>
    </section>
  );
}
