import { timingSafeEqual } from "node:crypto";
import type { FundingEventInput } from "@/lib/domain/funding";

/**
 * Integration boundary for upstream funding systems.
 *
 * Upstream systems (for example a Salesforce flow or an n8n workflow) POST
 * normalized events to /api/integrations/funding-events. Object and field
 * names in those systems are not assumed here: whoever builds the workflow
 * maps their records onto FundingEventPayload.
 *
 * Required mapping decisions (owned by the Salesforce/n8n team):
 *  - externalId: a stable, unique identifier for the funded deal. It must not
 *    change between deliveries; it is the idempotency key.
 *  - merchantRef: the stable account identifier stored on the merchant record
 *    here as `external_ref`.
 *  - dealType: "initial" for a first funding, "renewal" otherwise.
 *  - fundedAmount: the funded amount in US dollars.
 *  - fundedAt: ISO-8601 timestamp with offset.
 */
export interface FundingEventPayload {
  externalId: string;
  merchantRef: string;
  dealType: "initial" | "renewal";
  fundedAmount: number;
  fundedAt: string;
}

export function toFundingEventInput(source: "salesforce" | "n8n", payload: FundingEventPayload): FundingEventInput {
  return {
    source,
    externalId: String(payload.externalId ?? ""),
    merchantRef: String(payload.merchantRef ?? ""),
    dealType: payload.dealType,
    fundedAmountCents: Math.round(Number(payload.fundedAmount) * 100),
    fundedAt: payload.fundedAt,
  };
}

/** Constant-time bearer token check. Returns false when the secret is not configured. */
export function verifyBearer(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 24 || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
