import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <defs>
        <linearGradient id="btc-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4b80ff" />
          <stop offset="1" stopColor="#1f4fd6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#btc-mark)" />
      <rect x="0.5" y="0.5" width="39" height="39" rx="10.5" fill="none" stroke="white" strokeOpacity="0.18" />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight="800"
        fontSize="12.5"
        letterSpacing="0.4"
        fill="white"
      >
        BTC
      </text>
    </svg>
  );
}

export function BrandLockup({ subtitle = "Rewards", className }: { subtitle?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark />
      <div className="leading-tight">
        <p className="text-[15px] font-bold tracking-[-0.01em] text-ink">Big Think Capital</p>
        <p className="text-xs font-medium text-ink-3">{subtitle}</p>
      </div>
    </div>
  );
}
