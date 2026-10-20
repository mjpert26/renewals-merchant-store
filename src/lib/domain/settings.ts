import { z } from "zod";
import type { TierId } from "./types";

// Every value in this file is a configurable demo assumption. None of these
// rates, thresholds, limits or policies have been approved by the business.
// Staff can change them at /admin/settings; changes are audited.

export const tierSchema = z.object({
  id: z.enum(["silver", "gold", "platinum"]),
  name: z.string().min(1).max(40),
  threshold: z.number().int().min(0).max(10_000_000),
  benefits: z.array(z.string().min(1).max(160)).max(8),
});

export const programSettingsSchema = z.object({
  programName: z.string().min(1).max(60),
  earning: z.object({
    pointsPerHundredDollars: z.number().min(0).max(100),
    renewalMultiplier: z.number().min(1).max(5),
  }),
  release: z.object({
    onTimePaymentsRequired: z.number().int().min(0).max(52),
    typicalDays: z.number().int().min(0).max(365),
  }),
  bonuses: z.object({
    firstFunding: z.number().int().min(0).max(100_000),
    threeFundings: z.number().int().min(0).max(100_000),
    anniversary: z.number().int().min(0).max(100_000),
    referralFunded: z.number().int().min(0).max(100_000),
    paidInFull: z.number().int().min(0).max(100_000),
  }),
  referrals: z.object({
    maxPerYear: z.number().int().min(0).max(100),
  }),
  expiration: z.object({
    inactivityMonths: z.number().int().min(0).max(120),
    warningDays: z.number().int().min(0).max(365),
  }),
  limits: z.object({
    maxRedemptionsPerMonth: z.number().int().min(1).max(100),
  }),
  tiers: z.array(tierSchema).length(3),
  support: z.object({
    phone: z.string().min(7).max(30),
    sms: z.string().min(7).max(30),
    email: z.string().email(),
    hours: z.string().min(1).max(80),
  }),
});

export type ProgramSettings = z.infer<typeof programSettingsSchema>;
export type TierConfig = z.infer<typeof tierSchema>;

export const DEFAULT_SETTINGS: ProgramSettings = {
  programName: "Big Think Rewards",
  earning: {
    pointsPerHundredDollars: 2,
    renewalMultiplier: 1,
  },
  release: {
    onTimePaymentsRequired: 8,
    typicalDays: 60,
  },
  bonuses: {
    firstFunding: 250,
    threeFundings: 250,
    anniversary: 500,
    referralFunded: 1500,
    paidInFull: 1000,
  },
  referrals: {
    maxPerYear: 10,
  },
  expiration: {
    inactivityMonths: 24,
    warningDays: 30,
  },
  limits: {
    maxRedemptionsPerMonth: 5,
  },
  tiers: [
    {
      id: "silver",
      name: "Silver",
      threshold: 0,
      benefits: [
        "Full rewards catalog access",
        "Anniversary and milestone bonuses",
        "Two-sided referral bonuses",
      ],
    },
    {
      id: "gold",
      name: "Gold",
      threshold: 5000,
      benefits: [
        "Everything in Silver",
        "Priority support line",
        "Faster reward fulfillment",
        "Gold-only experiences and merchandise",
      ],
    },
    {
      id: "platinum",
      name: "Platinum",
      threshold: 15000,
      benefits: [
        "Everything in Gold",
        "Dedicated relationship manager",
        "Priority file review on renewals",
        "Platinum-only rewards and an annual thank-you gift",
      ],
    },
  ],
  support: {
    phone: "(212) 555-0148",
    sms: "(212) 555-0172",
    email: "rewards@bigthinkcapital.com",
    hours: "Mon–Fri, 9am–6pm ET",
  },
};

export const TIER_ORDER: TierId[] = ["silver", "gold", "platinum"];

export function tierRank(tier: TierId): number {
  return TIER_ORDER.indexOf(tier);
}

export interface TierStatus {
  current: TierConfig;
  next: TierConfig | null;
  pointsToNext: number;
  progress: number; // 0..1 toward the next tier
}

export function tierFor(lifetimeEarned: number, settings: ProgramSettings): TierStatus {
  const tiers = [...settings.tiers].sort((a, b) => a.threshold - b.threshold);
  let currentIndex = 0;
  tiers.forEach((tier, index) => {
    if (lifetimeEarned >= tier.threshold) currentIndex = index;
  });
  const current = tiers[currentIndex];
  const next = tiers[currentIndex + 1] ?? null;
  if (!next) return { current, next: null, pointsToNext: 0, progress: 1 };
  const span = next.threshold - current.threshold;
  const progress = span <= 0 ? 1 : (lifetimeEarned - current.threshold) / span;
  return {
    current,
    next,
    pointsToNext: Math.max(0, next.threshold - lifetimeEarned),
    progress: Math.min(1, Math.max(0, progress)),
  };
}

export function pointsForFunding(
  fundedAmountCents: number,
  dealType: "initial" | "renewal",
  settings: ProgramSettings,
): number {
  const base = (fundedAmountCents / 100 / 100) * settings.earning.pointsPerHundredDollars;
  const multiplier = dealType === "renewal" ? settings.earning.renewalMultiplier : 1;
  return Math.floor(base * multiplier);
}
