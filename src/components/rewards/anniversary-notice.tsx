"use client";

import { useOptimistic, useTransition } from "react";
import { PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { dismissNoticeAction } from "@/app/actions/merchant";
import { Button } from "@/components/ui/button";
import { formatPoints } from "@/lib/utils";

export function AnniversaryNotice({ points }: { points: number }) {
  const [hidden, setHidden] = useOptimistic(false);
  const [pending, start] = useTransition();
  if (hidden) return null;
  return (
    <div
      role="status"
      className="relative flex flex-col gap-4 overflow-hidden rounded-[20px] border border-[rgb(216_181_109/0.25)] bg-[linear-gradient(100deg,rgb(216_181_109/0.14),rgb(47_107_255/0.08)_60%,transparent)] p-5 sm:flex-row sm:items-center"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-soft text-gold-ink" aria-hidden>
        <PartyPopper className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">Happy 1-year anniversary with Big Think Capital</p>
        <p className="mt-0.5 text-sm text-ink-2">
          Thank you for growing with us. We added <span className="num font-semibold text-gold-ink">{formatPoints(points)} bonus points</span>{" "}
          to your balance.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        loading={pending}
        onClick={() =>
          start(async () => {
            setHidden(true);
            const result = await dismissNoticeAction("anniversary_1");
            if (!result.ok) toast.error(result.error);
          })
        }
      >
        Dismiss
      </Button>
    </div>
  );
}
