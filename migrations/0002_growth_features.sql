-- K-M Promotions growth features: featured deals, reviews and newsletter
ALTER TABLE products ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN sale_price TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN deal_label TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN deal_ends_at TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS product_reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  review_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status ON product_reviews(product_id,status,created_at);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'subscribed',
  consent_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  unsubscribed_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_newsletter_status_created ON newsletter_subscribers(status,created_at);
