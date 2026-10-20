"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, SearchX, X } from "lucide-react";
import type { Reward, RewardCategory } from "@/lib/domain/types";
import { CATEGORY_LABELS, minPoints, type Availability } from "@/lib/domain/catalog-helpers";
import { RewardCard } from "./reward-card";
import { Select } from "@/components/ui/form";
import { Switch } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Item = { reward: Reward; availability: Availability };

const SORTS = {
  recommended: "Recommended",
  "points-asc": "Points: low to high",
  "points-desc": "Points: high to low",
  name: "Name: A to Z",
} as const;
type SortKey = keyof typeof SORTS;

const STATE_RANK: Record<Availability["state"], number> = {
  available: 0,
  insufficient: 1,
  tier_locked: 2,
  out_of_stock: 3,
  inactive: 4,
};

export function RewardsBrowser({ items, available }: { items: Item[]; available: number }) {
  const pathname = usePathname();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const category = (params.get("category") ?? "all") as RewardCategory | "all";
  const sort = ((params.get("sort") ?? "recommended") in SORTS ? params.get("sort") ?? "recommended" : "recommended") as SortKey;
  const affordable = params.get("affordable") === "1";

  function update(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "" || (k === "category" && v === "all") || (k === "sort" && v === "recommended")) sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    // Shallow URL update: keeps filters shareable without a server round trip per keystroke.
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[i.reward.category] = (c[i.reward.category] ?? 0) + 1;
    return c;
  }, [items]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = items.filter(({ reward, availability }) => {
      if (category !== "all" && reward.category !== category) return false;
      if (affordable && availability.state !== "available") return false;
      if (!needle) return true;
      return [reward.name, reward.tagline, reward.description, CATEGORY_LABELS[reward.category]]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    return filtered.sort((a, b) => {
      switch (sort) {
        case "points-asc":
          return minPoints(a.reward) - minPoints(b.reward);
        case "points-desc":
          return minPoints(b.reward) - minPoints(a.reward);
        case "name":
          return a.reward.name.localeCompare(b.reward.name);
        default:
          return (
            STATE_RANK[a.availability.state] - STATE_RANK[b.availability.state] ||
            Number(b.reward.featured) - Number(a.reward.featured) ||
            minPoints(a.reward) - minPoints(b.reward)
          );
      }
    });
  }, [items, q, category, affordable, sort]);

  const affordableCount = items.filter((i) => i.availability.state === "available").length;
  const filtersActive = q || category !== "all" || affordable;

  return (
    <div>
      <div className="sticky top-16 z-10 -mx-4 mb-6 border-b border-line bg-canvas/85 px-4 pb-4 pt-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-[76px] lg:-mx-10 lg:px-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <label htmlFor="reward-search" className="sr-only">
              Search rewards
            </label>
            <input
              id="reward-search"
              type="search"
              value={q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="Search gift cards, headphones, bookkeeping…"
              className="h-11 w-full rounded-control border border-line-strong bg-canvas-raised pl-10 pr-10 text-[15px] text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/25 [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <button
                type="button"
                onClick={() => update({ q: null })}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex h-11 flex-1 cursor-pointer items-center gap-3 rounded-control border border-line-strong bg-canvas-raised px-3.5 md:flex-none">
              <Switch
                id="affordable"
                checked={affordable}
                onCheckedChange={(v) => update({ affordable: v ? "1" : null })}
                aria-label="Only show rewards I can afford"
              />
              <span className="whitespace-nowrap text-sm text-ink-2">
                Affordable with my points <span className="num text-ink-3">({affordableCount})</span>
              </span>
            </label>
            <div className="w-44 shrink-0">
              <label htmlFor="sort" className="sr-only">
                Sort rewards
              </label>
              <Select id="sort" value={sort} onChange={(e) => update({ sort: e.target.value })}>
                {Object.entries(SORTS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
        <div className="scrollbar-none -mx-1 mt-3 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Filter by category">
          {(["all", ...Object.keys(CATEGORY_LABELS)] as (RewardCategory | "all")[]).map((c) => {
            const active = category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => update({ category: c })}
                aria-pressed={active}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold transition-colors",
                  active
                    ? "border-transparent bg-brand text-white shadow-[0_6px_18px_-8px_rgb(47_107_255/0.8)]"
                    : "border-line-strong text-ink-2 hover:border-[rgb(148_170_214/0.32)] hover:text-ink",
                )}
              >
                {c === "all" ? "All rewards" : CATEGORY_LABELS[c]}
                <span className={cn("num text-xs", active ? "text-white/70" : "text-ink-3")}>{counts[c] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {results.length} reward{results.length === 1 ? "" : "s"} shown
      </p>

      {results.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0">
          {results.map(({ reward, availability }, i) => (
            <li key={reward.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
              <RewardCard reward={reward} availability={availability} available={available} priority={i < 4} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<SearchX className="h-5 w-5" />}
          title={affordable && !q && category === "all" ? "Nothing within reach just yet" : "No rewards match"}
          description={
            affordable
              ? "Turn off “Affordable with my points” to see everything you're working toward."
              : "Try a different search or category."
          }
          action={
            filtersActive ? (
              <Button variant="secondary" onClick={() => update({ q: null, category: "all", affordable: null })}>
                Clear filters
              </Button>
            ) : null
          }
          className="rounded-card border border-dashed border-line-strong"
        />
      )}
    </div>
  );
}
