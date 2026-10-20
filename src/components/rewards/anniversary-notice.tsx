"use client";

import { useOptimistic, useTransition } from "react";
import { PartyPopper, X } from "lucide-react";
import { toast } from "sonner";
import { dismissNoticeAction } from "@/app/actions/merchant";
import { Button } from "@/components/ui/button";
import { formatPoints } from "@/lib/utils";

export function AnniversaryNotice({ points }: { points: number }) {
  const [hidden, setHidden] = useOptimistic(false);
  const [pending, start] = useTransition();
  function dismissNotice() {
    start(async () => {
      setHidden(true);
      const result = await dismissNoticeAction("anniversary_1");
      if (!result.ok) toast.error(result.error);
    });
  }
  if (hidden) return null;
  return (
    <div
      role="status"
      className="relative flex items-start gap-3.5 overflow-hidden rounded-[20px] border border-[rgb(216_181_109/0.25)] bg-[linear-gradient(100deg,rgb(216_181_109/0.14),rgb(47_107_255/0.08)_60%,transparent)] p-4 sm:items-center sm:gap-4 sm:p-5"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-ink sm:h-11 sm:w-11 sm:rounded-2xl" aria-hidden>
        <PartyPopper className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink">Happy 1-year anniversary with Big Think Capital</p>
        <p className="mt-0.5 text-[13px] text-ink-2 sm:text-sm">
          Thank you for growing with us. We added <span className="num font-semibold text-gold-ink">{formatPoints(points)} bonus points</span>{" "}
          to your balance.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="hidden sm:inline-flex"
        loading={pending}
        onClick={dismissNotice}
      >
        Dismiss
      </Button>
      <button
        type="button"
        onClick={dismissNotice}
        disabled={pending}
        aria-label="Dismiss anniversary message"
        className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink sm:hidden"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
