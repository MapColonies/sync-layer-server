-- 2026-04-15
-- `layer_objects` is a LIST-partitioned parent table on `layer_name`.
-- Per-layer partitions (layer_<name>) are created at runtime by ensureLayerPartitions()
-- in src/dal/connection.ts based on sync.layers in config.

CREATE TABLE IF NOT EXISTS sync_state (
  layer_name  TEXT PRIMARY KEY,
  status      TEXT NOT NULL DEFAULT 'SYNCING',
  last_offset INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS layer_objects (
  layer_name  TEXT NOT NULL,
  id          TEXT NOT NULL,
  geometry    JSONB,
  properties  JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (layer_name, id)
) PARTITION BY LIST (layer_name);
