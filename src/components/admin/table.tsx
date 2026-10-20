import { cn } from "@/lib/utils";

export function DataTable({ children, className, label }: { children: React.ReactNode; className?: string; label: string }) {
  return (
    <div className={cn("relative overflow-x-auto rounded-card border border-line bg-surface/80 shadow-card", className)} role="region" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink-3", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("border-b border-line px-4 py-3.5 align-middle text-ink-2", className)}>{children}</td>;
}
