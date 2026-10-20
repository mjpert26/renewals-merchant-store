"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Clock3, Lock, PackageX, Sparkles } from "lucide-react";
import type { Reward } from "@/lib/domain/types";
import type { Availability } from "@/lib/domain/catalog-helpers";
import { redeemAction } from "@/app/actions/merchant";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { DialogContent, DialogRoot } from "@/components/ui/overlay";
import { Notice, Progress } from "@/components/ui/primitives";
import { cn, formatPoints, formatUsd } from "@/lib/utils";

interface Props {
  reward: Reward;
  availability: Availability;
  available: number;
  pending: number;
  lifetimeEarned: number;
  requiredTier: { name: string; threshold: number };
  releaseRule: string;
  defaults: { email: string; recipient: string; city: string; state: string };
}

type Errors = Partial<Record<"email" | "recipient" | "line1" | "city" | "state" | "postalCode" | "option", string>>;

export function RedeemPanel({ reward, availability, available, pending, lifetimeEarned, requiredTier, releaseRule, defaults }: Props) {
  const router = useRouter();
  const firstAffordable = reward.variants.find((v) => v.pointsCost <= available) ?? reward.variants[0];
  const [variantId, setVariantId] = useState(firstAffordable.id);
  const variant = reward.variants.find((v) => v.id === variantId) ?? reward.variants[0];

  const [email, setEmail] = useState(defaults.email);
  const [address, setAddress] = useState({ recipient: defaults.recipient, line1: "", line2: "", city: defaults.city, state: defaults.state, postalCode: "" });
  const [option, setOption] = useState("");
  const [timing, setTiming] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pendingSubmit, start] = useTransition();
  const idempotencyKey = useRef<string | null>(null);

  const blocked = availability.state === "tier_locked" || availability.state === "out_of_stock" || availability.state === "inactive";
  const shortBy = Math.max(0, variant.pointsCost - available);
  const after = available - variant.pointsCost;

  const deliveryLabel = useMemo(() => {
    switch (reward.deliveryMethod) {
      case "digital_email":
        return `Email to ${email}`;
      case "shipped":
        return [address.recipient, address.line1, address.line2, `${address.city}, ${address.state.toUpperCase()} ${address.postalCode}`]
          .filter(Boolean)
          .join(", ");
      case "scheduled":
        return "Our concierge will contact you to schedule";
      case "account_credit":
        return "Applied to your account with our partner";
      default:
        return "Donated in your business's name";
    }
  }, [reward.deliveryMethod, email, address]);

  function validate(): boolean {
    const e: Errors = {};
    if (reward.deliveryMethod === "digital_email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Enter a valid email address.";
    if (reward.deliveryMethod === "shipped") {
      if (address.recipient.trim().length < 2) e.recipient = "Enter the recipient's name.";
      if (address.line1.trim().length < 3) e.line1 = "Enter a street address.";
      if (address.city.trim().length < 2) e.city = "Enter a city.";
      if (!/^[A-Za-z]{2}$/.test(address.state.trim())) e.state = "Two-letter code.";
      if (!/^\d{5}(-\d{4})?$/.test(address.postalCode.trim())) e.postalCode = "Enter a valid ZIP.";
    }
    if (reward.optionField && !option) e.option = `Choose ${reward.optionField.label.toLowerCase()}.`;
    setErrors(e);
    if (Object.keys(e).length) {
      const first = document.getElementById(`redeem-${Object.keys(e)[0]}`);
      first?.focus();
      return false;
    }
    return true;
  }

  function openReview() {
    if (!validate()) return;
    setServerError(null);
    idempotencyKey.current = crypto.randomUUID();
    setOpen(true);
  }

  function confirm() {
    start(async () => {
      setServerError(null);
      const result = await redeemAction({
        rewardId: reward.id,
        variantId: variant.id,
        expectedCost: variant.pointsCost,
        // The same key is reused if this confirmation is retried, so a
        // double-click or a flaky connection can never create two claims.
        idempotencyKey: idempotencyKey.current,
        details: {
          deliveryEmail: reward.deliveryMethod === "digital_email" ? email.trim() : undefined,
          shippingAddress:
            reward.deliveryMethod === "shipped"
              ? {
                  recipient: address.recipient.trim(),
                  line1: address.line1.trim(),
                  line2: address.line2.trim() || undefined,
                  city: address.city.trim(),
                  state: address.state.trim().toUpperCase(),
                  postalCode: address.postalCode.trim(),
                }
              : undefined,
          optionValue: option || undefined,
          preferredTiming: timing.trim() || undefined,
          note: note.trim() || undefined,
        },
      });
      if (result.ok) {
        router.push(`/claims/${result.data.redemptionId}?new=1`);
        return;
      }
      setServerError(result.error);
      // Balances, stock or prices changed underneath us: refresh the page data.
      if (["insufficient_points", "out_of_stock", "reward_unavailable", "invalid_input", "tier_locked"].includes(result.code)) {
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-6 rounded-[22px] border border-line bg-surface/80 p-5 shadow-card sm:p-6">
      {/* Price options */}
      {reward.variants.length > 1 ? (
        <fieldset>
          <legend className="mb-2.5 text-[13px] font-medium text-ink-2">Choose an amount</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {reward.variants.map((v) => {
              const selected = v.id === variantId;
              const tooMuch = v.pointsCost > available;
              return (
                <label
                  key={v.id}
                  className={cn(
                    "relative flex cursor-pointer flex-col rounded-2xl border p-3.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-ink",
                    selected ? "border-brand bg-brand-soft" : "border-line-strong hover:border-[rgb(148_170_214/0.32)]",
                  )}
                >
                  <input
                    type="radio"
                    name="variant"
                    value={v.id}
                    checked={selected}
                    onChange={() => setVariantId(v.id)}
                    className="sr-only"
                  />
                  <span className="text-[15px] font-semibold text-ink">{v.valueCents ? formatUsd(v.valueCents) : v.label}</span>
                  <span className={cn("num mt-0.5 text-[13px]", tooMuch ? "text-ink-3" : "text-ink-2")}>{formatPoints(v.pointsCost)} pts</span>
                  {tooMuch && !blocked && <span className="mt-1 text-[11px] text-ink-3">Need {formatPoints(v.pointsCost - available)} more</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-medium text-ink-2">Price</p>
          <p className="num text-2xl font-bold tracking-[-0.02em] text-ink">
            {formatPoints(variant.pointsCost)} <span className="text-sm font-medium text-ink-3">pts</span>
          </p>
        </div>
      )}

      {/* Eligibility states */}
      <div className="mt-5">
        {availability.state === "tier_locked" ? (
          <Notice tone="gold" icon={<Lock className="h-4 w-4" />} title={`Unlocks at ${requiredTier.name}`}>
            {requiredTier.name} status starts at {formatPoints(requiredTier.threshold)} lifetime points. You&apos;re{" "}
            <span className="num font-semibold text-ink">{formatPoints(Math.max(0, requiredTier.threshold - lifetimeEarned))}</span> away.
            Renewals and referrals get you there faster.
            <Progress value={lifetimeEarned / requiredTier.threshold} tone="gold" label={`Progress to ${requiredTier.name}`} className="mt-3" />
          </Notice>
        ) : availability.state === "out_of_stock" ? (
          <Notice tone="warn" icon={<PackageX className="h-4 w-4" />} title="Out of stock right now">
            We&apos;re restocking this reward. Your points are safe in the meantime. Browse similar rewards below.
          </Notice>
        ) : availability.state === "inactive" ? (
          <Notice tone="warn" icon={<AlertTriangle className="h-4 w-4" />} title="No longer available">
            This reward has been retired from the catalog.
          </Notice>
        ) : shortBy > 0 ? (
          <Notice tone="brand" icon={<Sparkles className="h-4 w-4" />} title={`You need ${formatPoints(shortBy)} more points`}>
            You have <span className="num font-semibold text-ink">{formatPoints(available)}</span> available.
            {pending > 0 && (
              <>
                {" "}
                <span className="num font-semibold text-warn">{formatPoints(pending)}</span> pending points become spendable {releaseRule}.
              </>
            )}
            <Progress value={available / variant.pointsCost} label="Progress toward this reward" className="mt-3" />
          </Notice>
        ) : null}
      </div>

      {/* Delivery details */}
      {!blocked && shortBy === 0 && (
        <div className="mt-5 space-y-4">
          {reward.optionField && (
            <Field label={reward.optionField.label} htmlFor="redeem-option" error={errors.option}>
              <Select
                id="redeem-option"
                value={option}
                onChange={(e) => setOption(e.target.value)}
                aria-invalid={!!errors.option || undefined}
              >
                <option value="">Select…</option>
                {reward.optionField.choices.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {reward.deliveryMethod === "digital_email" && (
            <Field label="Deliver to email" htmlFor="redeem-email" error={errors.email} hint="We'll send your code here.">
              <Input
                id="redeem-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email || undefined}
              />
            </Field>
          )}

          {reward.deliveryMethod === "shipped" && (
            <fieldset className="space-y-3">
              <legend className="mb-1 w-full border-t border-line pt-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Ship to</legend>
              <Field label="Recipient" htmlFor="redeem-recipient" error={errors.recipient}>
                <Input id="redeem-recipient" autoComplete="name" value={address.recipient} onChange={(e) => setAddress({ ...address, recipient: e.target.value })} aria-invalid={!!errors.recipient || undefined} />
              </Field>
              <Field label="Street address" htmlFor="redeem-line1" error={errors.line1}>
                <Input id="redeem-line1" autoComplete="address-line1" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} aria-invalid={!!errors.line1 || undefined} />
              </Field>
              <Field label="Apt, suite or unit" htmlFor="redeem-line2" optional>
                <Input id="redeem-line2" autoComplete="address-line2" value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} />
              </Field>
              <div className="grid grid-cols-[minmax(0,1fr)_72px_100px] gap-2.5">
                <Field label="City" htmlFor="redeem-city" error={errors.city}>
                  <Input id="redeem-city" autoComplete="address-level2" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} aria-invalid={!!errors.city || undefined} />
                </Field>
                <Field label="State" htmlFor="redeem-state" error={errors.state}>
                  <Input id="redeem-state" autoComplete="address-level1" maxLength={2} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} aria-invalid={!!errors.state || undefined} className="uppercase" />
                </Field>
                <Field label="ZIP" htmlFor="redeem-postalCode" error={errors.postalCode}>
                  <Input id="redeem-postalCode" autoComplete="postal-code" inputMode="numeric" value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} aria-invalid={!!errors.postalCode || undefined} />
                </Field>
              </div>
            </fieldset>
          )}

          {reward.deliveryMethod === "scheduled" && (
            <Field label="Best days or times to reach you" htmlFor="redeem-timing" optional hint="Our concierge will call to confirm the details.">
              <Input id="redeem-timing" value={timing} onChange={(e) => setTiming(e.target.value)} placeholder="Weekday mornings work best" />
            </Field>
          )}

          {(reward.deliveryMethod === "account_credit" || reward.deliveryMethod === "donation") && (
            <Field label="Anything we should know?" htmlFor="redeem-note" optional>
              <Textarea id="redeem-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
            </Field>
          )}
        </div>
      )}

      {/* Summary + action */}
      <div className="mt-6 border-t border-line pt-5">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-3">Available points</dt>
            <dd className="num font-medium text-ink">{formatPoints(available)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-3">This reward</dt>
            <dd className="num font-medium text-ink">−{formatPoints(variant.pointsCost)}</dd>
          </div>
          {!blocked && shortBy === 0 && (
            <div className="flex justify-between border-t border-dashed border-line pt-2">
              <dt className="font-medium text-ink-2">Remaining after</dt>
              <dd className="num font-bold text-ink">{formatPoints(after)}</dd>
            </div>
          )}
        </dl>

        {blocked || shortBy > 0 ? (
          <div className="mt-5 space-y-2">
            <Button size="lg" className="w-full" disabled aria-describedby="redeem-blocked-reason">
              {availability.state === "tier_locked"
                ? `Available at ${requiredTier.name}`
                : availability.state === "out_of_stock"
                  ? "Out of stock"
                  : availability.state === "inactive"
                    ? "Unavailable"
                    : `${formatPoints(shortBy)} more points needed`}
            </Button>
            <p id="redeem-blocked-reason" className="sr-only">
              This reward can&apos;t be claimed right now. The reason is shown above.
            </p>
            <Link href="/rewards?affordable=1" className={buttonClasses("ghost", "md", "w-full")}>
              See rewards you can claim now <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <Button size="lg" className="mt-5 w-full" onClick={openReview}>
            Review claim
          </Button>
        )}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-ink-3">
          <Clock3 className="h-3.5 w-3.5" aria-hidden /> {reward.deliveryEstimate}
        </p>
      </div>

      <DialogRoot open={open} onOpenChange={(o) => !pendingSubmit && setOpen(o)}>
        <DialogContent title="Confirm your claim" description="Points are deducted as soon as you confirm." hideClose={pendingSubmit}>
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface-2/60 p-3">
            <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl">
              <Image src={reward.image} alt="" fill sizes="80px" className="object-cover" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{reward.name}</p>
              <p className="text-sm text-ink-3">
                {variant.label}
                {option ? ` · ${option}` : ""}
              </p>
            </div>
          </div>

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-3">Delivery</dt>
              <dd className="max-w-[65%] text-right text-ink-2">{deliveryLabel}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-3">Current balance</dt>
              <dd className="num text-ink">{formatPoints(available)} pts</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-3">Points to spend</dt>
              <dd className="num font-semibold text-ink">−{formatPoints(variant.pointsCost)} pts</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3">
              <dt className="font-semibold text-ink">Balance after</dt>
              <dd className="num text-lg font-bold text-ink">{formatPoints(after)} pts</dd>
            </div>
          </dl>
          {pending > 0 && (
            <p className="mt-3 text-xs text-ink-3">
              Your {formatPoints(pending)} pending points aren&apos;t used and stay pending until released.
            </p>
          )}

          {serverError && (
            <Notice tone="danger" icon={<AlertTriangle className="h-4 w-4" />} className="mt-5" title="We couldn't complete this claim">
              {serverError}
            </Notice>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pendingSubmit}>
              Go back
            </Button>
            <Button onClick={confirm} loading={pendingSubmit} disabled={!!serverError && serverError.includes("changed")}>
              {pendingSubmit ? "Submitting…" : `Confirm and spend ${formatPoints(variant.pointsCost)} pts`}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  );
}
