import {
  LayoutGrid,
  Gift,
  Activity,
  PackageCheck,
  Crown,
  Users,
  LifeBuoy,
  Inbox,
  Store,
  Settings2,
  ScrollText,
  Gauge,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short?: string;
  icon: LucideIcon;
  match?: (path: string) => boolean;
}

export const MERCHANT_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Rewards",
    items: [
      { href: "/", label: "Overview", icon: LayoutGrid, match: (p) => p === "/" },
      { href: "/rewards", label: "Rewards catalog", short: "Rewards", icon: Gift },
      { href: "/activity", label: "Points activity", short: "Activity", icon: Activity },
      { href: "/claims", label: "Claim history", short: "Claims", icon: PackageCheck },
      { href: "/benefits", label: "Member benefits", short: "Benefits", icon: Crown },
      { href: "/referrals", label: "Refer a business", short: "Refer", icon: Users },
    ],
  },
  {
    group: "Support",
    items: [{ href: "/help", label: "Help & preferences", short: "Help", icon: LifeBuoy }],
  },
];

export const ADMIN_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Operations",
    items: [
      { href: "/admin", label: "Dashboard", icon: Gauge, match: (p) => p === "/admin" },
      { href: "/admin/claims", label: "Claims queue", icon: Inbox },
      { href: "/admin/merchants", label: "Merchants", icon: Store },
      { href: "/admin/referrals", label: "Referrals & callbacks", icon: Users },
    ],
  },
  {
    group: "Program",
    items: [
      { href: "/admin/rewards", label: "Reward catalog", icon: Gift },
      { href: "/admin/settings", label: "Program settings", icon: Settings2 },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    ],
  },
];

export function isActive(item: NavItem, path: string) {
  if (item.match) return item.match(path);
  return path === item.href || path.startsWith(`${item.href}/`);
}
