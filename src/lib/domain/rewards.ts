import { z } from "zod";
import type { DB } from "@/lib/db";
import { inWriteTransaction, newId, nowIso } from "@/lib/db";
import type { Reward, RewardCategory, RewardVariant, TierId, DeliveryMethod } from "./types";

// Pure catalog helpers live in catalog-helpers.ts so client components can use them
// without pulling the database driver into the browser bundle.
export * from "./catalog-helpers";
import { writeAudit, type Actor } from "./audit";
import { DomainError } from "./errors";

type RewardRow = {
  id: string;
  slug: string;
  name: string;
  category: RewardCategory;
  tagline: string;
  description: string;
  image: string;
  min_tier: TierId;
  delivery_method: DeliveryMethod;
  delivery_estimate: string;
  terms: string;
  inventory: number | null;
  active: number;
  featured: number;
  option_field: string | null;
  sort_order: number;
  updated_at: string;
};

type VariantRow = {
  id: string;
  reward_id: string;
  label: string;
  points_cost: number;
  value_cents: number | null;
  active: number;
  sort_order: number;
};

function mapVariant(row: VariantRow): RewardVariant {
  return {
    id: row.id,
    rewardId: row.reward_id,
    label: row.label,
    pointsCost: row.points_cost,
    valueCents: row.value_cents,
    active: row.active === 1,
    sortOrder: row.sort_order,
  };
}

function mapReward(row: RewardRow, variants: RewardVariant[]): Reward {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    tagline: row.tagline,
    description: row.description,
    image: row.image,
    minTier: row.min_tier,
    deliveryMethod: row.delivery_method,
    deliveryEstimate: row.delivery_estimate,
    terms: row.terms,
    inventory: row.inventory,
    active: row.active === 1,
    featured: row.featured === 1,
    optionField: row.option_field ? JSON.parse(row.option_field) : null,
    variants,
    updatedAt: row.updated_at,
  };
}

export function listRewards(db: DB, opts: { includeInactive?: boolean } = {}): Reward[] {
  const rows = db
    .prepare(`SELECT * FROM rewards ${opts.includeInactive ? "" : "WHERE active = 1"} ORDER BY sort_order, name`)
    .all() as RewardRow[];
  const variantRows = db.prepare("SELECT * FROM reward_variants ORDER BY sort_order, points_cost").all() as VariantRow[];
  return rows.map((row) =>
    mapReward(
      row,
      variantRows
        .filter((v) => v.reward_id === row.id && (opts.includeInactive || v.active === 1))
        .map(mapVariant),
    ),
  );
}

export function getReward(db: DB, idOrSlug: string, opts: { includeInactive?: boolean } = {}): Reward | null {
  const row = db.prepare("SELECT * FROM rewards WHERE id = ? OR slug = ?").get(idOrSlug, idOrSlug) as
    | RewardRow
    | undefined;
  if (!row) return null;
  if (!opts.includeInactive && row.active !== 1) return null;
  const variants = (
    db.prepare("SELECT * FROM reward_variants WHERE reward_id = ? ORDER BY sort_order, points_cost").all(row.id) as VariantRow[]
  )
    .filter((v) => opts.includeInactive || v.active === 1)
    .map(mapVariant);
  return mapReward(row, variants);
}

const variantInput = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, "Each option needs a label.").max(60),
  pointsCost: z.coerce.number().int().min(1, "Point prices must be at least 1.").max(1_000_000),
  valueCents: z.coerce.number().int().min(0).max(100_000_000).nullable().optional(),
  active: z.boolean(),
});

export const rewardInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes for the URL."),
  category: z.enum(["gift_cards", "merchandise", "experiences", "business_services", "giving_back"]),
  tagline: z.string().trim().min(2, "Add a short tagline.").max(120),
  description: z.string().trim().min(10, "Add a description.").max(1200),
  image: z
    .string()
    .trim()
    .regex(/^\/images\/rewards\/[a-z0-9-]+\.webp$|^https:\/\//, "Choose an image from the library or enter an https URL."),
  minTier: z.enum(["silver", "gold", "platinum"]),
  deliveryMethod: z.enum(["digital_email", "shipped", "scheduled", "account_credit", "donation"]),
  deliveryEstimate: z.string().trim().min(2).max(80),
  terms: z.string().trim().min(2).max(1200),
  inventory: z.coerce.number().int().min(0).max(1_000_000).nullable(),
  active: z.boolean(),
  featured: z.boolean(),
  variants: z.array(variantInput).min(1, "Add at least one price option.").max(8),
});

