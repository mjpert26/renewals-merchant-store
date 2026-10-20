import { requireAdminPage } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getSettings, getSettingsMeta } from "@/lib/domain/settings-store";
import { listAudit } from "@/lib/domain/audit";
import { PageHeader, Notice } from "@/components/ui/primitives";
import { SettingsEditor } from "@/components/admin/settings-editor";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Program settings" };

export default async function SettingsPage() {
  await requireAdminPage();
  const db = getDb();
  const settings = getSettings(db);
  const meta = getSettingsMeta(db);
  const history = listAudit(db, { entityType: "program_settings", limit: 10 });
  return (
    <>
      <PageHeader
        eyebrow="Program"
        title="Program settings"
        description={meta ? `Last changed ${formatDateTime(meta.updatedAt)} by ${meta.updatedBy ?? "system"}.` : undefined}
      />
      <Notice tone="gold" className="mb-6" title="Demo assumptions, pending business approval">
        Every rate, threshold, bonus, limit and policy below is a placeholder until renewals, marketing, finance and compliance sign off.
        Changes apply to new activity only; existing ledger entries are never rewritten.
      </Notice>
      <SettingsEditor initial={settings} />
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-ink">Change history</h2>
        {history.length ? (
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="text-ink-2">
                {h.reason ?? h.summary} <span className="text-ink-3">· {h.actorName} · {formatDateTime(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No changes since launch defaults.</p>
        )}
      </section>
    </>
  );
}
