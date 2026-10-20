"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SlidersHorizontal, Banknote } from "lucide-react";
import { adjustPointsAction, releaseFundingAction, reverseFundingAction, simulateFundingAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogRoot, DialogTrigger } from "@/components/ui/overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/primitives";
import { cn, formatPoints } from "@/lib/utils";

export function AdjustPointsDialog({ merchantId, businessName, available }: { merchantId: string; businessName: string; available: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const key = useRef("");

  const amount = Number.parseInt(points, 10) || 0;
  const after = direction === "credit" ? available + amount : available - amount;

  function reset() {
    setPoints("");
    setReason("");
    setError(null);
    setDirection("credit");
  }

  return (
    <DialogRoot
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (o) {
          key.current = crypto.randomUUID();
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary">
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> Adjust points
        </Button>
      </DialogTrigger>
      <DialogContent title="Adjust points" description={`Changes ${businessName}'s spendable balance. A reason is required and recorded in the audit log.`}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const result = await adjustPointsAction({ merchantId, direction, points: amount, reason, idempotencyKey: key.current });
              if (result.ok) {
                toast.success(`${direction === "credit" ? "Added" : "Removed"} ${formatPoints(amount)} points`);
                setOpen(false);
                router.refresh();
              } else setError(result.error);
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Adjustment type">
            {(["credit", "debit"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={direction === d}
                onClick={() => setDirection(d)}
                className={cn(
                  "h-11 rounded-control border text-sm font-semibold",
                  direction === d ? "border-brand bg-brand-soft text-ink" : "border-line-strong text-ink-2 hover:text-ink",
                )}
              >
                {d === "credit" ? "Add points" : "Remove points"}
              </button>
            ))}
          </div>
          <Field label="Points" htmlFor="adj-points">
            <Input id="adj-points" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, ""))} placeholder="250" />
          </Field>
          <Field label="Reason" htmlFor="adj-reason" hint="Visible to the merchant on their activity. At least 10 characters.">
            <Textarea id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Goodwill credit for a delayed shipment (ticket 4821)" />
          </Field>
          <div className="flex justify-between rounded-2xl border border-line bg-surface-2/50 px-4 py-3 text-sm">
            <span className="text-ink-3">Balance after</span>
            <span className={cn("num font-semibold", after < 0 ? "text-danger" : "text-ink")}>{formatPoints(after)} pts</span>
          </div>
          {after < 0 && <Notice tone="danger">Removals can&apos;t take the balance below zero.</Notice>}
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={amount < 1 || reason.trim().length < 10 || after < 0}>
              Apply adjustment
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

export function SimulateFundingDialog({ merchantId, businessName }: { merchantId: string; businessName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [externalId, setExternalId] = useState("");
  const [amount, setAmount] = useState("75000");
  const [dealType, setDealType] = useState<"initial" | "renewal">("renewal");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <DialogRoot
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (o) {
          setExternalId(`SIM-${Date.now().toString(36).toUpperCase()}`);
          setResult(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Banknote className="h-4 w-4" aria-hidden /> Simulate funding
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Simulate a funding event"
        description={`Demo only. Records a simulated deal for ${businessName} the way a Salesforce or n8n import would. Submit the same external ID twice to see duplicate protection.`}
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await simulateFundingAction({ merchantId, externalId, dealType, fundedAmount: Number(amount) });
              if (r.ok) {
                setResult(
                  r.data.duplicate
                    ? `Duplicate ignored: ${externalId} was already recorded. No points were added.`
                    : `Recorded. ${formatPoints(r.data.points)} points are now pending for ${businessName}.`,
                );
                router.refresh();
              } else setError(r.error);
            });
          }}
          className="space-y-4"
        >
          <Field label="External ID" htmlFor="sim-id" hint="The stable identifier from the source system.">
            <Input id="sim-id" value={externalId} onChange={(e) => setExternalId(e.target.value)} className="font-mono text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Funded amount (USD)" htmlFor="sim-amount">
              <Input id="sim-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Deal type" htmlFor="sim-type">
              <Select id="sim-type" value={dealType} onChange={(e) => setDealType(e.target.value as "initial" | "renewal")}>
                <option value="renewal">Renewal</option>
                <option value="initial">Initial</option>
              </Select>
            </Field>
          </div>
          {result && <Notice tone={result.startsWith("Duplicate") ? "warn" : "success"}>{result}</Notice>}
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Close
            </Button>
            <Button type="submit" loading={pending}>
              Record funding
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

export function FundingActions({ fundingEventId, points }: { fundingEventId: string; points: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        variant="secondary"
        loading={pending && !reverseOpen}
        onClick={() =>
          start(async () => {
            const r = await releaseFundingAction(fundingEventId);
            if (r.ok) {
              toast.success(`Released ${formatPoints(points)} points`);
              router.refresh();
            } else toast.error(r.error);
          })
        }
      >
        Release
      </Button>
      <DialogRoot open={reverseOpen} onOpenChange={(o) => !pending && setReverseOpen(o)}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost">
            Reverse
          </Button>
        </DialogTrigger>
        <DialogContent title="Reverse pending points" description={`Removes ${formatPoints(points)} pending points. Use when a deal unwinds or defaults before release.`}>
          <Field label="Reason" htmlFor="reverse-reason">
            <Textarea id="reverse-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </Field>
          {error && <Notice tone="danger" className="mt-3">{error}</Notice>}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReverseOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={reason.trim().length < 5}
              onClick={() =>
                start(async () => {
                  const r = await reverseFundingAction(fundingEventId, reason);
                  if (r.ok) {
                    toast.success("Pending points reversed");
                    setReverseOpen(false);
                    router.refresh();
                  } else setError(r.error);
                })
              }
            >
              Reverse points
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  );
}
