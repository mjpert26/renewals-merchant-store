"use client";

// Adapted from React Bits Pro "credit-card" (@reactbits-starter/credit-card-tw).
// Kept: the pointer-driven 3D tilt, parallax content layer and moving shine.
// Changed for this product: no card number/CVV/flip, no `touch-none` (so the
// page still scrolls on phones), tilt only for fine pointers, a static card
// when the user prefers reduced motion, no `motion` dependency, and fluid width.

import { useCallback, useEffect, useRef, useState } from "react";
import type { TierId } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand";

const FINISHES: Record<TierId, { background: string; foil: string; label: string; ink: string }> = {
  silver: {
    background:
      "radial-gradient(120% 140% at 0% 0%, #3a4a68 0%, #1b2740 45%, #0c1426 100%)",
    foil: "linear-gradient(115deg, #c9d3e6 0%, #8e9bb6 45%, #e6ecf7 100%)",
    label: "Silver Member",
    ink: "#dfe6f4",
  },
  gold: {
    background:
      "radial-gradient(120% 140% at 0% 0%, #2a3a63 0%, #121d38 48%, #070d1c 100%)",
    foil: "linear-gradient(115deg, #a8823f 0%, #ead29c 42%, #b8934a 70%, #f3e2b8 100%)",
    label: "Gold Member",
    ink: "#ead29c",
  },
  platinum: {
    background:
      "radial-gradient(120% 140% at 0% 0%, #404b5f 0%, #1c2433 50%, #0b0f18 100%)",
    foil: "linear-gradient(115deg, #b9c6d9 0%, #ffffff 40%, #9fb0c8 70%, #e9eef6 100%)",
    label: "Platinum Member",
    ink: "#eef2f8",
  },
};

export interface MembershipCardProps {
  tier: TierId;
  businessName: string;
  memberName: string;
  memberSince: string;
  memberNumber: string;
  className?: string;
}

export function MembershipCard({ tier, businessName, memberName, memberSince, memberNumber, className }: MembershipCardProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [interactive, setInteractive] = useState(false);
  const finish = FINISHES[tier];

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setInteractive(fine.matches && !reduce.matches);
    update();
    fine.addEventListener("change", update);
    reduce.addEventListener("change", update);
    return () => {
      fine.removeEventListener("change", update);
      reduce.removeEventListener("change", update);
    };
  }, []);

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive || e.pointerType !== "mouse") return;
      const wrapper = wrapperRef.current;
      const card = cardRef.current;
      if (!wrapper || !card) return;
      const b = wrapper.getBoundingClientRect();
      const px = (e.clientX - b.left) / b.width; // 0..1
      const py = (e.clientY - b.top) / b.height;
      const tiltX = (0.5 - py) * 10;
      const tiltY = (px - 0.5) * 14;
      card.style.transform = `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale3d(1.02,1.02,1.02)`;
      if (shineRef.current) {
        const angle = Math.atan2(py - 0.5, px - 0.5) * (180 / Math.PI) - 90;
        shineRef.current.style.opacity = "1";
        shineRef.current.style.background = `linear-gradient(${angle}deg, rgba(255,255,255,${(0.05 + py * 0.22).toFixed(3)}) 0%, rgba(255,255,255,0) 70%)`;
      }
      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(${((px - 0.5) * 6).toFixed(2)}px, ${((py - 0.5) * 6).toFixed(2)}px, 0)`;
      }
    },
    [interactive],
  );

  const reset = useCallback(() => {
    if (cardRef.current) cardRef.current.style.transform = "";
    if (shineRef.current) shineRef.current.style.opacity = "0";
    if (contentRef.current) contentRef.current.style.transform = "";
  }, []);

  return (
    <div
      ref={wrapperRef}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={cn("relative aspect-[1.586] w-full [perspective:1100px]", className)}
      role="img"
      aria-label={`${finish.label} card for ${businessName}, member since ${memberSince}`}
    >
      <div
        ref={cardRef}
        className="relative h-full w-full overflow-hidden rounded-[18px] transition-transform duration-300 ease-out [transform-style:preserve-3d] will-change-transform"
      >
        <div
          className="absolute inset-0 rounded-[18px] shadow-[0_30px_60px_-25px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)_inset]"
          style={{ background: finish.background }}
          aria-hidden
        />
        {/* Fine guilloché texture */}
        <div
          className="absolute inset-0 rounded-[18px] opacity-[0.22] mix-blend-soft-light"
          style={{
            backgroundImage:
              "repeating-radial-gradient(circle at 85% 120%, rgba(255,255,255,0.35) 0 1px, transparent 1px 7px)",
          }}
          aria-hidden
        />
        {/* Foil band */}
        <div
          className="absolute -right-10 top-0 h-full w-1/2 skew-x-[-18deg] opacity-[0.16]"
          style={{ background: finish.foil }}
          aria-hidden
        />
        <div
          ref={contentRef}
          className="relative flex h-full flex-col justify-between p-[7%] transition-transform duration-300 ease-out"
          aria-hidden
        >
          <div className="flex items-start justify-between">
            <BrandMark className="h-8 w-8" />
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1b1406]"
              style={{ background: finish.foil }}
            >
              {finish.label}
            </span>
          </div>
          <div>
            <div
              className="mb-3 h-7 w-10 rounded-[6px] opacity-90"
              style={{ background: finish.foil, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)" }}
            />
            <p className="truncate text-[clamp(15px,2.2vw,19px)] font-semibold tracking-[-0.01em]" style={{ color: finish.ink }}>
              {businessName}
            </p>
            <div className="mt-2 flex items-end justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-white/55">
              <div className="min-w-0">
                <p>Member</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold normal-case tracking-normal text-white/90">{memberName}</p>
              </div>
              <div className="text-right">
                <p>Since</p>
                <p className="num mt-0.5 text-[11px] font-semibold tracking-normal text-white/90">{memberSince}</p>
              </div>
              <div className="hidden text-right min-[420px]:block">
                <p>No.</p>
                <p className="num mt-0.5 font-mono text-[11px] font-semibold tracking-normal text-white/90">{memberNumber}</p>
              </div>
            </div>
          </div>
        </div>
        <div
          ref={shineRef}
          className="pointer-events-none absolute inset-0 rounded-[18px] opacity-0 transition-opacity duration-300"
          aria-hidden
        />
      </div>
    </div>
  );
}
