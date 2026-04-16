-- 2026-04-15

CREATE TABLE IF NOT EXISTS sync_state (
  layer_name  TEXT PRIMARY KEY,
  status      TEXT NOT NULL DEFAULT 'SYNCING',
  last_offset INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "layer_obstacles" (
  id          TEXT PRIMARY KEY,
  geometry    JSONB,
  properties  JSONB NOT NULL DEFAULT '{}'::jsonb
);
