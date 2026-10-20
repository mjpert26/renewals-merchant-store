"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateReferralStatusAction, closeSupportRequestAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import type { ReferralStatus } from "@/lib/domain/types";

const LABELS: Record<ReferralStatus, string> = {
  submitted: "Submitted",
  in_review: "In review",
  funded: "Funded (award bonus)",
  not_funded: "Not funded",
};

export function ReferralStatusControl({ referralId, status, businessName }: { referralId: string; status: ReferralStatus; businessName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={`Status for ${businessName}`}
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as ReferralStatus;
        if (next === "funded" && !window.confirm(`Mark ${businessName} funded? This awards the referral bonus and cannot be undone.`)) {
          e.target.value = status;
          return;
        }
        start(async () => {
          const r = await updateReferralStatusAction(referralId, next);
          if (r.ok) {
            toast.success(`${businessName}: ${LABELS[next]}`);
            router.refresh();
          } else toast.error(r.error);
        });
      }}
      className="h-9 rounded-[10px] border border-line-strong bg-canvas-raised px-2.5 text-[13px] text-ink focus:border-brand focus:outline-none"
    >
      {(Object.keys(LABELS) as ReferralStatus[]).map((s) => (
        <option key={s} value={s}>
          {LABELS[s]}
        </option>
      ))}
    </select>
  );
}

export function CloseCallbackButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await closeSupportRequestAction(id);
          if (r.ok) {
            toast.success("Marked as called");
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      Mark called
    </Button>
  );
}
