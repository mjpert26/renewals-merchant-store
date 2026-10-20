import Image from "next/image";
import Link from "next/link";
import { Lock, PackageX } from "lucide-react";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { Badge } from "@/components/ui/primitives";
import { CATEGORY_LABELS, minPoints, type Availability } from "@/lib/domain/catalog-helpers";
import type { Reward } from "@/lib/domain/types";
import { cn, formatPoints } from "@/lib/utils";

const TIER_NAMES = { silver: "Silver", gold: "Gold", platinum: "Platinum" } as const;

export function RewardCard({
  reward,
  availability,
  available,
  priority,
  spotlight = true,
}: {
  reward: Reward;
  availability: Availability;
  available: number;
  priority?: boolean;
  spotlight?: boolean;
}) {
  const cost = minPoints(reward);
  const multiple = reward.variants.length > 1;
  const dim = availability.state === "tier_locked" || availability.state === "out_of_stock";
  const lowStock = reward.inventory !== null && reward.inventory > 0 && reward.inventory <= 5;

  const body = (
    <Link
      href={`/rewards/${reward.slug}`}
      className="group flex h-full flex-col rounded-[inherit] p-2.5 focus-visible:outline-offset-[-2px]"
      aria-describedby={`${reward.id}-status`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-surface-2">
        <Image
          src={reward.image}
          alt=""
          fill
          priority={priority}
          sizes="(min-width: 1280px) 280px, (min-width: 768px) 33vw, 50vw"
          className={cn(
            "object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]",
            dim && "opacity-55 saturate-[0.6]",
          )}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#060b17]/70 to-transparent" aria-hidden />
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          {reward.minTier !== "silver" && (
            <Badge tone="gold" className="h-[22px] bg-[#1a1408]/80 px-2 text-[11px] backdrop-blur">
              {availability.state === "tier_locked" && <Lock className="h-3 w-3" aria-hidden />}
              {TIER_NAMES[reward.minTier]}
            </Badge>
          )}
          {lowStock && availability.state !== "tier_locked" && (
            <Badge tone="warn" className="h-[22px] bg-[#1d1606]/80 px-2 text-[11px] backdrop-blur">
              Only {reward.inventory} left
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{CATEGORY_LABELS[reward.category]}</p>
        <h3 className="mt-1 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">{reward.name}</h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-3">{reward.tagline}</p>

        <div className="mt-auto pt-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
            <p className="num text-[15px] font-bold text-ink">
              {multiple && <span className="mr-1 text-xs font-medium text-ink-3">from</span>}
              {formatPoints(cost)}
              <span className="ml-1 text-xs font-medium text-ink-3">pts</span>
            </p>
            <StatusLine availability={availability} id={`${reward.id}-status`} />
          </div>
          {availability.state === "insufficient" && (
            <div
              className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.07]"
              role="progressbar"
              aria-label={`${Math.round((available / cost) * 100)}% of the points needed`}
              aria-valuenow={Math.round((available / cost) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-brand/70" style={{ width: `${Math.min(100, (available / cost) * 100)}%` }} />
            </div>
          )}
        </div>
      </div>
    </Link>
  );

  if (!spotlight) {
    return <div className="h-full rounded-[20px] border border-line bg-surface shadow-card">{body}</div>;
  }
  return (
    <SpotlightCard
      className="h-full rounded-[20px] transition-transform duration-300 hover:-translate-y-0.5"
      spotlightColor={reward.minTier === "silver" ? "rgba(90, 140, 255, 0.85)" : "rgba(234, 210, 156, 0.8)"}
      intensity={0.12}
      spotlightSize={260}
      borderGlow={0.5}
      style={
        {
          "--spotlight-card-surface": "#0d1628",
          "--spotlight-card-border": "rgba(148, 170, 214, 0.12)",
        } as React.CSSProperties
      }
    >
      {body}
    </SpotlightCard>
  );
}

function StatusLine({ availability, id }: { availability: Availability; id: string }) {
  switch (availability.state) {
    case "available":
      return (
        <span id={id} className="text-xs font-semibold text-success">
          You can claim this
        </span>
      );
    case "insufficient":
      return (
        <span id={id} className="num text-xs font-medium text-ink-3">
          {formatPoints(availability.shortBy)} pts to go
        </span>
      );
    case "tier_locked":
      return (
        <span id={id} className="flex items-center gap-1 text-xs font-medium text-gold-ink">
          <Lock className="h-3 w-3" aria-hidden /> Unlocks at {TIER_NAMES[availability.requires]}
        </span>
      );
    case "out_of_stock":
      return (
        <span id={id} className="flex items-center gap-1 text-xs font-medium text-ink-3">
          <PackageX className="h-3 w-3" aria-hidden /> Out of stock
        </span>
      );
    default:
      return (
        <span id={id} className="text-xs text-ink-3">
          Unavailable
        </span>
      );
  }
}
