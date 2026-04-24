# MAPCO-10451: TypeORM + DB Connection (partitioned multi-layer)

## Summary

Introduces a PostgreSQL data-access layer based on [TypeORM](https://typeorm.io/) and wires its lifecycle into the existing DI container and graceful-shutdown flow. Before this PR, the sync state and layer data were held in memory and reset on every restart; now they are persisted in PostgreSQL.

The layer data schema uses **native PostgreSQL LIST partitioning**: there is a single logical parent table `layer_objects` partitioned by `layer_name`, and each configured layer gets its own **physical partition** table (`layer_<layerName>`) created automatically at startup. The application code is layer-agnostic - one entity, one repository - and Postgres routes rows to the correct partition based on the `layer_name` column.

## What was added

### Database schema

- `**migrations/001_create_tables.sql`** - bootstrap SQL creating:
  - `sync_state` - shared table tracking per-layer sync status (`layer_name`, `status`, `last_offset`, `updated_at`).
  - `layer_objects` - LIST-partitioned **parent** table keyed by `layer_name`, with composite PK `(layer_name, id)` and columns `geometry` (JSONB) and `properties` (JSONB). The parent stores no rows - each layer's data lives in its own partition.
  - Per-layer partitions (`layer_<name>`) are **not** in the migration; they are created at runtime by `ensureLayerPartitions()` based on `sync.layers`.

### Config

- `**config/default.json`** - new `db` section (host, port, database, username, password, ssl).
- `**src/types/dbConfig.ts**` - `DbConfig` interface.
- `**src/common/dbConfig.ts**` - `getDbConfig()` helper, mirrors the existing `getSyncConfig()` pattern on top of `@map-colonies/config`.

### Connection lifecycle

- `**src/dal/connection.ts**`
  - `createDataSource()` - builds a TypeORM `DataSource` from `getDbConfig()` with two entities: `SyncStateEntry` and `LayerObjectEntity`.
  - `initializeDb(layers)` - idempotent connect, called once on startup. Also runs `ensureLayerPartitions()` so every layer declared in config has a physical partition ready.
  - `ensureLayerPartitions(ds, layers)` - runs `CREATE TABLE IF NOT EXISTS "layer_<name>" PARTITION OF layer_objects FOR VALUES IN ('<name>')` for each configured layer.
  - `getDataSource()` - safe accessor used by repositories.
  - `closeDb()` - graceful disconnect, wired into the existing `onSignal` shutdown hook.

### Entities

- `**src/dal/entities/syncState.ts**` - `SyncStateEntry` `@Entity('sync_state')` class with `layerName`, `status`, `lastOffset`, `updatedAt` columns (plus the existing `SyncStatus` enum).
- `**src/dal/entities/layerObject.ts**` - a **single** `LayerObjectEntity` mapped to the partitioned parent `layer_objects`:
  - Composite primary key `(layer_name, id)` (required because `layer_name` is the partition key).
  - Columns: `geometry JSONB NULL`, `properties JSONB NOT NULL DEFAULT '{}'`.
  - `getLayerPartitionName(layerName)` helper returns the child-partition name (`layer_<layerName>`), used by `ensureLayerPartitions()`.
  - `LayerObject` / `DeprecatedObject` domain types for the external API.
- `**src/dal/entities/index.ts`** - re-exports the entity class, the partition-name helper, and the types.

### Repositories (DB-backed, async)

- `**src/dal/repositories/syncStateRepository.ts**` - unchanged shape, backed by the shared `sync_state` table.
- `**src/dal/repositories/layerDataRepository.ts**` - layer-aware via the `layer_name` column, **not** via dynamic entities or table names:
  - `insertObjects(layerName, objects)` - bulk upsert into `layer_objects`, with `layer_name` stamped on every row; uses `orUpdate(['geometry', 'properties'], ['layer_name', 'id'])`. Postgres routes each row to the `layer_<layerName>` partition automatically.
  - `deleteDeprecatedObjects(layerName, deprecated)` - batch `DELETE FROM layer_objects WHERE layer_name = :layerName AND id IN (:...ids)`. Partition pruning limits the delete to the matching partition.

### Wiring

- `**src/containerConfig.ts`** - reads `sync.layers` via `getSyncConfig()`, calls `await initializeDb(syncConfig.layers)` during bootstrap, logs the connection target + active layer partitions, and calls `closeDb()` alongside `getTracing().stop()` in the `onSignal` shutdown hook.
- `**src/handler/layerSyncHandler.ts**` - awaits all now-async repository calls.
- `**src/scheduler/syncManager.ts**` - `start()` is now `async` and awaits state initialization / reads.
- `**src/index.ts**` - `void syncManager.start()` to keep the fire-and-forget semantics.
- `**src/types/syncState.ts**` + `**src/types/index.ts**` - re-export `SyncStateEntry` as a value (class) instead of a type, since TypeORM needs the class at runtime.

### Dependencies

- `package.json` - added:
  - `pg@^8.20.0`
  - `typeorm@^0.3.28`

## Adding a new layer

To onboard a new layer (e.g. `roads`):

1. Add it to `sync.layers` in `config/default.json` (or the env-specific config):
  ```json
   "sync": { "layers": ["obstacles", "roads"], ... }
  ```
2. Restart the service. On startup, `ensureLayerPartitions()` will run:
  ```sql
   CREATE TABLE IF NOT EXISTS "layer_roads" PARTITION OF layer_objects FOR VALUES IN ('roads');
  ```
3. No code changes are required - `insertObjects('roads', ...)` and `deleteDeprecatedObjects('roads', ...)` already take `layerName` as a parameter, and Postgres routes writes to `layer_roads` based on the `layer_name` column.

## Why LIST partitioning (and not per-layer tables or a flat table)

- **Per-layer tables (one `@Entity` each):** would force dynamic schema registration in TypeORM and dynamic table-name resolution in every query. Rejected - too much code complexity for an operational gain we can get for free.
- **Flat single table with a discriminator column:** simple code, but one shared heap means one VACUUM cycle, shared bloat, shared indexes, and no per-layer `TRUNCATE` / `DROP`. Hot layers starve cold ones in the page cache.
- **LIST-partitioned parent + per-layer partitions (this PR):** one logical entity and one code path, but each layer is a **real separate physical table** on disk with its own heap, indexes, statistics, and VACUUM cycle. Queries that filter by `layer_name` get partition pruning; `TRUNCATE layer_roads` / `DETACH PARTITION layer_trees` / per-partition backups are all trivial.

This matches the documented best-practice profile for LIST partitioning: a small, bounded set of discrete values (our layer names), a shared schema, and an access pattern that always filters on the partition key.

## Files changed


| File                                          | Change                                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `migrations/001_create_tables.sql`            | `sync_state` + LIST-partitioned `layer_objects` parent (partitions created at runtime)                    |
| `config/default.json`                         | + `db` section                                                                                            |
| `src/types/dbConfig.ts`                       | new - `DbConfig` interface                                                                                |
| `src/types/index.ts`                          | re-export `DbConfig`, `SyncStateEntry` as value                                                           |
| `src/types/syncState.ts`                      | re-export `SyncStateEntry` as value                                                                       |
| `src/common/dbConfig.ts`                      | new - `getDbConfig()`                                                                                     |
| `src/dal/connection.ts`                       | new - `DataSource` lifecycle + `ensureLayerPartitions()`                                                  |
| `src/dal/entities/syncState.ts`               | interface → `@Entity` class                                                                               |
| `src/dal/entities/layerObject.ts`             | single `@Entity('layer_objects')` with composite PK `(layer_name, id)` + `getLayerPartitionName()` helper |
| `src/dal/entities/index.ts`                   | export entity + partition-name helper + types                                                             |
| `src/dal/repositories/syncStateRepository.ts` | poolSizein-memory → TypeORM, async                                                                        |
| `src/dal/repositories/layerDataRepository.ts` | partition-aware writes via `layer_name` column; parameterized JSONB merge                                 |
| `src/handler/layerSyncHandler.ts`             | await async repo calls                                                                                    |
| `src/scheduler/syncManager.ts`                | `start()` → `async`                                                                                       |
| `src/index.ts`                                | `void syncManager.start()`                                                                                |
| `src/containerConfig.ts`                      | `initializeDb(syncConfig.layers)` on boot, `closeDb()` on signal                                          |
| `package.json`                                | + `pg`, `typeorm`                                                                                         |


## Migration / rollout

1. Apply `migrations/001_create_tables.sql` against the target PostgreSQL database (creates `sync_state` and the partitioned `layer_objects` parent). Per-layer partitions are created automatically on first startup.
2. Populate the `db` section of `config/default.json` (or the environment-specific config file) with the target host, port, database, username, password, ssl.
3. Set `sync.layers` to the list of layers you want to sync.
4. Deploy - `initializeDb()` runs on startup, ensures each layer's partition exists, and the service fails fast if the DB is unreachable. On `SIGINT` / `SIGTERM`, Terminus drains the sync loop and closes the `DataSource` via `closeDb()`.

## Notes

- Connection settings are read through `@map-colonies/config` (same mechanism as `sync`) - no new `process.env` reads were introduced.
- `SyncStateEntry` is exported as a value (class) because TypeORM needs the class reference at runtime (e.g. `getRepository(SyncStateEntry)`).
- The partition key `layer_name` is part of the primary key (required by Postgres for partitioned tables), so `(layer_name, id)` is the effective uniqueness constraint across the whole logical dataset.
- Layer names come from trusted config (`sync.layers`); they are interpolated into the `CREATE TABLE … PARTITION OF …` DDL in `ensureLayerPartitions()` - keep `sync.layers` out of any user-controlled input path.
- No HTTP routes were added; the service remains a background sync worker behind Terminus and Express middleware.

