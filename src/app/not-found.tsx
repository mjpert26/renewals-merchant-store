import Link from "next/link";
import { Compass } from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <BrandLockup className="mb-12" />
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface text-ink-2" aria-hidden>
        <Compass className="h-6 w-6" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-ink">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-sm text-[15px] text-ink-2">
        The reward or claim may have moved, or the link may be incomplete.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className={buttonClasses("primary")}>
          Go to overview
        </Link>
        <Link href="/rewards" className={buttonClasses("secondary")}>
          Browse rewards
        </Link>
      </div>
    </div>
  );
}
