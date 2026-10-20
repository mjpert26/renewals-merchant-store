"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import type { LedgerEntry } from "@/lib/domain/types";
import { ACTIVITY_FILTERS, ActivityRow } from "./activity";
import { Card, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE = 12;

export function ActivityBrowser({ entries }: { entries: LedgerEntry[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(PAGE);

  const results = useMemo(() => {
    const f = ACTIVITY_FILTERS.find((x) => x.id === filter)!;
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (f.types.length && !f.types.includes(e.type)) return false;
      if (!needle) return true;
      const date = new Date(e.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      return `${e.title} ${e.detail ?? ""} ${date}`.toLowerCase().includes(needle);
    });
  }, [entries, q, filter]);

  // Group by month for scannability.
  const groups = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>();
    for (const e of results.slice(0, limit)) {
      const key = new Date(e.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/New_York" });
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [results, limit]);

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="Filter activity">
          {ACTIVITY_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setLimit(PAGE);
              }}
              className={cn(
                "h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                filter === f.id ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <label htmlFor="activity-search" className="sr-only">
            Search activity
          </label>
          <input
            id="activity-search"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Search by reward, deal or month"
            className="h-10 w-full rounded-control border border-line-strong bg-canvas-raised pl-10 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/25"
          />
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {results.length} transactions shown
      </p>

      {groups.length ? (
        <div className="mt-4">
          {groups.map(([month, list]) => (
            <section key={month} aria-label={month}>
              <h3 className="sticky top-16 z-[1] -mx-1 bg-surface/95 px-1 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3 backdrop-blur lg:top-[76px]">
                {month}
              </h3>
              <ul className="divide-y divide-line">
                {list.map((e) => (
                  <ActivityRow key={e.id} entry={e} />
                ))}
              </ul>
            </section>
          ))}
          {results.length > limit && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
                Show more ({results.length - limit} older)
              </Button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<SearchX className="h-5 w-5" />}
          title="No matching activity"
          description="Try a different search or filter."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQ("");
                setFilter("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      )}
    </Card>
  );
}
