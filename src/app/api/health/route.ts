import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isDemoMode } from "@/lib/env";

export function GET() {
  try {
    getDb().prepare("SELECT 1").get();
    return NextResponse.json({ ok: true, demoMode: isDemoMode(), fundingIntegration: Boolean(process.env.FUNDING_WEBHOOK_SECRET) });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
