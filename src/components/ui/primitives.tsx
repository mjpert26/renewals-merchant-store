import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-card border border-line bg-surface/80 shadow-card backdrop-blur-[2px]", className)}
      {...props}
    />
  );
}

export function SectionHeader({
  title,
  description,
  action,
  id,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-3">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-ink">{eyebrow}</p>}
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[32px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {action}
    </header>
  );
}

type Tone = "neutral" | "brand" | "gold" | "success" | "warn" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-2 border-line",
  brand: "bg-brand-soft text-brand-ink border-[rgb(47_107_255/0.25)]",
  gold: "bg-gold-soft text-gold-ink border-[rgb(216_181_109/0.28)]",
  success: "bg-success-soft text-success border-[rgb(60_207_145/0.25)]",
  warn: "bg-warn-soft text-warn border-[rgb(242_184_75/0.25)]",
  danger: "bg-danger-soft text-danger border-[rgb(244_113_116/0.25)]",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface-2 text-ink-2">{icon}</div>
      )}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-3">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "brand",
  icon,
  title,
  children,
  action,
  className,
}: {
  tone?: "brand" | "warn" | "danger" | "success" | "gold";
  icon?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    brand: "border-[rgb(47_107_255/0.25)] bg-brand-soft/60 text-brand-ink",
    warn: "border-[rgb(242_184_75/0.25)] bg-warn-soft text-warn",
    danger: "border-[rgb(244_113_116/0.3)] bg-danger-soft text-danger",
    success: "border-[rgb(60_207_145/0.25)] bg-success-soft text-success",
    gold: "border-[rgb(216_181_109/0.28)] bg-gold-soft text-gold-ink",
  } as const;
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3.5", tones[tone], className)} role="status">
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className="text-ink-2">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Progress({
  value,
  label,
  tone = "brand",
  className,
}: {
  value: number;
  label: string;
  tone?: "brand" | "gold";
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-white/[0.07]", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out",
          tone === "gold"
            ? "bg-[linear-gradient(90deg,#b8934a,#ead29c)]"
            : "bg-[linear-gradient(90deg,#2f6bff,#7aa2ff)]",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Stat({ label, value, hint, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p className="num mt-1 text-xl font-semibold tracking-[-0.02em] text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-line-strong bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-3">{children}</kbd>;
}
