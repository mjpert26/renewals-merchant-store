import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { searchMerchants } from "@/lib/domain/merchants";
import { PageHeader, Badge, EmptyState } from "@/components/ui/primitives";
import { DataTable, Th, Td } from "@/components/admin/table";
import { buttonClasses } from "@/components/ui/button";
import { formatDate, formatPoints } from "@/lib/utils";

export const metadata = { title: "Merchants" };

export default async function MerchantsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage();
  const { q = "" } = await searchParams;
  const results = searchMerchants(getDb(), q.slice(0, 80));

  return (
    <>
      <PageHeader
        eyebrow="Merchants"
        title="Find a merchant"
        description="Search by business, owner, email, city or account reference to inspect balances and activity."
      />
      <form role="search" className="mb-6 flex gap-2" action="/admin/merchants">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <label htmlFor="merchant-q" className="sr-only">
            Search merchants
          </label>
          <input
            id="merchant-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Coastal Kitchen, Priya, DEMO-ACCT-10482…"
            className="h-11 w-full rounded-control border border-line-strong bg-canvas-raised pl-10 pr-3 text-[15px] text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/25"
          />
        </div>
        <button type="submit" className={buttonClasses("primary")}>
          Search
        </button>
      </form>

      {results.length ? (
        <DataTable label="Merchants">
          <thead>
            <tr>
              <Th>Business</Th>
              <Th>Tier</Th>
              <Th className="text-right">Available</Th>
              <Th className="text-right">Pending</Th>
              <Th className="text-right">Lifetime</Th>
              <Th>Open claims</Th>
              <Th>Member since</Th>
            </tr>
          </thead>
          <tbody>
            {results.map(({ merchant, account, tier, openClaims }) => (
              <tr key={merchant.id} className="hover:bg-surface-2/50">
                <Td>
                  <Link href={`/admin/merchants/${merchant.id}`} className="font-semibold text-ink hover:underline">
                    {merchant.businessName}
                  </Link>
                  <p className="text-xs text-ink-3">
                    {merchant.ownerFirstName} {merchant.ownerLastName} · {merchant.city}, {merchant.state} · {merchant.externalRef}
                  </p>
                </Td>
                <Td>
                  <Badge tone={tier.current.id === "silver" ? "neutral" : "gold"}>{tier.current.name}</Badge>
                </Td>
                <Td className="num text-right font-semibold text-ink">{formatPoints(account.available)}</Td>
                <Td className="num text-right text-warn">{formatPoints(account.pending)}</Td>
                <Td className="num text-right">{formatPoints(account.lifetimeEarned)}</Td>
                <Td>{openClaims ? <Badge tone="brand">{openClaims}</Badge> : <span className="text-ink-3">None</span>}</Td>
                <Td>{formatDate(merchant.memberSince)}</Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <div className="rounded-card border border-dashed border-line-strong">
          <EmptyState title={`No merchants match “${q}”`} description="Check the spelling, or search by email or account reference." />
        </div>
      )}
    </>
  );
}
