-- Memorial site database (Cloudflare D1 / SQLite).
-- Run once:  npx wrangler d1 execute memorial-db --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS stats (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO stats (key, value) VALUES ('roses', 0);

-- Up to 10 roses per device; one row per device (so the row count is the number of people).
-- status: 'visible' or 'hidden' (hiding removes only the name; the roses still count).
CREATE TABLE IF NOT EXISTS roses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id  TEXT NOT NULL UNIQUE,
  roses      INTEGER NOT NULL DEFAULT 1,
  name       TEXT,
  place      TEXT,
  named_at   TEXT,
  ip_hash    TEXT,
  status     TEXT NOT NULL DEFAULT 'visible',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS roses_ip   ON roses (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS roses_list ON roses (status, id);

-- The condolence book. status: 'visible', 'pending' (waiting for approval) or 'hidden'.
CREATE TABLE IF NOT EXISTS condolences (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  place      TEXT,
  message    TEXT NOT NULL,
  device_id  TEXT,
  ip_hash    TEXT,
  status     TEXT NOT NULL DEFAULT 'visible',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS cond_list   ON condolences (status, id);
CREATE INDEX IF NOT EXISTS cond_device ON condolences (device_id, created_at);
CREATE INDEX IF NOT EXISTS cond_ip     ON condolences (ip_hash, created_at);
