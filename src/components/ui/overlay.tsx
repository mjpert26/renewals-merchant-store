"use client";

import * as React from "react";
import { Dialog as RadixDialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const DialogRoot = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  hideClose,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  hideClose?: boolean;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[#02050c]/75 backdrop-blur-sm data-[state=open]:animate-[fade-up_0.2s_ease-out]" />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[22px] border border-line-strong bg-surface p-6 shadow-pop focus:outline-none sm:p-7",
          className,
        )}
      >
        <div className="mb-5 pr-8">
          <RadixDialog.Title className="text-lg font-semibold tracking-[-0.01em] text-ink">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="mt-1.5 text-sm leading-relaxed text-ink-3">{description}</RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">Dialog</RadixDialog.Description>
          )}
        </div>
        {children}
        {!hideClose && (
          <RadixDialog.Close
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </RadixDialog.Close>
        )}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function SheetContent({
  title,
  description,
  children,
  side = "right",
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  side?: "right" | "bottom";
  className?: string;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[#02050c]/70 backdrop-blur-sm" />
      <RadixDialog.Content
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden border-line-strong bg-surface shadow-pop focus:outline-none",
          side === "right"
            ? "inset-y-0 right-0 w-full max-w-xl border-l"
            : "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[24px] border-t pb-[env(safe-area-inset-bottom)]",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <RadixDialog.Title className="text-lg font-semibold tracking-[-0.01em] text-ink">{title}</RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="mt-1 text-sm text-ink-3">{description}</RadixDialog.Description>
            ) : (
              <RadixDialog.Description className="sr-only">Panel</RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </RadixDialog.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
