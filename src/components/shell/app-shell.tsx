"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { DropdownMenu, Dialog as RadixDialog } from "radix-ui";
import { ChevronDown, LogOut, Repeat, MoreHorizontal, ShieldCheck, Sparkles } from "lucide-react";
import { BrandLockup, BrandMark } from "@/components/brand";
import { SheetContent } from "@/components/ui/overlay";
import { cn, formatPoints, initials } from "@/lib/utils";
import { signOut } from "@/app/actions/merchant";
import { ADMIN_NAV, MERCHANT_NAV, isActive, type NavItem } from "./nav";

export interface ShellAccount {
  name: string;
  subtitle: string;
  tierLabel?: string;
  points?: number;
}

function SidebarLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors",
        active ? "bg-brand-soft text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      {active && <span className="absolute -left-3 top-2 h-6 w-[3px] rounded-r-full bg-brand" aria-hidden />}
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-brand-ink" : "text-ink-3 group-hover:text-ink-2")} aria-hidden />
      {item.label}
    </Link>
  );
}

function AccountMenu({ account, area }: { account: ShellAccount; area: "merchant" | "admin" }) {
  const [pending, start] = useTransition();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="flex h-11 items-center gap-2.5 rounded-full border border-line bg-surface/70 py-1 pl-1 pr-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2 sm:pr-3"
        aria-label={`Account menu for ${account.name}`}
      >
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold",
            area === "admin" ? "bg-brand-soft text-brand-ink" : "bg-gold-soft text-gold-ink",
          )}
          aria-hidden
        >
          {initials(account.name)}
        </span>
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block max-w-[180px] truncate text-[13px] font-semibold text-ink">{account.name}</span>
          <span className="block max-w-[180px] truncate text-[11px] text-ink-3">{account.subtitle}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-ink-3" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-64 rounded-2xl border border-line-strong bg-surface-2 p-1.5 shadow-pop"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-ink">{account.name}</p>
            <p className="truncate text-xs text-ink-3">{account.subtitle}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild>
            <Link
              href="/login"
              className="flex h-10 cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-sm text-ink-2 outline-none data-[highlighted]:bg-surface-3 data-[highlighted]:text-ink"
            >
              <Repeat className="h-4 w-4" aria-hidden /> Switch demo account
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              start(() => signOut());
            }}
            disabled={pending}
            className="flex h-10 cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-sm text-ink-2 outline-none data-[highlighted]:bg-surface-3 data-[highlighted]:text-ink"
          >
            <LogOut className="h-4 w-4" aria-hidden /> {pending ? "Signing out…" : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function AppShell({
  area,
  account,
  demo,
  children,
}: {
  area: "merchant" | "admin";
  account: ShellAccount;
  demo: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = area === "admin" ? ADMIN_NAV : MERCHANT_NAV;
  const [moreOpen, setMoreOpen] = useState(false);
  const flat = nav.flatMap((g) => g.items);
  const tabs = area === "merchant" ? flat.slice(0, 4) : flat.slice(0, 4);
  const overflow = flat.filter((i) => !tabs.includes(i));
  const overflowActive = overflow.some((i) => isActive(i, pathname));

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-line bg-canvas-raised/80 backdrop-blur-xl lg:flex">
        <div className="flex h-[76px] items-center px-6">
          <Link href={area === "admin" ? "/admin" : "/"} className="rounded-lg" aria-label="Big Think Capital home">
            <BrandLockup subtitle={area === "admin" ? "Rewards Admin" : "Client Rewards"} />
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 pb-6 pt-2" aria-label="Primary">
          {nav.map((group) => (
            <div key={group.group} className="mb-6">
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{group.group}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <SidebarLink item={item} active={isActive(item, pathname)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          {area === "merchant" ? (
            <div className="rounded-2xl border border-[rgb(216_181_109/0.2)] bg-[linear-gradient(135deg,rgb(216_181_109/0.12),rgb(216_181_109/0.02))] p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-gold-ink">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Renewing soon?
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">Every renewal earns new points. Your account team can walk you through options.</p>
              <Link href="/help#contact" className="mt-2.5 inline-block text-xs font-semibold text-ink underline-offset-4 hover:underline">
                Talk to your team
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-3.5 text-xs text-ink-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-brand-ink" aria-hidden />
              Staff area. Every change is recorded in the audit log.
            </div>
          )}
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        {/* Compact account header */}
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/75 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:h-[76px] lg:px-10">
            <Link href={area === "admin" ? "/admin" : "/"} className="rounded-lg lg:hidden" aria-label="Home">
              <BrandMark />
            </Link>
            {demo && (
              <span className="hidden rounded-full border border-line-strong px-2.5 py-1 text-[11px] font-medium text-ink-3 sm:inline">
                Demo environment · sample data
              </span>
            )}
            {area === "admin" && (
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-ink">Staff</span>
            )}
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              {area === "merchant" && typeof account.points === "number" && (
                <Link
                  href="/activity"
                  className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 text-[13px] transition-colors hover:border-line-strong"
                  aria-label={`${formatPoints(account.points)} points available. View points activity.`}
                >
                  <span className="h-2 w-2 rounded-full bg-gold shadow-[0_0_10px_rgb(216_181_109/0.8)]" aria-hidden />
                  <span className="num font-semibold text-ink">{formatPoints(account.points)}</span>
                  <span className="text-ink-3">pts</span>
                </Link>
              )}
              <AccountMenu account={account} area={area} />
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-[1240px] px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pb-16 lg:pt-10">
          {children}
        </main>
      </div>

      {/* Mobile tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas-raised/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    active ? "text-ink" : "text-ink-3",
                  )}
                >
                  <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-brand-soft")}>
                    <Icon className={cn("h-[19px] w-[19px]", active && "text-brand-ink")} aria-hidden />
                  </span>
                  {item.short ?? item.label.split(" ")[0]}
                </Link>
              </li>
            );
          })}
          <li>
            <RadixDialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
              <RadixDialog.Trigger
                className={cn(
                  "flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  overflowActive ? "text-ink" : "text-ink-3",
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full", overflowActive && "bg-brand-soft")}>
                  <MoreHorizontal className={cn("h-[19px] w-[19px]", overflowActive && "text-brand-ink")} aria-hidden />
                </span>
                More
              </RadixDialog.Trigger>
              <SheetContent side="bottom" title="More">
                <ul className="space-y-1">
                  {overflow.map((item) => (
                    <li key={item.href}>
                      <SidebarLink item={item} active={isActive(item, pathname)} onNavigate={() => setMoreOpen(false)} />
                    </li>
                  ))}
                </ul>
              </SheetContent>
            </RadixDialog.Root>
          </li>
        </ul>
      </nav>
    </div>
  );
}
