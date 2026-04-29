import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTables1713196800000 implements MigrationInterface {
  public name = 'CreateTables1713196800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status_enum') THEN
          CREATE TYPE "sync_status_enum" AS ENUM ('SYNCING', 'READY');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sync_state (
        layer_name    TEXT PRIMARY KEY,
        status        "sync_status_enum" NOT NULL DEFAULT 'SYNCING'::"sync_status_enum",
        last_sequence TEXT NOT NULL DEFAULT '0',
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS layer_objects (
        layer_name TEXT NOT NULL,
        id         TEXT NOT NULL,
        geom       geometry NOT NULL,
        properties JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (layer_name, id),
        CONSTRAINT layer_objects_valid_geometry CHECK (ST_IsValid(geom)),
        CONSTRAINT layer_objects_extent CHECK (
          Box2D(geom) @ Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)', 4326))
        )
      ) PARTITION BY LIST (layer_name)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_layer_objects_geom
        ON layer_objects USING GIST (geom)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_layer_objects_geom`);
    await queryRunner.query(`DROP TABLE IF EXISTS layer_objects`);
    await queryRunner.query(`DROP TABLE IF EXISTS sync_state`);
    await queryRunner.query(`DROP TYPE IF EXISTS "sync_status_enum"`);
  }
}
