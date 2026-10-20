"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ProgramSettings } from "@/lib/domain/settings";
import { saveSettingsAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Card, Notice } from "@/components/ui/primitives";
import { DialogContent, DialogRoot } from "@/components/ui/overlay";

function NumberField({
  label,
  id,
  value,
  onChange,
  hint,
  step,
}: {
  label: string;
  id: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  step?: string;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input id={id} type="number" inputMode="decimal" step={step ?? "1"} min={0} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(e.target.valueAsNumber)} />
    </Field>
  );
}

export function SettingsEditor({ initial }: { initial: ProgramSettings }) {
  const router = useRouter();
  const [s, setS] = useState<ProgramSettings>(initial);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);

  function set<K extends keyof ProgramSettings>(key: K, value: ProgramSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold text-ink">Earning and release</h2>
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Points per $100 funded" id="earn-rate" step="0.1" value={s.earning.pointsPerHundredDollars} onChange={(v) => set("earning", { ...s.earning, pointsPerHundredDollars: v })} />
            <NumberField label="Renewal multiplier" id="earn-mult" step="0.1" value={s.earning.renewalMultiplier} onChange={(v) => set("earning", { ...s.earning, renewalMultiplier: v })} hint="1 = same as initial" />
            <NumberField label="On-time payments to release" id="rel-count" value={s.release.onTimePaymentsRequired} onChange={(v) => set("release", { ...s.release, onTimePaymentsRequired: v })} />
            <NumberField label="Typical days to release" id="rel-days" value={s.release.typicalDays} onChange={(v) => set("release", { ...s.release, typicalDays: v })} hint="Shown to merchants as an estimate" />
          </div>
        </Card>

        <Card className="space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold text-ink">Bonuses</h2>
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="First funding" id="b-first" value={s.bonuses.firstFunding} onChange={(v) => set("bonuses", { ...s.bonuses, firstFunding: v })} />
            <NumberField label="Three fundings" id="b-three" value={s.bonuses.threeFundings} onChange={(v) => set("bonuses", { ...s.bonuses, threeFundings: v })} />
            <NumberField label="Anniversary" id="b-anniv" value={s.bonuses.anniversary} onChange={(v) => set("bonuses", { ...s.bonuses, anniversary: v })} />
            <NumberField label="Referral funded" id="b-ref" value={s.bonuses.referralFunded} onChange={(v) => set("bonuses", { ...s.bonuses, referralFunded: v })} />
            <NumberField label="Paid in full" id="b-paid" value={s.bonuses.paidInFull} onChange={(v) => set("bonuses", { ...s.bonuses, paidInFull: v })} />
          </div>
        </Card>

        <Card className="space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold text-ink">Tiers</h2>
          {s.tiers.map((t, i) => (
            <div key={t.id} className="space-y-3 rounded-2xl border border-line p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tier name" htmlFor={`tier-name-${t.id}`}>
                  <Input id={`tier-name-${t.id}`} value={t.name} onChange={(e) => set("tiers", s.tiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                </Field>
                <NumberField
                  label="Lifetime points to reach"
                  id={`tier-th-${t.id}`}
                  value={t.threshold}
                  onChange={(v) => set("tiers", s.tiers.map((x, j) => (j === i ? { ...x, threshold: v } : x)))}
                />
              </div>
              <Field label="Benefits (one per line)" htmlFor={`tier-b-${t.id}`}>
                <Textarea
                  id={`tier-b-${t.id}`}
                  rows={3}
                  value={t.benefits.join("\n")}
                  onChange={(e) =>
                    set(
                      "tiers",
                      s.tiers.map((x, j) => (j === i ? { ...x, benefits: e.target.value.split("\n").map((b) => b.trimStart()).filter((b, k, arr) => b || k === arr.length - 1) } : x)),
                    )
                  }
                />
              </Field>
            </div>
          ))}
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4 p-5 sm:p-6">
            <h2 className="font-semibold text-ink">Limits and expiration</h2>
            <div className="grid grid-cols-2 gap-4">
              <NumberField label="Referrals per year" id="lim-ref" value={s.referrals.maxPerYear} onChange={(v) => set("referrals", { maxPerYear: v })} />
              <NumberField label="Rewards per month" id="lim-red" value={s.limits.maxRedemptionsPerMonth} onChange={(v) => set("limits", { maxRedemptionsPerMonth: v })} />
              <NumberField label="Expire after inactive months" id="exp-months" value={s.expiration.inactivityMonths} onChange={(v) => set("expiration", { ...s.expiration, inactivityMonths: v })} />
              <NumberField label="Expiry warning (days)" id="exp-warn" value={s.expiration.warningDays} onChange={(v) => set("expiration", { ...s.expiration, warningDays: v })} />
            </div>
          </Card>
          <Card className="space-y-4 p-5 sm:p-6">
            <h2 className="font-semibold text-ink">Support contacts</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone" htmlFor="sup-phone">
                <Input id="sup-phone" value={s.support.phone} onChange={(e) => set("support", { ...s.support, phone: e.target.value })} />
              </Field>
              <Field label="Text" htmlFor="sup-sms">
                <Input id="sup-sms" value={s.support.sms} onChange={(e) => set("support", { ...s.support, sms: e.target.value })} />
              </Field>
              <Field label="Email" htmlFor="sup-email">
                <Input id="sup-email" type="email" value={s.support.email} onChange={(e) => set("support", { ...s.support, email: e.target.value })} />
              </Field>
              <Field label="Hours" htmlFor="sup-hours">
                <Input id="sup-hours" value={s.support.hours} onChange={(e) => set("support", { ...s.support, hours: e.target.value })} />
              </Field>
            </div>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-20 z-10 mt-6 flex items-center justify-between gap-4 rounded-2xl border border-line-strong bg-surface-2/95 px-5 py-3.5 shadow-pop backdrop-blur lg:bottom-6">
        <p className="text-sm text-ink-2">{dirty ? "You have unsaved changes." : "All changes saved."}</p>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!dirty || pending} onClick={() => setS(initial)}>
            Discard
          </Button>
          <Button
            disabled={!dirty}
            onClick={() => {
              setReason("");
              setError(null);
              setOpen(true);
            }}
          >
            Review and save
          </Button>
        </div>
      </div>

      <DialogRoot open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent title="Save program settings" description="Settings changes are audited. Describe what changed and who approved it.">
          <Field label="Reason for change" htmlFor="settings-reason">
            <Textarea id="settings-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Approved by marketing on 10/20: raise referral bonus to 2,000 for Q4." />
          </Field>
          {error && <Notice tone="danger" className="mt-3">{error}</Notice>}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              loading={pending}
              disabled={reason.trim().length < 5}
              onClick={() =>
                start(async () => {
                  const result = await saveSettingsAction(s, reason);
                  if (result.ok) {
                    toast.success("Settings saved");
                    setOpen(false);
                    router.refresh();
                  } else setError(result.error);
                })
              }
            >
              Save settings
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </>
  );
}
