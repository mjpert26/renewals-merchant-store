import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listRewards, CATEGORY_LABELS, minPoints } from "@/lib/domain/rewards";
import { PageHeader, Badge } from "@/components/ui/primitives";
import { DataTable, Th, Td } from "@/components/admin/table";
import { buttonClasses } from "@/components/ui/button";
import { formatPoints } from "@/lib/utils";

export const metadata = { title: "Reward catalog" };

export default async function AdminRewardsPage() {
  await requireAdminPage();
  const rewards = listRewards(getDb(), { includeInactive: true });
  return (
    <>
      <PageHeader
        eyebrow="Program"
        title="Reward catalog"
        description="Descriptions, imagery, categories, point prices, stock and tier eligibility. Changes go live immediately and are audited."
        action={
          <Link href="/admin/rewards/new" className={buttonClasses("primary")}>
            <Plus className="h-4 w-4" aria-hidden /> New reward
          </Link>
        }
      />
      <DataTable label="Rewards">
        <thead>
          <tr>
            <Th>Reward</Th>
            <Th>Category</Th>
            <Th>Tier</Th>
            <Th className="text-right">Points</Th>
            <Th className="text-right">Stock</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rewards.map((r) => {
            const active = r.variants.filter((v) => v.active);
            const max = Math.max(...active.map((v) => v.pointsCost));
            return (
              <tr key={r.id} className="hover:bg-surface-2/50">
                <Td>
                  <Link href={`/admin/rewards/${r.id}`} className="flex items-center gap-3">
                    <span className="relative h-10 w-12 shrink-0 overflow-hidden rounded-lg">
                      <Image src={r.image} alt="" fill sizes="48px" className="object-cover" />
                    </span>
                    <span>
                      <span className="block font-semibold text-ink hover:underline">{r.name}</span>
                      <span className="block text-xs text-ink-3">/{r.slug}</span>
                    </span>
                  </Link>
                </Td>
                <Td>{CATEGORY_LABELS[r.category]}</Td>
                <Td className="capitalize">{r.minTier}</Td>
                <Td className="num text-right text-ink">
                  {formatPoints(minPoints(r))}
                  {active.length > 1 ? `–${formatPoints(max)}` : ""}
                </Td>
                <Td className="num text-right">
                  {r.inventory === null ? <span className="text-ink-3">Unlimited</span> : r.inventory === 0 ? <span className="text-danger">0</span> : r.inventory}
                </Td>
                <Td>
                  <div className="flex gap-1.5">
                    {r.active ? <Badge tone="success">Live</Badge> : <Badge>Hidden</Badge>}
                    {r.featured && <Badge tone="gold">Featured</Badge>}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </>
  );
}
