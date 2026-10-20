import { Check, X } from "lucide-react";
import type { Redemption, RedemptionStatus } from "@/lib/domain/types";
import { STATUS_LABELS } from "@/lib/domain/status-labels";
import { Badge } from "@/components/ui/primitives";
import { cn, formatDateTime } from "@/lib/utils";

export function statusTone(status: RedemptionStatus) {
  if (status === "fulfilled") return "success" as const;
  if (status === "canceled" || status === "failed") return "danger" as const;
  if (status === "shipped") return "gold" as const;
  return "brand" as const;
}

export function ClaimStatusBadge({ status }: { status: RedemptionStatus }) {
  return (
    <Badge tone={statusTone(status)} dot>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

/** Horizontal progress for a claim, adapted to its delivery method. */
export function ClaimProgress({ claim }: { claim: Redemption }) {
  const steps: RedemptionStatus[] =
    claim.deliveryMethod === "shipped" ? ["requested", "processing", "shipped", "fulfilled"] : ["requested", "processing", "fulfilled"];
  const terminalBad = claim.status === "canceled" || claim.status === "failed";
  const reached = new Set(claim.events.map((e) => e.status));
  const currentIndex = terminalBad ? -1 : steps.indexOf(claim.status);
  const labels: Partial<Record<RedemptionStatus, string>> = {
    requested: "Requested",
    processing: "Preparing",
    shipped: "Shipped",
    fulfilled: claim.deliveryMethod === "donation" ? "Donated" : claim.deliveryMethod === "scheduled" ? "Scheduled" : "Delivered",
  };

  if (terminalBad) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[rgb(244_113_116/0.25)] bg-danger-soft p-4">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-danger text-[#1c0507]" aria-hidden>
          <X className="h-4 w-4" strokeWidth={3} />
        </span>
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink">{STATUS_LABELS[claim.status]}.</span> Your{" "}
          {claim.pointsCost.toLocaleString()} points were returned to your balance.
        </p>
      </div>
    );
  }

  return (
    <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Claim progress">
      {steps.map((step, i) => {
        const done = i < currentIndex || (i === currentIndex && step === "fulfilled") || (reached.has(step) && i <= currentIndex);
        const current = i === currentIndex && step !== "fulfilled";
        return (
          <li key={step} className="relative flex flex-col items-center text-center" aria-current={current ? "step" : undefined}>
            {i > 0 && (
              <span
                className={cn("absolute left-[calc(-50%+20px)] right-[calc(50%+20px)] top-[15px] h-0.5 rounded-full", i <= currentIndex ? "bg-brand" : "bg-line-strong")}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-[1] grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold",
                done ? "border-brand bg-brand text-white" : current ? "border-brand bg-canvas text-brand-ink" : "border-line-strong bg-canvas text-ink-3",
              )}
            >
              {done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span className={cn("mt-2 text-xs font-medium", done || current ? "text-ink" : "text-ink-3")}>{labels[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ClaimTimeline({ claim }: { claim: Redemption }) {
  return (
    <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line-strong">
      {[...claim.events].reverse().map((e, i) => (
        <li key={e.id} className="relative pl-8">
          <span
            className={cn(
              "absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-2",
              i === 0 ? "border-brand bg-brand shadow-[0_0_0_4px_rgb(47_107_255/0.18)]" : "border-line-strong bg-canvas",
            )}
            aria-hidden
          />
          <p className="text-sm font-semibold text-ink">{STATUS_LABELS[e.status]}</p>
          <p className="text-xs text-ink-3">
            <time dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
          </p>
          {e.note && <p className="mt-1 text-sm leading-relaxed text-ink-2">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}
