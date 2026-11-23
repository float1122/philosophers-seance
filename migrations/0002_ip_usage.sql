-- Per-IP daily call counter for /api/seance (D1 binding: SEANCE_DB).
-- ip_hash = SHA-256(day + ":" + ip + ":" + IP_HASH_SALT); the raw IP is never
-- stored. api/ip-store.js deletes rows from other days on each call.
CREATE TABLE IF NOT EXISTS ip_usage (
  day TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (day, ip_hash)
);
