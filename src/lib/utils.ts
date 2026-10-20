import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPoints(points: number) {
  return Math.abs(points).toLocaleString("en-US");
}

export function signedPoints(points: number) {
  if (points === 0) return "0";
  return `${points > 0 ? "+" : "−"}${formatPoints(points)}`;
}

export function formatUsd(cents: number, opts: { cents?: boolean } = {}) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts.cents ? 2 : 0,
  });
}

const TZ = "America/New_York";

export function formatDate(iso: string, style: "short" | "medium" | "long" = "medium") {
  const d = new Date(iso);
  if (style === "short") return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: TZ });
  if (style === "long") return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: TZ });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });
}

export function relativeDays(iso: string, now = new Date()) {
  const days = Math.round((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} wk ago`;
  return formatDate(iso);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
