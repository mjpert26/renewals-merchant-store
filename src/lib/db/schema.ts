// SQLite schema for the demo persistence layer.
//
// The ledger (ledger_entries) is the source of truth. point_accounts is a
// projection that is updated in the same transaction as every ledger write and
// carries CHECK constraints so that a spendable balance can never go negative,
// even if application code has a bug. Idempotency keys are UNIQUE so retried
// imports, webhook deliveries and double-submitted forms cannot double-post.

export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  owner_first_name TEXT NOT NULL,
  owner_last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  industry TEXT NOT NULL,
  member_since TEXT NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  account_manager TEXT NOT NULL,
  external_ref TEXT UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('merchant', 'admin')),
  title TEXT,
  merchant_id TEXT REFERENCES merchants(id),
  CHECK ((role = 'merchant' AND merchant_id IS NOT NULL) OR (role = 'admin' AND merchant_id IS NULL))
);

CREATE TABLE IF NOT EXISTS point_accounts (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),
  available INTEGER NOT NULL DEFAULT 0 CHECK (available >= 0),
  pending INTEGER NOT NULL DEFAULT 0 CHECK (pending >= 0),
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  redeemed INTEGER NOT NULL DEFAULT 0 CHECK (redeemed >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  type TEXT NOT NULL CHECK (type IN ('earn_pending','release','pending_reversal','bonus','redeem','refund','adjustment','expiration')),
  available_delta INTEGER NOT NULL,
  pending_delta INTEGER NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  ref_type TEXT,
  ref_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_merchant ON ledger_entries(merchant_id, created_at);

CREATE TABLE IF NOT EXISTS funding_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  deal_type TEXT NOT NULL CHECK (deal_type IN ('initial', 'renewal')),
  funded_amount_cents INTEGER NOT NULL CHECK (funded_amount_cents > 0),
  funded_at TEXT NOT NULL,
  points INTEGER NOT NULL CHECK (points >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'released', 'reversed')),
  released_at TEXT,
  simulated INTEGER NOT NULL DEFAULT 0,
  payload TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  image TEXT NOT NULL,
  min_tier TEXT NOT NULL CHECK (min_tier IN ('silver', 'gold', 'platinum')),
  delivery_method TEXT NOT NULL,
  delivery_estimate TEXT NOT NULL,
  terms TEXT NOT NULL,
  inventory INTEGER CHECK (inventory IS NULL OR inventory >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  option_field TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reward_variants (
  id TEXT PRIMARY KEY,
  reward_id TEXT NOT NULL REFERENCES rewards(id),
  label TEXT NOT NULL,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  value_cents INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS redemptions (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  reward_id TEXT NOT NULL REFERENCES rewards(id),
  variant_id TEXT NOT NULL REFERENCES reward_variants(id),
  reward_name TEXT NOT NULL,
  variant_label TEXT NOT NULL,
  reward_image TEXT NOT NULL,
  category TEXT NOT NULL,
  delivery_method TEXT NOT NULL,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  balance_after INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested','processing','shipped','fulfilled','canceled','failed')),
  details TEXT NOT NULL,
  fulfillment_provider TEXT NOT NULL,
  fulfillment_note TEXT,
  tracking_info TEXT,
  simulated INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_redemptions_merchant ON redemptions(merchant_id, created_at);

CREATE TABLE IF NOT EXISTS redemption_events (
  id TEXT PRIMARY KEY,
  redemption_id TEXT NOT NULL REFERENCES redemptions(id),
  status TEXT NOT NULL,
  note TEXT,
  actor TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  business_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  consent INTEGER NOT NULL CHECK (consent = 1),
  status TEXT NOT NULL CHECK (status IN ('submitted','in_review','funded','not_funded')),
  bonus_points INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones_awarded (
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  code TEXT NOT NULL,
  awarded_at TEXT NOT NULL,
  points INTEGER NOT NULL,
  PRIMARY KEY (merchant_id, code)
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),
  prefs TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS support_requests (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  topic TEXT NOT NULL,
  preferred_time TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS program_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  merchant_id TEXT,
  summary TEXT NOT NULL,
  reason TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS dismissals (
  merchant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (merchant_id, key)
);
`;
