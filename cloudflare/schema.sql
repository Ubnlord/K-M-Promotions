-- K-M Promotions D1 schema
-- Mirrors the existing AppDeploy logical tables. IDs are retained during import.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  price TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'NGN',
  affiliate_url TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  media_json TEXT NOT NULL DEFAULT '[]',
  image_path TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_published_created ON products(published, created_at);

CREATE TABLE IF NOT EXISTS enquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  business TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_enquiries_created ON enquiries(created_at);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  budget TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS click_events (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_click_events_created ON click_events(created_at);
CREATE INDEX IF NOT EXISTS idx_click_events_product ON click_events(product_id);

CREATE TABLE IF NOT EXISTS conversions (
  id TEXT PRIMARY KEY,
  network TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  product_id TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  revenue REAL NOT NULL,
  commission REAL NOT NULL,
  currency TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  converted_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(network, transaction_id)
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  network TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  paid_at TEXT NOT NULL DEFAULT ''
);
