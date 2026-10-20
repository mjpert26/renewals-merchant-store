"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireAdmin, toActor } from "@/lib/auth/session";
import { updateRedemptionStatus } from "@/lib/domain/redemptions";
import { adjustPoints } from "@/lib/domain/merchants";
import { recordFundingEvent, releaseFundingEvent, reverseFundingEvent } from "@/lib/domain/funding";
import { saveReward } from "@/lib/domain/rewards";
import { saveSettings } from "@/lib/domain/settings-store";
import { updateReferralStatus, closeSupportRequest } from "@/lib/domain/engagement";
import { awardDueAnniversaries } from "@/lib/domain/milestones";
import { getSettings } from "@/lib/domain/settings-store";
import { inWriteTransaction } from "@/lib/db";
import { writeAudit } from "@/lib/domain/audit";
import { toActionError, type ActionResult, DomainError } from "@/lib/domain/errors";
import type { RedemptionStatus, ReferralStatus } from "@/lib/domain/types";
import { isDemoMode } from "@/lib/env";

function refresh() {
  revalidatePath("/", "layout");
}

export async function updateClaimStatusAction(input: {
  redemptionId: string;
  status: RedemptionStatus;
  note?: string;
  trackingInfo?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    updateRedemptionStatus(getDb(), input.redemptionId, input.status, toActor(user), {
      note: input.note,
      trackingInfo: input.trackingInfo,
    });
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function adjustPointsAction(input: unknown): Promise<ActionResult<{ duplicate: boolean }>> {
  try {
    const user = await requireAdmin();
    const { duplicate } = adjustPoints(getDb(), input, toActor(user));
    refresh();
    return { ok: true, data: { duplicate } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function simulateFundingAction(input: {
  merchantId: string;
  externalId: string;
  dealType: "initial" | "renewal";
  fundedAmount: number;
}): Promise<ActionResult<{ duplicate: boolean; points: number }>> {
  try {
    const user = await requireAdmin();
    if (!isDemoMode()) throw new DomainError("forbidden", "Simulated funding is only available in demo mode.");
    if (!Number.isFinite(input.fundedAmount) || input.fundedAmount < 1000 || input.fundedAmount > 5_000_000) {
      throw new DomainError("invalid_input", "Enter a funded amount between $1,000 and $5,000,000.");
    }
    const { event, duplicate } = recordFundingEvent(
      getDb(),
      {
        source: "simulated",
        externalId: input.externalId.trim() || `SIM-${randomUUID().slice(0, 8).toUpperCase()}`,
        merchantRef: input.merchantId,
        dealType: input.dealType,
        fundedAmountCents: Math.round(input.fundedAmount * 100),
        fundedAt: new Date().toISOString(),
      },
      { actor: toActor(user) },
    );
    refresh();
    return { ok: true, data: { duplicate, points: event.points } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function releaseFundingAction(fundingEventId: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    releaseFundingEvent(getDb(), fundingEventId, toActor(user));
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function reverseFundingAction(fundingEventId: string, reason: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    reverseFundingEvent(getDb(), fundingEventId, toActor(user), reason);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveRewardAction(rewardId: string | null, input: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const user = await requireAdmin();
    const reward = saveReward(getDb(), rewardId, input, toActor(user));
    refresh();
    return { ok: true, data: { id: reward.id, slug: reward.slug } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveSettingsAction(settings: unknown, reason: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    saveSettings(getDb(), settings, toActor(user), reason);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateReferralStatusAction(referralId: string, status: ReferralStatus): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    updateReferralStatus(getDb(), referralId, status, toActor(user));
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function closeSupportRequestAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    closeSupportRequest(getDb(), id, toActor(user));
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function runDailyJobsAction(): Promise<ActionResult<{ anniversaries: number }>> {
  try {
    const user = await requireAdmin();
    const db = getDb();
    const anniversaries = inWriteTransaction(db, () => {
      const count = awardDueAnniversaries(db, getSettings(db));
      writeAudit(db, {
        actor: toActor(user),
        action: "jobs.daily",
        entityType: "program",
        summary: `Ran daily program jobs: ${count} anniversary bonus${count === 1 ? "" : "es"} awarded`,
      });
      return count;
    });
    refresh();
    return { ok: true, data: { anniversaries } };
  } catch (error) {
    return toActionError(error);
  }
}
