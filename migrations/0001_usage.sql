-- Daily call counter for /api/seance (D1 binding: SEANCE_DB).
-- One row per UTC day; api/d1-store.js checks and increments it in one statement.
CREATE TABLE IF NOT EXISTS usage (
  day TEXT PRIMARY KEY,
  n INTEGER NOT NULL
);
