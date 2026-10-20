import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listAudit } from "@/lib/domain/audit";
import { merchantNames } from "@/lib/data/admin";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { DataTable, Th, Td } from "@/components/admin/table";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit log" };

const TYPES = [
  { id: "", label: "All" },
  { id: "ledger_entry", label: "Adjustments" },
  { id: "redemption", label: "Claims" },
  { id: "funding_event", label: "Funding" },
  { id: "reward", label: "Catalog" },
  { id: "program_settings", label: "Settings" },
  { id: "referral", label: "Referrals" },
];

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ type?: string; merchant?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const type = TYPES.some((t) => t.id === sp.type) ? sp.type : "";
  const names = merchantNames();
  const merchant = sp.merchant && names[sp.merchant] ? sp.merchant : undefined;
  const entries = listAudit(getDb(), { entityType: type || undefined, merchantId: merchant, limit: 300 });

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="Audit log"
        description={
          merchant ? (
            <>
              Showing changes for <span className="font-semibold text-ink">{names[merchant]}</span>.{" "}
              <Link href="/admin/audit" className="text-brand-ink hover:text-ink">
                Show all
              </Link>
            </>
          ) : (
            "Every staff action, import and merchant claim, with who did it and why. Entries cannot be edited."
          )
        }
      />
      <nav className="scrollbar-none -mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1" aria-label="Filter audit log">
        {TYPES.map((t) => {
          const qs = new URLSearchParams({ ...(t.id ? { type: t.id } : {}), ...(merchant ? { merchant } : {}) }).toString();
          return (
            <Link
              key={t.id}
              href={`/admin/audit${qs ? `?${qs}` : ""}`}
              aria-current={type === t.id ? "page" : undefined}
              className={cn("flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold", type === t.id ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink")}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {entries.length ? (
        <DataTable label="Audit entries">
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>What</Th>
              <Th>Merchant</Th>
              <Th>Reason</Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((a) => (
              <tr key={a.id}>
                <Td className="whitespace-nowrap">{formatDateTime(a.createdAt)}</Td>
                <Td className="whitespace-nowrap">{a.actorName ?? "System"}</Td>
                <Td>
                  <p className="text-ink">{a.summary}</p>
                  <p className="font-mono text-[11px] text-ink-3">{a.action}</p>
                </Td>
                <Td>{a.merchantId ? names[a.merchantId] ?? a.merchantId : "—"}</Td>
                <Td className="max-w-xs">{a.reason ?? <span className="text-ink-3">—</span>}</Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState title="No entries for this filter" />
      )}
    </>
  );
}
