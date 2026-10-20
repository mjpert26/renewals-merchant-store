import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { releaseFundingEvent } from "@/lib/domain/funding";
import { DomainError } from "@/lib/domain/errors";
import { verifyBearer } from "@/lib/integrations/funding-source";

const bodySchema = z.object({
  source: z.enum(["salesforce", "n8n"]),
  externalId: z.string().min(1).max(120),
});

/**
 * POST /api/integrations/funding-events/release
 * Called by the payment-tracking workflow once release conditions are met
 * (for example, the configured number of on-time payments). Releasing an
 * already-released event returns 409 and changes nothing.
 */
export async function POST(request: NextRequest) {
  if (!process.env.FUNDING_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Funding integration is not configured on this environment." }, { status: 503 });
  }
  if (!verifyBearer(request.headers.get("authorization"), process.env.FUNDING_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Body must include source and externalId." }, { status: 400 });

  const db = getDb();
  const row = db
    .prepare("SELECT id FROM funding_events WHERE source = ? AND external_id = ?")
    .get(parsed.data.source, parsed.data.externalId) as { id: string } | undefined;
  if (!row) return NextResponse.json({ error: "Funding event not found." }, { status: 404 });
  try {
    const event = releaseFundingEvent(db, row.id, { id: `integration:${parsed.data.source}`, name: `${parsed.data.source} integration` });
    return NextResponse.json({ externalId: parsed.data.externalId, status: event.status, points: event.points });
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
