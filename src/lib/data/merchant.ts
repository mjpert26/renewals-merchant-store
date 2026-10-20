import "server-only";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { getMerchantSummary } from "@/lib/domain/merchants";
import { getSettings } from "@/lib/domain/settings-store";

/** Per-request merchant context shared by the layout and pages. */
export const loadMerchantContext = cache((merchantId: string) => {
  const db = getDb();
  const summary = getMerchantSummary(db, merchantId);
  const settings = getSettings(db);
  return { db, settings, ...summary };
});

export function memberNumber(merchantId: string, externalRef: string | null) {
  const digits = (externalRef ?? merchantId).replace(/\D/g, "").padStart(5, "0").slice(-5);
  return `BTR ${digits.slice(0, 2)}${digits.slice(2)}`;
}
