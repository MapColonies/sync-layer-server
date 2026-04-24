-- 2026-04-15
-- `layer_objects` is a LIST-partitioned parent table on `layer_name`.
-- Per-layer partitions (layer_<name>) are created at runtime by ensureLayerPartitions()
-- in src/dal/connection.ts based on sync.layers in config.
-- Requires the PostGIS extension for the `footprint` geometry column + GiST index.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS sync_state (
  layer_name  TEXT PRIMARY KEY,
  status      TEXT NOT NULL DEFAULT 'SYNCING',
  last_sequence TEXT NOT NULL DEFAULT '0',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS layer_objects (
  layer_name  TEXT NOT NULL,
  id          TEXT NOT NULL,
  footprint   geometry(Polygon, 4326) NOT NULL,
  properties  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (layer_name, id),
  CONSTRAINT layer_objects_valid_geometry CHECK (ST_IsValid(footprint)),
  CONSTRAINT layer_objects_extent CHECK (
    Box2D(footprint) @ Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)', 4326))
  )
) PARTITION BY LIST (layer_name);

CREATE INDEX IF NOT EXISTS idx_layer_objects_footprint
  ON layer_objects USING GIST (footprint);
