import { z } from "zod";
import type { DB } from "@/lib/db";
import { inWriteTransaction, newId, nowIso } from "@/lib/db";
import type { NotificationPreferences, Referral, ReferralStatus, SupportRequest } from "./types";
import { getSettings } from "./settings-store";
import { postEntry } from "./ledger";
import { awardMilestone } from "./milestones";
import { writeAudit, type Actor } from "./audit";
import { DomainError } from "./errors";

// ---------- Referrals ----------

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  submitted: "Submitted",
  in_review: "In review",
  funded: "Funded",
  not_funded: "Not funded",
};

export const referralInputSchema = z.object({
  businessName: z.string().trim().min(2, "Enter the business name.").max(100),
  ownerName: z.string().trim().min(2, "Enter the owner's name.").max(100),
  contact: z
    .string()
    .trim()
    .min(7, "Enter a phone number or email.")
    .max(120)
    .refine(
      (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^[+()\-.\s\d]{7,}$/.test(v),
      "Enter a valid phone number or email address.",
    ),
  consent: z.literal(true, { message: "Confirm you have permission to share their contact details." }),
});

type ReferralRow = {
  id: string;
  merchant_id: string;
  business_name: string;
  owner_name: string;
  contact: string;
  status: ReferralStatus;
  bonus_points: number | null;
  created_at: string;
  updated_at: string;
};

function mapReferral(r: ReferralRow): Referral {
  return {
    id: r.id,
    merchantId: r.merchant_id,
    businessName: r.business_name,
    ownerName: r.owner_name,
    contact: r.contact,
    status: r.status,
    bonusPoints: r.bonus_points,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listReferrals(db: DB, merchantId?: string): Referral[] {
  const rows = (merchantId
    ? db.prepare("SELECT * FROM referrals WHERE merchant_id = ? ORDER BY created_at DESC").all(merchantId)
    : db.prepare("SELECT * FROM referrals ORDER BY created_at DESC").all()) as ReferralRow[];
  return rows.map(mapReferral);
}

export function referralsThisYear(db: DB, merchantId: string, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
  return (
    db.prepare("SELECT COUNT(*) AS n FROM referrals WHERE merchant_id = ? AND created_at >= ?").get(merchantId, start) as {
      n: number;
    }
  ).n;
}

export function submitReferral(db: DB, merchantId: string, raw: unknown, actor: Actor): Referral {
  const parsed = referralInputSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError("invalid_input", parsed.error.issues[0]?.message ?? "Check the referral details.");
  const input = parsed.data;
  return inWriteTransaction(db, () => {
    const settings = getSettings(db);
    if (referralsThisYear(db, merchantId) >= settings.referrals.maxPerYear) {
      throw new DomainError("limit_reached", `You've reached this year's limit of ${settings.referrals.maxPerYear} referrals. Thank you!`);
    }
    const dup = db
      .prepare("SELECT 1 FROM referrals WHERE merchant_id = ? AND lower(business_name) = lower(?) AND status != 'not_funded'")
      .get(merchantId, input.businessName);
    if (dup) throw new DomainError("duplicate", "You've already referred this business. We'll keep you posted on it.");
    const id = newId("rf");
    const now = nowIso();
    db.prepare(
      `INSERT INTO referrals (id, merchant_id, business_name, owner_name, contact, consent, status, bonus_points, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 'submitted', NULL, ?, ?)`,
    ).run(id, merchantId, input.businessName, input.ownerName, input.contact, now, now);
    writeAudit(db, {
      actor,
      action: "referral.submit",
      entityType: "referral",
      entityId: id,
      merchantId,
      summary: `Referred ${input.businessName}`,
    });
    return mapReferral(db.prepare("SELECT * FROM referrals WHERE id = ?").get(id) as ReferralRow);
  });
}

/** Staff update. Marking a referral funded awards the referral bonus exactly once. */
export function updateReferralStatus(db: DB, referralId: string, status: ReferralStatus, actor: Actor, at?: string) {
  return inWriteTransaction(db, () => {
    const row = db.prepare("SELECT * FROM referrals WHERE id = ?").get(referralId) as ReferralRow | undefined;
    if (!row) throw new DomainError("not_found", "Referral not found.");
    if (row.status === "funded") throw new DomainError("invalid_transition", "Funded referrals are final.");
    const now = at ?? nowIso();
    let bonus: number | null = null;
    if (status === "funded") {
      const settings = getSettings(db);
      bonus = settings.bonuses.referralFunded;
      if (bonus > 0) {
        postEntry(db, {
          merchantId: row.merchant_id,
          type: "bonus",
          availableDelta: bonus,
          pendingDelta: 0,
          title: "Referral bonus",
          detail: `${row.business_name} funded`,
          refType: "referral",
          refId: row.id,
          idempotencyKey: `referral:${row.id}:bonus`,
          createdBy: actor.id,
          createdAt: now,
        });
      }
      awardMilestone(db, row.merchant_id, "first_referral_funded", settings, now);
    }
    db.prepare("UPDATE referrals SET status = ?, bonus_points = ?, updated_at = ? WHERE id = ?").run(status, bonus, now, row.id);
    writeAudit(db, {
      actor,
      action: "referral.status",
      entityType: "referral",
      entityId: row.id,
      merchantId: row.merchant_id,
      summary: `Referral ${row.business_name} marked ${REFERRAL_STATUS_LABELS[status].toLowerCase()}`,
      before: { status: row.status },
      after: { status },
      createdAt: now,
    });
  });
}

// ---------- Notification preferences ----------

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  tierProgress: true,
  newRewards: true,
  pointsExpiring: true,
  claimUpdates: true,
  pointsReleased: true,
};

export const preferencesSchema = z.object({
  tierProgress: z.boolean(),
  newRewards: z.boolean(),
  pointsExpiring: z.boolean(),
  claimUpdates: z.boolean(),
  pointsReleased: z.boolean(),
});

export function getPreferences(db: DB, merchantId: string): NotificationPreferences {
  const row = db.prepare("SELECT prefs FROM notification_preferences WHERE merchant_id = ?").get(merchantId) as
    | { prefs: string }
    | undefined;
  if (!row) return DEFAULT_PREFERENCES;
  const parsed = preferencesSchema.safeParse(JSON.parse(row.prefs));
  return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
}

export function savePreferences(db: DB, merchantId: string, raw: unknown): NotificationPreferences {
  const parsed = preferencesSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError("invalid_input", "Preferences are not valid.");
  db.prepare(
    `INSERT INTO notification_preferences (merchant_id, prefs, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(merchant_id) DO UPDATE SET prefs = excluded.prefs, updated_at = excluded.updated_at`,
  ).run(merchantId, JSON.stringify(parsed.data), nowIso());
  return parsed.data;
}

// ---------- Support callbacks ----------

export const SUPPORT_TOPICS = [
  "Rewards question",
  "A claim I placed",
  "My points balance",
  "Renewal or new funding",
  "Something else",
] as const;

export const callbackSchema = z.object({
  topic: z.enum(SUPPORT_TOPICS),
  preferredTime: z.enum(["Morning (9–12)", "Afternoon (12–3)", "Late afternoon (3–6)"]),
  phone: z.string().trim().regex(/^[+()\-.\s\d]{10,}$/, "Enter a phone number we can call."),
});

export function requestCallback(db: DB, merchantId: string, raw: unknown): SupportRequest {
  const parsed = callbackSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError("invalid_input", parsed.error.issues[0]?.message ?? "Check the request.");
  const open = db
    .prepare("SELECT 1 FROM support_requests WHERE merchant_id = ? AND status = 'open' AND created_at >= ?")
    .get(merchantId, new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  if (open) throw new DomainError("duplicate", "You already have a callback request open. Your team will call you soon.");
  const id = newId("sr");
  const now = nowIso();
  db.prepare(
    "INSERT INTO support_requests (id, merchant_id, topic, preferred_time, phone, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)",
  ).run(id, merchantId, parsed.data.topic, parsed.data.preferredTime, parsed.data.phone, now);
  return { id, merchantId, ...parsed.data, status: "open", createdAt: now };
}

export function listSupportRequests(db: DB, opts: { merchantId?: string; status?: "open" | "closed" } = {}) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.merchantId) {
    clauses.push("merchant_id = ?");
    params.push(opts.merchantId);
  }
  if (opts.status) {
    clauses.push("status = ?");
    params.push(opts.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return (
    db.prepare(`SELECT * FROM support_requests ${where} ORDER BY created_at DESC`).all(...params) as {
      id: string;
      merchant_id: string;
      topic: string;
      preferred_time: string;
      phone: string;
      status: "open" | "closed";
      created_at: string;
    }[]
  ).map(
    (r): SupportRequest => ({
      id: r.id,
      merchantId: r.merchant_id,
      topic: r.topic,
      preferredTime: r.preferred_time,
      phone: r.phone,
      status: r.status,
      createdAt: r.created_at,
    }),
  );
}

export function closeSupportRequest(db: DB, id: string, actor: Actor) {
  const res = db.prepare("UPDATE support_requests SET status = 'closed' WHERE id = ? AND status = 'open'").run(id);
  if (res.changes === 0) throw new DomainError("not_found", "Request not found or already closed.");
  writeAudit(db, { actor, action: "support.close", entityType: "support_request", entityId: id, summary: "Closed callback request" });
}

// ---------- Dismissible notices ----------

export function isDismissed(db: DB, merchantId: string, key: string) {
  return !!db.prepare("SELECT 1 FROM dismissals WHERE merchant_id = ? AND key = ?").get(merchantId, key);
}

export function dismiss(db: DB, merchantId: string, key: string) {
  db.prepare("INSERT OR IGNORE INTO dismissals (merchant_id, key, created_at) VALUES (?, ?, ?)").run(merchantId, key, nowIso());
}
