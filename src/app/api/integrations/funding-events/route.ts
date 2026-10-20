import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordFundingEvent } from "@/lib/domain/funding";
import { DomainError } from "@/lib/domain/errors";
import { toFundingEventInput, verifyBearer, type FundingEventPayload } from "@/lib/integrations/funding-source";

const bodySchema = z.object({
  source: z.enum(["salesforce", "n8n"]),
  events: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
});

/**
 * POST /api/integrations/funding-events
 * Authorization: Bearer <FUNDING_WEBHOOK_SECRET>
 * Body: { "source": "salesforce" | "n8n", "events": FundingEventPayload[] }
 *
 * Idempotent: an event whose (source, externalId) was already recorded is
 * reported as "duplicate" and awards nothing. Safe to retry the whole batch.
 */
export async function POST(request: NextRequest) {
  if (!process.env.FUNDING_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Funding integration is not configured on this environment." }, { status: 503 });
  }
  if (!verifyBearer(request.headers.get("authorization"), process.env.FUNDING_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body." }, { status: 400 });
  }

  const db = getDb();
  const results = parsed.data.events.map((raw) => {
    const payload = raw as unknown as FundingEventPayload;
    try {
      const { event, duplicate } = recordFundingEvent(db, toFundingEventInput(parsed.data.source, payload), {
        actor: { id: `integration:${parsed.data.source}`, name: `${parsed.data.source} integration` },
        payload: raw,
      });
      return { externalId: payload.externalId, status: duplicate ? "duplicate" : "created", points: event.points, pending: event.status === "pending" };
    } catch (error) {
      const message = error instanceof DomainError ? error.message : "Unexpected error";
      if (!(error instanceof DomainError)) console.error(error);
      return { externalId: payload.externalId ?? null, status: "error", error: message };
    }
  });
  const failed = results.filter((r) => r.status === "error").length;
  return NextResponse.json({ results }, { status: failed === results.length ? 422 : failed ? 207 : 200 });
}
