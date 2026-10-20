"use client";

import { useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { signInAsDemoUser } from "@/app/actions/merchant";
import { Badge } from "@/components/ui/primitives";
import { initials } from "@/lib/utils";

export function PersonaButton({
  userId,
  title,
  subtitle,
  meta,
  badge,
  tone,
  recommended,
}: {
  userId: string;
  title: string;
  subtitle: string;
  meta?: string;
  badge: string;
  tone: "gold" | "brand" | "neutral";
  recommended?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await signInAsDemoUser(userId);
          if (result && !result.ok) toast.error(result.error);
        })
      }
      className="group flex w-full items-center gap-3.5 rounded-2xl border border-line bg-surface/70 p-3.5 text-left transition-[border-color,background-color,transform] hover:border-line-strong hover:bg-surface-2 active:scale-[0.995] disabled:opacity-60"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-3 text-sm font-bold text-ink-2" aria-hidden>
        {initials(title)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-ink">{title}</span>
          {recommended && <span className="hidden text-[11px] font-medium text-brand-ink sm:inline">Start here</span>}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-ink-3">{subtitle}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={tone}>{badge}</Badge>
        {meta && <span className="num text-xs text-ink-3">{meta}</span>}
      </span>
      {pending ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-3" aria-label="Signing in" />
      ) : (
        <ArrowRight className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      )}
    </button>
  );
}
