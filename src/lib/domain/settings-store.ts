import type { DB } from "@/lib/db";
import { inWriteTransaction, nowIso } from "@/lib/db";
import { DEFAULT_SETTINGS, programSettingsSchema, type ProgramSettings } from "./settings";
import { writeAudit, type Actor } from "./audit";
import { DomainError } from "./errors";

export function getSettings(db: DB): ProgramSettings {
  const row = db.prepare("SELECT value FROM program_settings WHERE id = 1").get() as { value: string } | undefined;
  if (!row) return DEFAULT_SETTINGS;
  const parsed = programSettingsSchema.safeParse(JSON.parse(row.value));
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export function getSettingsMeta(db: DB) {
  return db.prepare("SELECT updated_at AS updatedAt, updated_by AS updatedBy FROM program_settings WHERE id = 1").get() as
    | { updatedAt: string; updatedBy: string | null }
    | undefined;
}

export function saveSettings(db: DB, next: unknown, actor: Actor, reason: string) {
  const parsed = programSettingsSchema.safeParse(next);
  if (!parsed.success) {
    throw new DomainError("invalid_input", parsed.error.issues[0]?.message ?? "Settings are not valid.");
  }
  const tiers = [...parsed.data.tiers].sort((a, b) => a.threshold - b.threshold);
  if (tiers[0].threshold !== 0) throw new DomainError("invalid_input", "The entry tier must start at 0 points.");
  if (new Set(tiers.map((t) => t.threshold)).size !== tiers.length) {
    throw new DomainError("invalid_input", "Each tier needs a different threshold.");
  }
  if (!reason.trim()) throw new DomainError("reason_required", "Describe why the settings are changing.");

  return inWriteTransaction(db, () => {
    const before = getSettings(db);
    db.prepare(
      `INSERT INTO program_settings (id, value, updated_at, updated_by) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).run(JSON.stringify(parsed.data), nowIso(), actor.name);
    writeAudit(db, {
      actor,
      action: "settings.update",
      entityType: "program_settings",
      entityId: "1",
      summary: "Updated program settings",
      reason,
      before,
      after: parsed.data,
    });
    return parsed.data;
  });
}
