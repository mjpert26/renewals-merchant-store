"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { PhoneCall } from "lucide-react";
import { requestCallbackAction, savePreferencesAction } from "@/app/actions/merchant";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { Notice } from "@/components/ui/primitives";
import type { NotificationPreferences } from "@/lib/domain/types";

const TOPICS = ["Rewards question", "A claim I placed", "My points balance", "Renewal or new funding", "Something else"];
const TIMES = ["Morning (9–12)", "Afternoon (12–3)", "Late afternoon (3–6)"];

export function CallbackForm({ defaultPhone }: { defaultPhone: string }) {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [time, setTime] = useState(TIMES[0]);
  const [phone, setPhone] = useState(defaultPhone);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <Notice tone="success" icon={<PhoneCall className="h-4 w-4" />} title="Callback requested">
        Your account team will call {phone} in the {done.split(" (")[0].toLowerCase()} on the next business day.
      </Notice>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await requestCallbackAction({ topic, preferredTime: time, phone });
          if (result.ok) {
            setDone(result.data.preferredTime);
            toast.success("Callback requested");
          } else setError(result.error);
        });
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Topic" htmlFor="cb-topic">
          <Select id="cb-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
            {TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Best time" htmlFor="cb-time">
          <Select id="cb-time" value={time} onChange={(e) => setTime(e.target.value)}>
            {TIMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Phone number" htmlFor="cb-phone" error={error ?? undefined}>
        <Input id="cb-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!error || undefined} />
      </Field>
      <Button type="submit" loading={pending}>
        Request a call back
      </Button>
    </form>
  );
}

const PREF_ITEMS: { key: keyof NotificationPreferences; label: string; hint: string }[] = [
  { key: "pointsReleased", label: "Pending points are released", hint: "When points from a funding become spendable." },
  { key: "tierProgress", label: "You're close to a new tier", hint: "A heads-up when you're within reach of the next level." },
  { key: "newRewards", label: "New rewards are added", hint: "A short note when the catalog gets something new." },
  { key: "pointsExpiring", label: "Points are about to expire", hint: "A reminder before any points expire." },
  { key: "claimUpdates", label: "Claim and shipping updates", hint: "Status changes for rewards you've claimed." },
];

export function PreferencesForm({ initial, email }: { initial: NotificationPreferences; email: string }) {
  const [prefs, setPrefs] = useState(initial);
  const lastSaved = useRef(initial);
  const [, start] = useTransition();

  function toggle(key: keyof NotificationPreferences, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    start(async () => {
      const result = await savePreferencesAction(next);
      if (result.ok) {
        lastSaved.current = next;
        toast.success("Preferences saved", { id: "prefs" });
      } else {
        setPrefs(lastSaved.current);
        toast.error(result.error, { id: "prefs" });
      }
    });
  }

  return (
    <div>
      <ul className="divide-y divide-line">
        {PREF_ITEMS.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-6 py-4">
            <div>
              <label htmlFor={`pref-${item.key}`} className="text-sm font-semibold text-ink">
                {item.label}
              </label>
              <p id={`pref-${item.key}-hint`} className="text-[13px] text-ink-3">
                {item.hint}
              </p>
            </div>
            <Switch
              id={`pref-${item.key}`}
              checked={prefs[item.key]}
              onCheckedChange={(v) => toggle(item.key, v)}
              aria-describedby={`pref-${item.key}-hint`}
            />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-3">
        Sent to {email}. Account and security emails are always sent. In this demo no emails leave the system.
      </p>
    </div>
  );
}
