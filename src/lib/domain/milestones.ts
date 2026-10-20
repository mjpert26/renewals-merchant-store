import type { DB } from "@/lib/db";
import { nowIso } from "@/lib/db";
import type { ProgramSettings } from "./settings";
import { postEntry } from "./ledger";

export type MilestoneCode =
  | "first_funding"
  | "anniversary_1"
  | "three_fundings"
  | "first_referral_funded"
  | "paid_in_full"
  | "anniversary_2";

export interface MilestoneDefinition {
  code: MilestoneCode;
  title: string;
  description: string;
  bonus: (s: ProgramSettings) => number;
}

export const MILESTONES: MilestoneDefinition[] = [
  {
    code: "first_funding",
    title: "First funding",
    description: "Your first deal with Big Think Capital.",
    bonus: (s) => s.bonuses.firstFunding,
  },
  {
    code: "three_fundings",
    title: "Three fundings",
    description: "Three deals funded and in good standing.",
    bonus: (s) => s.bonuses.threeFundings,
  },
  {
    code: "first_referral_funded",
    title: "First referral funded",
    description: "A business you referred received funding.",
    bonus: () => 0,
  },
  {
    code: "anniversary_1",
    title: "1-year anniversary",
    description: "One year as a Big Think Capital client.",
    bonus: (s) => s.bonuses.anniversary,
  },
  {
    code: "paid_in_full",
    title: "Paid in full",
    description: "A balance fully paid as agreed.",
    bonus: (s) => s.bonuses.paidInFull,
  },
  {
    code: "anniversary_2",
    title: "2-year anniversary",
    description: "Two years as a Big Think Capital client.",
    bonus: (s) => s.bonuses.anniversary,
  },
];

export interface MilestoneStatus extends MilestoneDefinition {
  achievedAt: string | null;
  pointsAwarded: number | null;
  expectedAt: string | null;
  bonusPoints: number;
}

export function milestoneStatuses(
  db: DB,
  merchant: { id: string; memberSince: string },
  settings: ProgramSettings,
): MilestoneStatus[] {
  const awarded = db
    .prepare("SELECT code, awarded_at, points FROM milestones_awarded WHERE merchant_id = ?")
    .all(merchant.id) as { code: MilestoneCode; awarded_at: string; points: number }[];
  const since = new Date(merchant.memberSince);
  const plusYears = (n: number) => {
    const d = new Date(since);
    d.setUTCFullYear(d.getUTCFullYear() + n);
    return d.toISOString();
  };
  return MILESTONES.map((m) => {
    const hit = awarded.find((a) => a.code === m.code);
    const expectedAt = m.code === "anniversary_1" ? plusYears(1) : m.code === "anniversary_2" ? plusYears(2) : null;
    return {
      ...m,
      achievedAt: hit?.awarded_at ?? null,
      pointsAwarded: hit?.points ?? null,
      expectedAt,
      bonusPoints: m.bonus(settings),
    };
  });
}

/** Awards a milestone at most once per merchant. Must run inside a write transaction. */
export function awardMilestone(
  db: DB,
  merchantId: string,
  code: MilestoneCode,
  settings: ProgramSettings,
  at: string = nowIso(),
): boolean {
  const def = MILESTONES.find((m) => m.code === code)!;
  const inserted = db
    .prepare("INSERT OR IGNORE INTO milestones_awarded (merchant_id, code, awarded_at, points) VALUES (?, ?, ?, ?)")
    .run(merchantId, code, at, def.bonus(settings));
  if (inserted.changes === 0) return false;
  const points = def.bonus(settings);
  if (points > 0) {
    postEntry(db, {
      merchantId,
      type: "bonus",
      availableDelta: points,
      pendingDelta: 0,
      title: `${def.title} bonus`,
      detail: def.description,
      refType: "milestone",
      refId: code,
      idempotencyKey: `milestone:${merchantId}:${code}`,
      createdAt: at,
    });
  }
  return true;
}

/** Checks funding-count milestones after a funding is released. */
export function checkFundingMilestones(db: DB, merchantId: string, settings: ProgramSettings, at?: string) {
  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM funding_events WHERE merchant_id = ? AND status = 'released'")
    .get(merchantId) as { n: number };
  if (n >= 1) awardMilestone(db, merchantId, "first_funding", settings, at);
  if (n >= 3) awardMilestone(db, merchantId, "three_fundings", settings, at);
}

/** Daily job: awards anniversaries that have come due. Safe to run repeatedly. */
export function awardDueAnniversaries(db: DB, settings: ProgramSettings, now = new Date()) {
  const merchants = db.prepare("SELECT id, member_since FROM merchants").all() as { id: string; member_since: string }[];
  let awarded = 0;
  for (const m of merchants) {
    for (const [code, years] of [
      ["anniversary_1", 1],
      ["anniversary_2", 2],
    ] as const) {
      const due = new Date(m.member_since);
      due.setUTCFullYear(due.getUTCFullYear() + years);
      if (due <= now && awardMilestone(db, m.id, code, settings, due.toISOString())) awarded += 1;
    }
  }
  return awarded;
}