export type RewardInput = z.infer<typeof rewardInputSchema>;

export function saveReward(db: DB, rewardId: string | null, input: unknown, actor: Actor): Reward {
  const parsed = rewardInputSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("invalid_input", parsed.error.issues[0]?.message ?? "Reward is not valid.");
  const data = parsed.data;
  if (!data.variants.some((v) => v.active)) {
    throw new DomainError("invalid_input", "At least one price option must be active.");
  }

  return inWriteTransaction(db, () => {
    const slugOwner = db.prepare("SELECT id FROM rewards WHERE slug = ?").get(data.slug) as { id: string } | undefined;
    if (slugOwner && slugOwner.id !== rewardId) throw new DomainError("duplicate", "Another reward already uses that URL.");

    const before = rewardId ? getReward(db, rewardId, { includeInactive: true }) : null;
    if (rewardId && !before) throw new DomainError("not_found", "Reward not found.");
    const id = rewardId ?? newId("rw");
    const now = nowIso();
    const row = {
      id,
      slug: data.slug,
      name: data.name,
      category: data.category,
      tagline: data.tagline,
      description: data.description,
      image: data.image,
      min_tier: data.minTier,
      delivery_method: data.deliveryMethod,
      delivery_estimate: data.deliveryEstimate,
      terms: data.terms,
      inventory: data.inventory,
      active: data.active ? 1 : 0,
      featured: data.featured ? 1 : 0,
      updated_at: now,
    };
    if (before) {
      db.prepare(
        `UPDATE rewards SET slug=@slug, name=@name, category=@category, tagline=@tagline, description=@description, image=@image,
          min_tier=@min_tier, delivery_method=@delivery_method, delivery_estimate=@delivery_estimate, terms=@terms,
          inventory=@inventory, active=@active, featured=@featured, updated_at=@updated_at WHERE id=@id`,
      ).run(row);
    } else {
      const maxSort = (db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM rewards").get() as { m: number }).m;
      db.prepare(
        `INSERT INTO rewards (id, slug, name, category, tagline, description, image, min_tier, delivery_method, delivery_estimate,
          terms, inventory, active, featured, option_field, sort_order, updated_at)
         VALUES (@id, @slug, @name, @category, @tagline, @description, @image, @min_tier, @delivery_method, @delivery_estimate,
          @terms, @inventory, @active, @featured, NULL, @sort_order, @updated_at)`,
      ).run({ ...row, sort_order: maxSort + 1 });
    }

    // Variants that are referenced by redemptions are never deleted, only deactivated.
    const keepIds = new Set(data.variants.filter((v) => v.id).map((v) => v.id));
    for (const existing of before?.variants ?? []) {
      if (!keepIds.has(existing.id)) db.prepare("UPDATE reward_variants SET active = 0 WHERE id = ?").run(existing.id);
    }
    data.variants.forEach((v, index) => {
      const ownedByReward = v.id && before?.variants.some((existing) => existing.id === v.id);
      if (ownedByReward) {
        db.prepare(
          "UPDATE reward_variants SET label = ?, points_cost = ?, value_cents = ?, active = ?, sort_order = ? WHERE id = ?",
        ).run(v.label, v.pointsCost, v.valueCents ?? null, v.active ? 1 : 0, index, v.id);
      } else {
        db.prepare(
          "INSERT INTO reward_variants (id, reward_id, label, points_cost, value_cents, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).run(newId("rv"), id, v.label, v.pointsCost, v.valueCents ?? null, v.active ? 1 : 0, index);
      }
    });

    const after = getReward(db, id, { includeInactive: true })!;
    writeAudit(db, {
      actor,
      action: before ? "reward.update" : "reward.create",
      entityType: "reward",
      entityId: id,
      summary: `${before ? "Updated" : "Created"} reward “${after.name}”`,
      before,
      after,
    });
    return after;
  });
}
