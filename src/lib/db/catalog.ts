import type { DeliveryMethod, RewardCategory, RewardOptionField, TierId } from "@/lib/domain/types";

// Demo reward catalog. Point prices, availability and tier gates are
// placeholders for the marketing team to set. Imagery was generated for this
// prototype and contains no third-party brands.

export interface CatalogSeed {
  slug: string;
  name: string;
  category: RewardCategory;
  tagline: string;
  description: string;
  minTier: TierId;
  deliveryMethod: DeliveryMethod;
  deliveryEstimate: string;
  terms: string;
  inventory: number | null;
  featured?: boolean;
  active?: boolean;
  optionField?: RewardOptionField;
  variants: { label: string; points: number; valueCents?: number }[];
}

const GIFT_TERMS =
  "Delivered as a digital code to the email you provide. Codes are non-refundable once delivered and cannot be exchanged for cash. Lost or stolen codes cannot be replaced.";

export const CATALOG: CatalogSeed[] = [
  {
    slug: "digital-prepaid-card",
    name: "Digital Prepaid Card",
    category: "gift_cards",
    tagline: "Spend it anywhere cards are accepted.",
    description:
      "A digital prepaid card you can use online or in store wherever major cards are accepted. Use it for supplies, a team lunch or something just for you.",
    minTier: "silver",
    deliveryMethod: "digital_email",
    deliveryEstimate: "Within 2 business days",
    terms: GIFT_TERMS,
    inventory: null,
    featured: true,
    variants: [
      { label: "$25 card", points: 1500, valueCents: 2500 },
      { label: "$50 card", points: 3000, valueCents: 5000 },
      { label: "$100 card", points: 6000, valueCents: 10000 },
    ],
  },
  {
    slug: "cafe-gift-card",
    name: "Café Gift Card",
    category: "gift_cards",
    tagline: "Coffee on us for you and your team.",
    description:
      "A digital gift card redeemable at participating national café chains. A small thank-you for the early mornings that keep your business running.",
    minTier: "silver",
    deliveryMethod: "digital_email",
    deliveryEstimate: "Within 2 business days",
    terms: GIFT_TERMS,
    inventory: null,
    variants: [
      { label: "$15 card", points: 900, valueCents: 1500 },
      { label: "$30 card", points: 1800, valueCents: 3000 },
    ],
  },
  {
    slug: "branded-welcome-kit",
    name: "Branded Welcome Kit",
    category: "merchandise",
    tagline: "Apparel and desk essentials, boxed and shipped.",
    description:
      "A premium Big Think Capital kit with a soft cotton tee, an insulated tumbler, a leather-wrapped notebook and a weighted pen, packed in a keepsake box.",
    minTier: "silver",
    deliveryMethod: "shipped",
    deliveryEstimate: "Ships in 5–7 business days",
    terms: "Ships to U.S. addresses only. Sizes run true to fit. Unopened kits can be exchanged for a different size within 30 days.",
    inventory: 120,
    optionField: { key: "size", label: "Shirt size", choices: ["S", "M", "L", "XL", "XXL"] },
    variants: [{ label: "Welcome kit", points: 1000 }],
  },
  {
    slug: "leather-padfolio",
    name: "Leather Padfolio",
    category: "merchandise",
    tagline: "Zip-around portfolio for meetings on the go.",
    description:
      "Full-grain leather padfolio with a zip closure, tablet sleeve, card slots and a refillable notepad. Comes with a matching gold-tone pen.",
    minTier: "silver",
    deliveryMethod: "shipped",
    deliveryEstimate: "Ships in 5–7 business days",
    terms: "Ships to U.S. addresses only. Returns accepted within 30 days if unused.",
    inventory: 0,
    variants: [{ label: "Navy leather", points: 1800 }],
  },
  {
    slug: "premium-headphones",
    name: "Premium Headphones",
    category: "merchandise",
    tagline: "Noise-cancelling, all-day comfort.",
    description:
      "Wireless over-ear headphones with active noise cancellation, 30-hour battery life and plush memory-foam cushions. Perfect for focused work or the commute home.",
    minTier: "gold",
    deliveryMethod: "shipped",
    deliveryEstimate: "Ships in 3–5 business days",
    terms: "Ships to U.S. addresses only. Covered by the manufacturer's one-year warranty.",
    inventory: 40,
    featured: true,
    optionField: { key: "color", label: "Color", choices: ["Midnight", "Silver"] },
    variants: [{ label: "Headphones", points: 4500 }],
  },
  {
    slug: "smart-watch",
    name: "Smart Watch",
    category: "merchandise",
    tagline: "Health, fitness and notifications on your wrist.",
    description:
      "A sleek smartwatch with an always-on display, heart-rate and sleep tracking, and up to two days of battery. Pairs with iPhone and Android.",
    minTier: "platinum",
    deliveryMethod: "shipped",
    deliveryEstimate: "Ships in 3–5 business days",
    terms: "Ships to U.S. addresses only. Covered by the manufacturer's one-year warranty.",
    inventory: 15,
    optionField: { key: "band", label: "Band size", choices: ["Small/Medium", "Medium/Large"] },
    variants: [{ label: "Smart watch", points: 8000 }],
  },
  {
    slug: "dinner-for-two",
    name: "Dinner for Two",
    category: "experiences",
    tagline: "A night out at a restaurant near you.",
    description:
      "A $150 restaurant certificate redeemable at thousands of independent and fine-dining restaurants. Choose a spot near you and celebrate the wins.",
    minTier: "gold",
    deliveryMethod: "digital_email",
    deliveryEstimate: "Within 2 business days",
    terms: "Certificate valid for 12 months from delivery. Excludes tax and gratuity. Participating restaurants vary by city.",
    inventory: null,
    featured: true,
    variants: [{ label: "$150 certificate", points: 3000, valueCents: 15000 }],
  },
  {
    slug: "courtside-night-out",
    name: "Courtside Night Out",
    category: "experiences",
    tagline: "Two premium seats at a game this season.",
    description:
      "Two premium tickets to a professional game in your region, coordinated by our rewards concierge. We'll reach out to match a date and team you'll love.",
    minTier: "gold",
    deliveryMethod: "scheduled",
    deliveryEstimate: "Concierge contacts you within 3 business days",
    terms: "Subject to availability in your region. Tickets are non-transferable once issued. Travel not included.",
    inventory: 3,
    variants: [{ label: "Two tickets", points: 6500 }],
  },
  {
    slug: "weekend-getaway",
    name: "Weekend Getaway",
    category: "experiences",
    tagline: "Two nights for two at a resort you choose.",
    description:
      "Two nights for two at a partner resort, with a concierge to plan the details. Pick a beach, mountain or city escape and take a well-earned break.",
    minTier: "platinum",
    deliveryMethod: "scheduled",
    deliveryEstimate: "Concierge contacts you within 3 business days",
    terms: "Must be booked within 12 months. Blackout dates apply. Airfare not included.",
    inventory: null,
    variants: [{ label: "Two nights", points: 20000 }],
  },
  {
    slug: "bookkeeping-session",
    name: "Bookkeeping Session",
    category: "business_services",
    tagline: "One session to tidy up your books.",
    description:
      "A 90-minute virtual session with a certified bookkeeping partner to reconcile accounts, clean up categories and set up a simple monthly routine.",
    minTier: "silver",
    deliveryMethod: "scheduled",
    deliveryEstimate: "Scheduled within 5 business days",
    terms: "Provided by an independent partner. Not tax or legal advice. Reschedule up to 24 hours before your session.",
    inventory: null,
    variants: [{ label: "90-minute session", points: 2000 }],
  },
  {
    slug: "credit-concierge-review",
    name: "Credit Concierge Review",
    category: "business_services",
    tagline: "A one-on-one business credit review.",
    description:
      "Sit down with our Credit Concierge team for a review of your business credit profile and a clear plan to strengthen it ahead of your next funding.",
    minTier: "silver",
    deliveryMethod: "scheduled",
    deliveryEstimate: "Scheduled within 3 business days",
    terms: "Reviews use a soft inquiry and do not affect your credit score. Recommendations are educational.",
    inventory: null,
    featured: true,
    variants: [{ label: "Review session", points: 2500 }],
  },
  {
    slug: "marketing-credit",
    name: "Marketing Credit",
    category: "business_services",
    tagline: "Ad credit toward the platform you choose.",
    description:
      "Credit applied toward search, social or local listing ads through our marketing partner, with a quick setup call to point it at the right customers.",
    minTier: "gold",
    deliveryMethod: "account_credit",
    deliveryEstimate: "Applied within 5 business days",
    terms: "Credit must be used within 90 days. Platform availability may change. Unused credit has no cash value.",
    inventory: null,
    optionField: { key: "platform", label: "Ad platform", choices: ["Search ads", "Social ads", "Local listings"] },
    variants: [
      { label: "$250 credit", points: 4000, valueCents: 25000 },
      { label: "$500 credit", points: 7500, valueCents: 50000 },
    ],
  },
  {
    slug: "website-refresh",
    name: "Website Refresh Consult",
    category: "business_services",
    tagline: "Expert review of your site, with quick wins.",
    description:
      "A one-hour working session with a web strategist who reviews your site on desktop and mobile and leaves you with a prioritized list of improvements.",
    minTier: "gold",
    deliveryMethod: "scheduled",
    deliveryEstimate: "Scheduled within 5 business days",
    terms: "Consultation only; implementation is not included. Reschedule up to 24 hours before your session.",
    inventory: null,
    variants: [{ label: "One-hour consult", points: 3500 }],
  },
  {
    slug: "community-donation",
    name: "Community Donation",
    category: "giving_back",
    tagline: "We donate to a cause you choose.",
    description:
      "Turn your points into a donation in your business's name. Choose a cause and we'll send you a confirmation once the gift is made.",
    minTier: "silver",
    deliveryMethod: "donation",
    deliveryEstimate: "Confirmation within 10 business days",
    terms: "Donations are made by Big Think Capital and are not tax-deductible for your business. Causes may change.",
    inventory: null,
    featured: false,
    optionField: {
      key: "cause",
      label: "Cause",
      choices: ["Local food banks", "Small business relief", "Youth financial education"],
    },
    variants: [
      { label: "$25 donation", points: 1500, valueCents: 2500 },
      { label: "$50 donation", points: 3000, valueCents: 5000 },
      { label: "$100 donation", points: 6000, valueCents: 10000 },
    ],
  },
  {
    slug: "plant-100-trees",
    name: "Plant 100 Trees",
    category: "giving_back",
    tagline: "Reforestation in your business's name.",
    description:
      "We fund the planting of 100 trees through a reforestation partner and send you a certificate you can share with customers.",
    minTier: "silver",
    deliveryMethod: "donation",
    deliveryEstimate: "Certificate within 10 business days",
    terms: "Planting locations are selected by our partner. Certificates are delivered by email.",
    inventory: null,
    variants: [{ label: "100 trees", points: 1000 }],
  },
];

export const IMAGE_FOR_SLUG: Record<string, string> = {
  "digital-prepaid-card": "/images/rewards/prepaid-card.webp",
  "cafe-gift-card": "/images/rewards/coffee-card.webp",
  "branded-welcome-kit": "/images/rewards/welcome-kit.webp",
  "leather-padfolio": "/images/rewards/padfolio.webp",
  "premium-headphones": "/images/rewards/headphones.webp",
  "smart-watch": "/images/rewards/smartwatch.webp",
  "dinner-for-two": "/images/rewards/dinner-for-two.webp",
  "courtside-night-out": "/images/rewards/game-tickets.webp",
  "weekend-getaway": "/images/rewards/getaway.webp",
  "bookkeeping-session": "/images/rewards/bookkeeping.webp",
  "credit-concierge-review": "/images/rewards/credit-review.webp",
  "marketing-credit": "/images/rewards/marketing-credit.webp",
  "website-refresh": "/images/rewards/website-refresh.webp",
  "community-donation": "/images/rewards/charity.webp",
  "plant-100-trees": "/images/rewards/trees.webp",
};

export const IMAGE_LIBRARY = Object.values(IMAGE_FOR_SLUG);
