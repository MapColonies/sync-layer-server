-- Smoke test: confirm `layer_objects` accepts every PostGIS geometry subtype
-- under the existing CHECK constraints (ST_IsValid + Box2D extent).
-- Usage: psql ... -v ON_ERROR_STOP=1 -f 002_verify_geometry_types.sql
-- Safe to run repeatedly: rolls back at the end so no rows persist.

BEGIN;

CREATE TABLE IF NOT EXISTS "layer_geom_check_smoke"
  PARTITION OF layer_objects FOR VALUES IN ('__geom_check_smoke__');

INSERT INTO layer_objects (layer_name, id, geom, properties) VALUES
  ('__geom_check_smoke__', 'point',
    ST_GeomFromText('POINT(10 20)', 4326), '{}'::jsonb),
  ('__geom_check_smoke__', 'multipoint',
    ST_GeomFromText('MULTIPOINT((10 20),(30 40))', 4326), '{}'::jsonb),
  ('__geom_check_smoke__', 'linestring',
    ST_GeomFromText('LINESTRING(0 0, 1 1, 2 2)', 4326), '{}'::jsonb),
  ('__geom_check_smoke__', 'multilinestring',
    ST_GeomFromText('MULTILINESTRING((0 0, 1 1),(2 2, 3 3))', 4326), '{}'::jsonb),
  ('__geom_check_smoke__', 'polygon',
    ST_GeomFromText('POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))', 4326), '{}'::jsonb),
  ('__geom_check_smoke__', 'multipolygon',
    ST_GeomFromText('MULTIPOLYGON(((0 0, 1 0, 1 1, 0 1, 0 0)),((2 2, 3 2, 3 3, 2 3, 2 2)))', 4326), '{}'::jsonb);

DO $$
DECLARE
  expected CONSTANT TEXT[] := ARRAY['POINT','MULTIPOINT','LINESTRING','MULTILINESTRING','POLYGON','MULTIPOLYGON'];
  found    TEXT[];
BEGIN
  SELECT array_agg(DISTINCT GeometryType(geom) ORDER BY GeometryType(geom))
    INTO found
  FROM layer_objects
  WHERE layer_name = '__geom_check_smoke__';

  IF NOT (expected <@ found AND found <@ expected) THEN
    RAISE EXCEPTION 'geometry-type smoke test failed. expected=%, found=%', expected, found;
  END IF;
  RAISE NOTICE 'OK: all 6 geometry subtypes inserted and stored: %', found;
END $$;

ROLLBACK;
