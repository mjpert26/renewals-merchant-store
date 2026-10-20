"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { submitReferralAction } from "@/app/actions/merchant";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/primitives";

export function ReferralLink({ link, code }: { link: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  // Read after hydration so server and client markup match.
  useEffect(() => setCanShare("share" in navigator), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Fallback for browsers that block the async clipboard API.
      const input = document.getElementById("referral-link") as HTMLInputElement | null;
      input?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    toast.success("Referral link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <label htmlFor="referral-link" className="sr-only">
        Your referral link
      </label>
      <div className="flex gap-2">
        <input
          id="referral-link"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 min-w-0 flex-1 rounded-control border border-line-strong bg-canvas-raised px-3.5 font-mono text-[13px] text-ink-2 focus:border-brand focus:outline-none"
        />
        <Button onClick={copy} variant={copied ? "secondary" : "primary"} aria-live="polite">
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-3">
        <span>
          Referral code <span className="font-mono font-semibold text-ink-2">{code}</span>
        </span>
        {canShare && (
          <button
            type="button"
            onClick={() =>
              navigator.share({ title: "Big Think Capital", text: "Funding for your business, from the team I trust:", url: link }).catch(() => {})
            }
            className="inline-flex items-center gap-1.5 font-semibold text-brand-ink hover:text-ink"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden /> Share
          </button>
        )}
      </div>
    </div>
  );
}

export function ReferralForm({ disabled }: { disabled: boolean }) {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (businessName.trim().length < 2) next.businessName = "Enter the business name.";
    if (ownerName.trim().length < 2) next.ownerName = "Enter the owner's name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim()) && !/^[+()\-.\s\d]{7,}$/.test(contact.trim()))
      next.contact = "Enter a valid phone number or email.";
    if (!consent) next.consent = "Please confirm you have their permission.";
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length) {
      document.getElementById(`ref-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    start(async () => {
      const result = await submitReferralAction({ businessName, ownerName, contact, consent });
      if (result.ok) {
        setSuccess(result.data.businessName);
        setBusinessName("");
        setOwnerName("");
        setContact("");
        setConsent(false);
        toast.success("Referral sent. Thank you!");
      } else {
        setServerError(result.error);
      }
    });
  }

  if (disabled) {
    return (
      <Notice tone="gold" title="You've reached this year's referral limit">
        Thank you for spreading the word. You can refer more businesses starting January 1.
      </Notice>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {success && (
        <Notice tone="success" title={`Thanks! We'll reach out to ${success}.`}>
          You can follow its status below.
        </Notice>
      )}
      {serverError && <Notice tone="danger">{serverError}</Notice>}
      <Field label="Business name" htmlFor="ref-businessName" error={errors.businessName}>
        <Input id="ref-businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} aria-invalid={!!errors.businessName || undefined} autoComplete="off" />
      </Field>
      <Field label="Owner name" htmlFor="ref-ownerName" error={errors.ownerName}>
        <Input id="ref-ownerName" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} aria-invalid={!!errors.ownerName || undefined} autoComplete="off" />
      </Field>
      <Field label="Phone or email" htmlFor="ref-contact" error={errors.contact}>
        <Input id="ref-contact" value={contact} onChange={(e) => setContact(e.target.value)} aria-invalid={!!errors.contact || undefined} autoComplete="off" />
      </Field>
      <div>
        <Checkbox id="ref-consent" checked={consent} onChange={setConsent} invalid={!!errors.consent}>
          I have this person&apos;s permission to share their contact information with Big Think Capital.
        </Checkbox>
        {errors.consent && (
          <p className="mt-1.5 pl-[30px] text-[13px] text-danger" role="alert">
            {errors.consent}
          </p>
        )}
      </div>
      <Button type="submit" loading={pending} className="w-full sm:w-auto">
        Submit referral
      </Button>
    </form>
  );
}
