import { Banknote, Gift, Clock3, Sparkles, Undo2, SlidersHorizontal, Hourglass, MinusCircle, CircleCheck } from "lucide-react";
import type { LedgerEntry, LedgerEntryType } from "@/lib/domain/types";
import { Badge } from "@/components/ui/primitives";
import { cn, formatDate, formatPoints } from "@/lib/utils";

export const ENTRY_META: Record<
  LedgerEntryType,
  { label: string; icon: typeof Banknote; tone: "brand" | "gold" | "success" | "warn" | "neutral" | "danger" }
> = {
  earn_pending: { label: "Pending", icon: Clock3, tone: "warn" },
  release: { label: "Released", icon: CircleCheck, tone: "success" },
  pending_reversal: { label: "Removed", icon: MinusCircle, tone: "danger" },
  bonus: { label: "Bonus", icon: Sparkles, tone: "gold" },
  redeem: { label: "Redeemed", icon: Gift, tone: "brand" },
  refund: { label: "Returned", icon: Undo2, tone: "success" },
  adjustment: { label: "Adjustment", icon: SlidersHorizontal, tone: "neutral" },
  expiration: { label: "Expired", icon: Hourglass, tone: "danger" },
};

export const ACTIVITY_FILTERS: { id: string; label: string; types: LedgerEntryType[] }[] = [
  { id: "all", label: "All", types: [] },
  { id: "funding", label: "Funding", types: ["earn_pending", "release", "pending_reversal"] },
  { id: "bonus", label: "Bonuses", types: ["bonus"] },
  { id: "redeem", label: "Redemptions", types: ["redeem", "refund"] },
  { id: "adjust", label: "Adjustments", types: ["adjustment", "expiration"] },
];

const ICON_TONES = {
  brand: "bg-brand-soft text-brand-ink",
  gold: "bg-gold-soft text-gold-ink",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  neutral: "bg-surface-3 text-ink-2",
  danger: "bg-danger-soft text-danger",
};

/** The amount a merchant should see for an entry: pending changes for pending entries, spendable changes otherwise. */
export function displayAmount(entry: LedgerEntry) {
  if (entry.type === "earn_pending" || entry.type === "pending_reversal") return entry.pendingDelta;
  return entry.availableDelta;
}

export function ActivityRow({ entry, compact }: { entry: LedgerEntry; compact?: boolean }) {
  const meta = ENTRY_META[entry.type];
  const Icon = meta.icon;
  const amount = displayAmount(entry);
  const isPending = entry.type === "earn_pending";
  return (
    <li className={cn("flex items-center gap-3.5", compact ? "py-3" : "py-4")}>
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", ICON_TONES[meta.tone])} aria-hidden>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{entry.title}</p>
        <p className="mt-0.5 truncate text-[13px] text-ink-3">
          <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
          {entry.detail && <> · {entry.detail}</>}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p
          className={cn(
            "num text-[15px] font-bold",
            isPending ? "text-warn" : amount > 0 ? "text-success" : amount < 0 ? "text-ink" : "text-ink-3",
          )}
        >
          <span className="sr-only">{amount >= 0 ? "plus" : "minus"} </span>
          <span aria-hidden>{amount >= 0 ? "+" : "−"}</span>
          {formatPoints(amount)}
        </p>
        {!compact && <Badge tone={meta.tone}>{meta.label}</Badge>}
        {compact && isPending && <span className="text-[11px] font-medium text-warn">Pending</span>}
      </div>
    </li>
  );
}
