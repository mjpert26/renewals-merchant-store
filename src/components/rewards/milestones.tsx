import { Check } from "lucide-react";
import type { MilestoneStatus } from "@/lib/domain/milestones";
import { cn, formatDate, formatPoints } from "@/lib/utils";

export function MilestoneList({ milestones, layout = "grid" }: { milestones: MilestoneStatus[]; layout?: "grid" | "list" }) {
  return (
    <ol className={cn(layout === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-1")}>
      {milestones.map((m) => {
        const done = !!m.achievedAt;
        return (
          <li
            key={m.code}
            className={cn(
              "flex items-start gap-3.5",
              layout === "grid" ? "rounded-2xl border p-4" : "rounded-xl px-1 py-2.5",
              layout === "grid" && (done ? "border-[rgb(60_207_145/0.2)] bg-success-soft/40" : "border-line bg-surface-2/40"),
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border",
                done ? "border-transparent bg-success text-[#04150d]" : "border-dashed border-line-strong text-ink-3",
              )}
              aria-hidden
            >
              {done ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
            </span>
            <div className="min-w-0">
              <p className={cn("text-sm font-semibold", done ? "text-ink" : "text-ink-2")}>
                {m.title}
                <span className="sr-only">{done ? " (achieved)" : " (not yet achieved)"}</span>
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
                {done ? (
                  <>
                    {formatDate(m.achievedAt!, "short")}
                    {m.pointsAwarded ? <span className="num text-success"> · +{formatPoints(m.pointsAwarded)} pts</span> : null}
                  </>
                ) : m.expectedAt ? (
                  <>
                    Expected {formatDate(m.expectedAt, "short")}
                    {m.bonusPoints > 0 && <span className="num"> · +{formatPoints(m.bonusPoints)} pts</span>}
                  </>
                ) : (
                  <>
                    {m.description}
                    {m.bonusPoints > 0 && <span className="num"> · +{formatPoints(m.bonusPoints)} pts</span>}
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
