// Core domain types for the Big Think Rewards points program.
// Points are integers. Money is stored in cents.

export type Role = "merchant" | "admin";

export type TierId = "silver" | "gold" | "platinum";

export type RewardCategory =
  | "gift_cards"
  | "merchandise"
  | "experiences"
  | "business_services"
  | "giving_back";

export type DeliveryMethod =
  | "digital_email"
  | "shipped"
  | "scheduled"
  | "account_credit"
  | "donation";

export type LedgerEntryType =
  | "earn_pending" // funding recorded, points held until release conditions are met
  | "release" // pending points become spendable
  | "pending_reversal" // pending points removed (deal reversed or conditions not met)
  | "bonus" // milestone, anniversary or referral bonus
  | "redeem" // points spent on a reward
  | "refund" // points returned after a canceled or failed redemption
  | "adjustment" // manual staff adjustment, reason required
  | "expiration"; // points expired under the inactivity policy

export type RedemptionStatus =
  | "requested"
  | "processing"
  | "shipped"
  | "fulfilled"
  | "canceled"
  | "failed";

export type FundingEventStatus = "pending" | "released" | "reversed";

export type FundingSourceSystem = "salesforce" | "n8n" | "manual" | "simulated";

export type ReferralStatus = "submitted" | "in_review" | "funded" | "not_funded";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  title: string | null;
  merchantId: string | null;
}

export interface Merchant {
  id: string;
  businessName: string;
  ownerFirstName: string;
  ownerLastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  industry: string;
  memberSince: string;
  referralCode: string;
  accountManager: string;
  externalRef: string | null;
}

export interface PointAccount {
  merchantId: string;
  available: number;
  pending: number;
  lifetimeEarned: number;
  redeemed: number;
}

export interface LedgerEntry {
  id: string;
  merchantId: string;
  type: LedgerEntryType;
  availableDelta: number;
  pendingDelta: number;
  title: string;
  detail: string | null;
  refType: string | null;
  refId: string | null;
  idempotencyKey: string;
  reason: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface RewardVariant {
  id: string;
  rewardId: string;
  label: string;
  pointsCost: number;
  valueCents: number | null;
  active: boolean;
  sortOrder: number;
}

export interface RewardOptionField {
  key: string;
  label: string;
  choices: string[];
}

export interface Reward {
  id: string;
  slug: string;
  name: string;
  category: RewardCategory;
  tagline: string;
  description: string;
  image: string;
  minTier: TierId;
  deliveryMethod: DeliveryMethod;
  deliveryEstimate: string;
  terms: string;
  inventory: number | null; // null means unlimited
  active: boolean;
  featured: boolean;
  optionField: RewardOptionField | null;
  variants: RewardVariant[];
  updatedAt: string;
}

export interface ShippingAddress {
  recipient: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface RedemptionDetails {
  deliveryEmail?: string;
  shippingAddress?: ShippingAddress;
  option?: { label: string; value: string };
  preferredTiming?: string;
  note?: string;
}

export interface RedemptionEvent {
  id: string;
  redemptionId: string;
  status: RedemptionStatus;
  note: string | null;
  actor: string | null;
  createdAt: string;
}

export interface Redemption {
  id: string;
  reference: string;
  merchantId: string;
  rewardId: string;
  variantId: string;
  rewardName: string;
  variantLabel: string;
  rewardImage: string;
  category: RewardCategory;
  deliveryMethod: DeliveryMethod;
  pointsCost: number;
  balanceAfter: number;
  status: RedemptionStatus;
  details: RedemptionDetails;
  fulfillmentProvider: string;
  fulfillmentNote: string | null;
  trackingInfo: string | null;
  simulated: boolean;
  createdAt: string;
  updatedAt: string;
  events: RedemptionEvent[];
}

export interface FundingEvent {
  id: string;
  merchantId: string;
  source: FundingSourceSystem;
  externalId: string;
  dealType: "initial" | "renewal";
  fundedAmountCents: number;
  fundedAt: string;
  points: number;
  status: FundingEventStatus;
  releasedAt: string | null;
  simulated: boolean;
  createdAt: string;
}

export interface Referral {
  id: string;
  merchantId: string;
  businessName: string;
  ownerName: string;
  contact: string;
  status: ReferralStatus;
  bonusPoints: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  tierProgress: boolean;
  newRewards: boolean;
  pointsExpiring: boolean;
  claimUpdates: boolean;
  pointsReleased: boolean;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  merchantId: string | null;
  summary: string;
  reason: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface SupportRequest {
  id: string;
  merchantId: string;
  topic: string;
  preferredTime: string;
  phone: string;
  status: "open" | "closed";
  createdAt: string;
}
