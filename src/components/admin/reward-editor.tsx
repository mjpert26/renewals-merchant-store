"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Reward, RewardCategory, DeliveryMethod, TierId } from "@/lib/domain/types";
import { CATEGORY_LABELS, DELIVERY_LABELS } from "@/lib/domain/catalog-helpers";
import { IMAGE_LIBRARY } from "@/lib/db/catalog";
import { saveRewardAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Card, Notice } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type VariantDraft = { id?: string; label: string; pointsCost: string; value: string; active: boolean };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

export function RewardEditor({ reward }: { reward: Reward | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(reward?.name ?? "");
  const [slug, setSlug] = useState(reward?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!reward);
  const [category, setCategory] = useState<RewardCategory>(reward?.category ?? "gift_cards");
  const [tagline, setTagline] = useState(reward?.tagline ?? "");
  const [description, setDescription] = useState(reward?.description ?? "");
  const [image, setImage] = useState(reward?.image ?? IMAGE_LIBRARY[0]);
  const [minTier, setMinTier] = useState<TierId>(reward?.minTier ?? "silver");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(reward?.deliveryMethod ?? "digital_email");
  const [deliveryEstimate, setDeliveryEstimate] = useState(reward?.deliveryEstimate ?? "Within 2 business days");
  const [terms, setTerms] = useState(reward?.terms ?? "");
  const [unlimited, setUnlimited] = useState(reward ? reward.inventory === null : true);
  const [inventory, setInventory] = useState(String(reward?.inventory ?? 25));
  const [active, setActive] = useState(reward?.active ?? false);
  const [featured, setFeatured] = useState(reward?.featured ?? false);
  const [variants, setVariants] = useState<VariantDraft[]>(
    reward?.variants.map((v) => ({
      id: v.id,
      label: v.label,
      pointsCost: String(v.pointsCost),
      value: v.valueCents ? String(v.valueCents / 100) : "",
      active: v.active,
    })) ?? [{ label: "", pointsCost: "", value: "", active: true }],
  );

  function save() {
    setError(null);
    start(async () => {
      const result = await saveRewardAction(reward?.id ?? null, {
        name,
        slug,
        category,
        tagline,
        description,
        image,
        minTier,
        deliveryMethod,
        deliveryEstimate,
        terms,
        inventory: unlimited ? null : Number(inventory),
        active,
        featured,
        variants: variants.map((v) => ({
          id: v.id,
          label: v.label,
          pointsCost: Number(v.pointsCost),
          valueCents: v.value ? Math.round(Number(v.value) * 100) : null,
          active: v.active,
        })),
      });
      if (result.ok) {
        toast.success(reward ? "Reward saved" : "Reward created");
        if (!reward) router.push(`/admin/rewards/${result.data.id}`);
        else router.refresh();
      } else {
        setError(result.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] [&>*]:min-w-0"
    >
      <div className="space-y-6">
        {error && <Notice tone="danger" title="Not saved">{error}</Notice>}
        <Card className="space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold text-ink">Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="rw-name">
              <Input
                id="rw-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            </Field>
            <Field label="URL" htmlFor="rw-slug" hint={`/rewards/${slug || "…"}`}>
              <Input
                id="rw-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
              />
            </Field>
          </div>
          <Field label="Tagline" htmlFor="rw-tagline">
            <Input id="rw-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Description" htmlFor="rw-desc">
            <Textarea id="rw-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="rw-cat">
              <Select id="rw-cat" value={category} onChange={(e) => setCategory(e.target.value as RewardCategory)}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Minimum tier" htmlFor="rw-tier">
              <Select id="rw-tier" value={minTier} onChange={(e) => setMinTier(e.target.value as TierId)}>
                <option value="silver">Silver (everyone)</option>
                <option value="gold">Gold and above</option>
                <option value="platinum">Platinum only</option>
              </Select>
            </Field>
            <Field label="Delivery method" htmlFor="rw-delivery">
              <Select id="rw-delivery" value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value as DeliveryMethod)}>
                {Object.entries(DELIVERY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Delivery estimate" htmlFor="rw-eta">
              <Input id="rw-eta" value={deliveryEstimate} onChange={(e) => setDeliveryEstimate(e.target.value)} />
            </Field>
          </div>
          <Field label="Terms" htmlFor="rw-terms">
            <Textarea id="rw-terms" value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} />
          </Field>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-ink">Price options</h2>
              <p className="text-sm text-ink-3">Denominations or variants. Options used by past claims are deactivated rather than deleted.</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={variants.length >= 8}
              onClick={() => setVariants([...variants, { label: "", pointsCost: "", value: "", active: true }])}
            >
              <Plus className="h-4 w-4" aria-hidden /> Add option
            </Button>
          </div>
          <ul className="space-y-3">
            {variants.map((v, i) => (
              <li key={v.id ?? `new-${i}`} className="grid grid-cols-2 items-end gap-3 rounded-2xl border border-line p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                <Field label="Label" htmlFor={`v-label-${i}`} className="col-span-2 sm:col-span-1">
                  <Input id={`v-label-${i}`} value={v.label} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="$50 card" />
                </Field>
                <Field label="Points" htmlFor={`v-pts-${i}`}>
                  <Input id={`v-pts-${i}`} inputMode="numeric" value={v.pointsCost} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, pointsCost: e.target.value.replace(/\D/g, "") } : x)))} />
                </Field>
                <Field label="Value (USD)" htmlFor={`v-val-${i}`} optional>
                  <Input id={`v-val-${i}`} inputMode="decimal" value={v.value} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, value: e.target.value.replace(/[^\d.]/g, "") } : x)))} />
                </Field>
                <label className="flex h-11 items-center gap-2 text-sm text-ink-2">
                  <Switch checked={v.active} onCheckedChange={(a) => setVariants(variants.map((x, j) => (j === i ? { ...x, active: a } : x)))} aria-label={`Option ${i + 1} active`} />
                  Active
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove option ${i + 1}`}
                  disabled={variants.length === 1}
                  onClick={() => setVariants(variants.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold text-ink">Image</h2>
          <p className="mb-4 text-sm text-ink-3">Choose from the brand library. Upload support will connect to the company&apos;s asset storage.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Reward image">
            {IMAGE_LIBRARY.map((src) => (
              <button
                key={src}
                type="button"
                role="radio"
                aria-checked={image === src}
                aria-label={src.split("/").pop()?.replace(".webp", "").replace(/-/g, " ")}
                onClick={() => setImage(src)}
                className={cn(
                  "relative aspect-[4/3] overflow-hidden rounded-xl border-2 transition",
                  image === src ? "border-brand shadow-[0_0_0_3px_rgb(47_107_255/0.25)]" : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <Image src={src} alt="" fill sizes="140px" className="object-cover" />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6 xl:sticky xl:top-[100px] xl:self-start">
        <Card className="overflow-hidden">
          <div className="relative aspect-[4/3]">
            <Image src={image} alt="" fill sizes="340px" className="object-cover" />
          </div>
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{CATEGORY_LABELS[category]}</p>
            <p className="mt-1 font-semibold text-ink">{name || "Reward name"}</p>
            <p className="text-sm text-ink-3">{tagline || "Short tagline"}</p>
          </div>
        </Card>
        <Card className="space-y-4 p-5">
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              <span className="block font-semibold text-ink">Live in catalog</span>
              <span className="block text-ink-3">Hidden rewards can&apos;t be claimed.</span>
            </span>
            <Switch checked={active} onCheckedChange={setActive} aria-label="Live in catalog" />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              <span className="block font-semibold text-ink">Featured</span>
              <span className="block text-ink-3">Shown in “Picked for you”.</span>
            </span>
            <Switch checked={featured} onCheckedChange={setFeatured} aria-label="Featured" />
          </label>
          <div className="border-t border-line pt-4">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="font-semibold text-ink">Unlimited stock</span>
              <Switch checked={unlimited} onCheckedChange={setUnlimited} aria-label="Unlimited stock" />
            </label>
            {!unlimited && (
              <Field label="Units in stock" htmlFor="rw-stock" className="mt-3">
                <Input id="rw-stock" inputMode="numeric" value={inventory} onChange={(e) => setInventory(e.target.value.replace(/\D/g, ""))} />
              </Field>
            )}
          </div>
          <Button type="submit" size="lg" className="w-full" loading={pending}>
            {reward ? "Save changes" : "Create reward"}
          </Button>
        </Card>
      </div>
    </form>
  );
}
