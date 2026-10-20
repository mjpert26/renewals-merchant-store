"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { endSession, requireMerchant, startSession, toActor } from "@/lib/auth/session";
import { redeemReward, submitToFulfillment } from "@/lib/domain/redemptions";
import { submitReferral, savePreferences, requestCallback, dismiss } from "@/lib/domain/engagement";
import { toActionError, type ActionResult, DomainError } from "@/lib/domain/errors";
import { isDemoMode } from "@/lib/env";
import { sessionConfigError } from "@/lib/auth/token";

export async function signInAsDemoUser(userId: string): Promise<ActionResult> {
  if (!isDemoMode()) return { ok: false, code: "forbidden", error: "Demo sign-in is disabled." };
  const configError = sessionConfigError();
  if (configError) return { ok: false, code: "unexpected", error: configError };
  try {
    await startSession(userId);
  } catch (error) {
    return toActionError(error);
  }
  const role = (getDb().prepare("SELECT role FROM users WHERE id = ?").get(userId) as { role: string }).role;
  redirect(role === "admin" ? "/admin" : "/");
}

export async function signOut() {
  await endSession();
  redirect("/login");
}

export async function redeemAction(input: unknown): Promise<ActionResult<{ redemptionId: string; reference: string; duplicate: boolean }>> {
  try {
    const user = await requireMerchant();
    const db = getDb();
    // merchantId always comes from the session, never from the client.
    const { redemption, duplicate } = redeemReward(db, user.merchantId, input, toActor(user));
    if (!duplicate) await submitToFulfillment(db, redemption.id);
    revalidatePath("/", "layout");
    return { ok: true, data: { redemptionId: redemption.id, reference: redemption.reference, duplicate } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function submitReferralAction(input: unknown): Promise<ActionResult<{ businessName: string }>> {
  try {
    const user = await requireMerchant();
    const referral = submitReferral(getDb(), user.merchantId, input, toActor(user));
    revalidatePath("/referrals");
    return { ok: true, data: { businessName: referral.businessName } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function savePreferencesAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireMerchant();
    savePreferences(getDb(), user.merchantId, input);
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function requestCallbackAction(input: unknown): Promise<ActionResult<{ preferredTime: string }>> {
  try {
    const user = await requireMerchant();
    const request = requestCallback(getDb(), user.merchantId, input);
    return { ok: true, data: { preferredTime: request.preferredTime } };
  } catch (error) {
    return toActionError(error);
  }
}

const DISMISSIBLE = /^[a-z0-9_:-]{1,60}$/;

export async function dismissNoticeAction(key: string): Promise<ActionResult> {
  try {
    const user = await requireMerchant();
    if (!DISMISSIBLE.test(key)) throw new DomainError("invalid_input", "Unknown notice.");
    dismiss(getDb(), user.merchantId, key);
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
