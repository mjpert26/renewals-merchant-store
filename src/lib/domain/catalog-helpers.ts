import type { DeliveryMethod, Reward, RewardCategory, RewardVariant, TierId } from "./types";
import { tierRank } from "./settings";

// Safe for client components: no database or Node.js imports.

export const CATEGORY_LABELS: Record<RewardCategory, string> = {
  gift_cards: "Gift cards",
  merchandise: "Merchandise",
  experiences: "Experiences",
  business_services: "For your business",
  giving_back: "Giving back",
};

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  digital_email: "Digital delivery by email",
  shipped: "Shipped to your business",
  scheduled: "Scheduled with you",
  account_credit: "Applied as account credit",
  donation: "Donated on your behalf",
};

export function minPoints(reward: Reward): number {
  const costs = reward.variants.filter((v) => v.active).map((v) => v.pointsCost);
  return costs.length ? Math.min(...costs) : 0;
}

export type Availability =
  | { state: "available" }
  | { state: "insufficient"; shortBy: number }
  | { state: "tier_locked"; requires: TierId }
  | { state: "out_of_stock" }
  | { state: "inactive" };

/** Availability of a reward (or a specific variant) for a merchant. Shared by UI and server validation. */
export function availabilityFor(
  reward: Reward,
  ctx: { tier: TierId; available: number },
  variant?: RewardVariant,
): Availability {
  const variants = reward.variants.filter((v) => v.active);
  if (!reward.active || variants.length === 0 || (variant && !variant.active)) return { state: "inactive" };
  if (tierRank(ctx.tier) < tierRank(reward.minTier)) return { state: "tier_locked", requires: reward.minTier };
  if (reward.inventory !== null && reward.inventory <= 0) return { state: "out_of_stock" };
  const cost = variant ? variant.pointsCost : minPoints(reward);
  if (ctx.available < cost) return { state: "insufficient", shortBy: cost - ctx.available };
  return { state: "available" };
}

