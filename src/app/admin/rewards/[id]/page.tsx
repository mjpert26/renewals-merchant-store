import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getReward } from "@/lib/domain/rewards";
import { listAudit } from "@/lib/domain/audit";
import { PageHeader } from "@/components/ui/primitives";
import { RewardEditor } from "@/components/admin/reward-editor";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Edit reward" };

export default async function EditRewardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const db = getDb();
  const reward = id === "new" ? null : getReward(db, id, { includeInactive: true });
  if (id !== "new" && !reward) notFound();
  const history = reward ? listAudit(db, { entityType: "reward" }).filter((a) => a.entityId === reward.id).slice(0, 6) : [];

  return (
    <>
      <Link href="/admin/rewards" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Reward catalog
      </Link>
      <PageHeader
        eyebrow={reward ? "Edit reward" : "New reward"}
        title={reward?.name ?? "Create a reward"}
        description={reward ? `Last updated ${formatDateTime(reward.updatedAt)}` : "New rewards can be saved hidden and published when ready."}
      />
      <RewardEditor reward={reward} />
      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-ink">Change history</h2>
          <ul className="space-y-2 text-sm text-ink-2">
            {history.map((h) => (
              <li key={h.id}>
                {h.summary} · <span className="text-ink-3">{h.actorName} · {formatDateTime(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
