import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "gold" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-[0_8px_24px_-8px_rgb(47_107_255/0.7),inset_0_1px_0_rgb(255_255_255/0.18)] hover:bg-brand-hover active:translate-y-px",
  secondary: "bg-surface-3 text-ink hover:bg-[#1e2d4c] shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]",
  outline: "border border-line-strong text-ink hover:bg-surface-2 hover:border-[rgb(148_170_214/0.3)]",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2",
  gold: "bg-gold text-[#1b1406] hover:bg-gold-ink shadow-[0_8px_24px_-10px_rgb(216_181_109/0.6)]",
  danger: "bg-danger-soft text-danger hover:bg-[rgb(244_113_116/0.2)] border border-[rgb(244_113_116/0.25)]",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-[10px]",
  md: "h-11 px-5 text-sm gap-2 rounded-control",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-control",
  icon: "h-10 w-10 rounded-control",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap font-semibold tracking-[-0.005em] transition-[background-color,color,border-color,box-shadow,transform] duration-150",
    "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
