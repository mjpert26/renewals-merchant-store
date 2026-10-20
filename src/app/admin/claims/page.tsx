import Image from "next/image";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listRedemptions, nextStatuses } from "@/lib/domain/redemptions";
import { merchantNames } from "@/lib/data/admin";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { DataTable, Th, Td } from "@/components/admin/table";
import { ClaimStatusBadge } from "@/components/rewards/claim-status";
import { ClaimDrawer } from "@/components/admin/claim-drawer";
import { cn, formatDate, formatPoints } from "@/lib/utils";
import type { RedemptionStatus } from "@/lib/domain/types";

export const metadata = { title: "Claims queue" };

const TABS: { id: string; label: string }[] = [
  { id: "open", label: "Needs action" },
  { id: "fulfilled", label: "Delivered" },
  { id: "closed", label: "Canceled or failed" },
  { id: "all", label: "All" },
];

export default async function AdminClaimsPage({ searchParams }: { searchParams: Promise<{ tab?: string; claim?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const tab = TABS.some((t) => t.id === sp.tab) ? sp.tab! : "open";
  const db = getDb();
  const all = listRedemptions(db);
  const names = merchantNames();
  const filtered = all
    .filter((c) =>
      tab === "open"
        ? ["requested", "processing", "shipped"].includes(c.status)
        : tab === "fulfilled"
          ? c.status === "fulfilled"
          : tab === "closed"
            ? c.status === "canceled" || c.status === "failed"
            : true,
    )
    .sort((a, b) => (tab === "open" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));
  const selected = sp.claim ? all.find((c) => c.id === sp.claim) ?? null : null;

  return (
    <>
      <PageHeader
        eyebrow="Fulfillment"
        title="Claims queue"
        description="Points are already reserved for every claim. Canceling or failing a claim returns the points and restocks inventory automatically."
      />
      <nav className="scrollbar-none -mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1" aria-label="Claim filters">
        {TABS.map((t) => {
          const count = all.filter((c) =>
            t.id === "open"
              ? ["requested", "processing", "shipped"].includes(c.status)
              : t.id === "fulfilled"
                ? c.status === "fulfilled"
                : t.id === "closed"
                  ? c.status === "canceled" || c.status === "failed"
                  : true,
          ).length;
          return (
            <Link
              key={t.id}
              href={`/admin/claims?tab=${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold",
                tab === t.id ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink",
              )}
            >
              {t.label} <span className="num text-xs text-ink-3">{count}</span>
            </Link>
          );
        })}
      </nav>

      {filtered.length ? (
        <DataTable label="Claims">
          <thead>
            <tr>
              <Th>Reward</Th>
              <Th>Merchant</Th>
              <Th>Requested</Th>
              <Th className="text-right">Points</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-surface-2/50">
                <Td>
                  <div className="flex items-center gap-3">
                    <span className="relative h-10 w-12 shrink-0 overflow-hidden rounded-lg">
                      <Image src={c.rewardImage} alt="" fill sizes="48px" className="object-cover" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{c.rewardName}</p>
                      <p className="text-xs text-ink-3">
                        {c.variantLabel}
                        {c.details.option ? ` · ${c.details.option.value}` : ""} · {c.reference}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Link href={`/admin/merchants/${c.merchantId}`} className="hover:text-ink hover:underline">
                    {names[c.merchantId]}
                  </Link>
                </Td>
                <Td>{formatDate(c.createdAt)}</Td>
                <Td className="num text-right font-semibold text-ink">{formatPoints(c.pointsCost)}</Td>
                <Td>
                  <ClaimStatusBadge status={c.status} />
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/admin/claims?tab=${tab}&claim=${c.id}`}
                    scroll={false}
                    className="inline-flex h-9 items-center rounded-[10px] border border-line-strong px-3 text-[13px] font-semibold text-ink hover:bg-surface-2"
                  >
                    {nextStatuses(c.status).length ? "Manage" : "View"}
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <div className="rounded-card border border-dashed border-line-strong">
          <EmptyState title={tab === "open" ? "Nothing waiting on you" : "No claims here yet"} description="New claims appear in “Needs action”." />
        </div>
      )}

      {selected && (
        <ClaimDrawer
          claim={selected}
          merchantName={names[selected.merchantId]}
          transitions={nextStatuses(selected.status) as RedemptionStatus[]}
          closeHref={`/admin/claims?tab=${tab}`}
        />
      )}
    </>
  );
}
