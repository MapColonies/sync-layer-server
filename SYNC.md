# Sync Layer Module

## Overview

The sync module continuously synchronizes geospatial layer data from a third-party GraphQL API into a remote PostgreSQL database. It fetches data in pages, inserts new objects, deletes deprecated ones, and tracks progress per layer using an opaque `sequence` cursor returned by the third-party API.

## Architecture

```
┌──────────────────┐
│   SyncManager    │  Scheduler loop (min-heap by next run time)
│                  │  Manages lifecycle: start / stop
└───────┬──────────┘
        │
        ▼
┌──────────────────┐
│ LayerSyncHandler │  Orchestrates a single page fetch + process cycle
│                  │  Coordinates all repositories and the client
└──┬──────┬────────┘
   │      │
   ▼      ▼
┌──────┐ ┌───────────────────┐ ┌───────────────────┐
│Third │ │ SyncState         │ │ LayerData         │
│Party │ │ Repository        │ │ Repository        │
│Client│ │(lastSequence,stat)│ │ (insert/delete)   │
└──────┘ └───────────────────┘ └───────────────────┘
```

## File Structure

```
src/
├── scheduler/
│   └── syncManager.ts            # Scheduler loop with min-heap priority queue
├── handler/
│   └── layerSyncHandler.ts       # Single-page fetch and process orchestration
├── externalClients/
│   ├── layersClient/
│   │   └── layersClient.ts       # GraphQL client for the third-party API
│   └── layersClientModel.ts      # buildLayerQuery(layerName) helper
├── dal/
│   └── repositories/
│       ├── syncStateRepository.ts    # Tracks last sync sequence and status per layer
│       └── layerDataRepository.ts    # Inserts new objects / deletes deprecated ones
├── common/
│   ├── syncConfig.ts             # Static config (layers, intervals, page size, URL)
│   └── ...                       # Shared infra (config, constants, DI, tracing)
└── types/
    ├── index.ts                  # Barrel export
    ├── syncConfig.ts             # SyncConfig interface
    ├── syncState.ts              # SyncStatus enum + SyncStateEntry interface
    ├── scheduler.ts              # ScheduleEntry interface
    └── thirdParty.ts             # LayerObject, ThirdPartyResponse
```

## How It Works

### Sync Lifecycle

1. **Startup** - `SyncManager.start()` reads the configured layers, initializes sync state for each (status: `SYNCING`, lastSequence: `"0"`), and pushes them into a min-heap scheduler.

2. **Scheduler Loop** - The loop pops the next due layer, sleeps until its scheduled time, then calls `fetchAndSyncLayerPage()`.

3. **Page Fetch** - `layerClient.fetchPage()` POSTs a GraphQL query (`query { <layerName> { ... } }`) to the third-party API. All pagination and identification inputs are passed via HTTP headers: `reality-id`, `requesting-sys`, `requesting-sys-name`, `sequence`, `page-size`, `Authorization`, `use-Delete-Entities`.

4. **Data Processing** - The handler reads the response (`data.<layerName>` + `extensions`) and delegates to `layerDataRepository`:
   - `insertObjects()` - Batch upserts new/updated geospatial objects into the remote DB layer table.
   - `deleteDeprecatedObjects()` - Batch deletes deprecated objects by id (from `extensions.deletedEntitiesIds`).

5. **State Update** - `syncStateRepository` advances the stored `lastSequence` to `extensions.sequence`.

6. **Status Transition** - When a page returns `fetchedEntitiesCount === 0` during `SYNCING`, the layer transitions to `READY` (initial sync complete).

7. **Re-schedule** - The layer is pushed back into the heap with:
   - `syncIntervalMs` (500ms) while `SYNCING` (fast initial catch-up)
   - `pollIntervalMs` (10 min) once `READY` (periodic polling for changes)

### Configuration

| Property               | Default                           | Description                                            |
| ---------------------- | --------------------------------- | ------------------------------------------------------ |
| `layers`               | `['obstacles']`                   | Layer names to sync                                    |
| `syncIntervalMs`       | `500`                             | Delay between pages during initial sync                |
| `pollIntervalMs`       | `600000` (10 min)                 | Delay between polls after initial sync completes       |
| `pageSize`             | `1000`                            | Max records requested per page (sent as `page-size`)   |
| `thirdPartyBaseUrl`    | `http://mock-third-party/graphql` | GraphQL endpoint URL                                   |
| `realityId`            | `0`                               | Sent as the `reality-id` header (e.g. `0` = prod)      |
| `requestingSystem`     | `sync-layer-server_prod`          | Sent as the `requesting-sys` header                    |
| `requestingSystemName` | `sync-layer-server`               | Sent as the `requesting-sys-name` header               |
| `useDeleteEntities`    | `true`                            | Sent as `use-Delete-Entities` (include deprecated ids) |
| `auth.token`           | `""`                              | Sent as the `Authorization` header                     |

## What Still Needs to Be Done

### Remote Database Integration

- [ ] **syncStateRepository** - Persist sync state (lastSequence, status) to a `sync_state` table in the remote PostgreSQL database instead of the in-memory `Map`. Currently resets on restart.
- [ ] **layerDataRepository** - Implement actual SQL queries for `INSERT ... ON CONFLICT` (upsert) and `UPDATE` with JSONB merge against the remote DB. Tables should match layer names.
- [ ] **DB connection** - Set up a connection pool (e.g., `pg` / `knex` / `typeorm`) to the remote PostgreSQL instance with connection string from config/environment.

### Configuration

- [ ] **syncConfig** - Load config from the application config provider (e.g., `node-config` / environment variables) instead of hardcoded values.
- [ ] **thirdPartyBaseUrl** - Set the real third-party GraphQL endpoint URL.

### GraphQL

- [ ] **queries.ts** - Verify and adjust the GraphQL query schema to match the actual third-party API contract.

### Error Handling & Resilience

- [ ] Handle partial page failures (some objects succeed, some fail).

### Observability

- [ ] Add metrics (pages fetched, objects inserted, errors) via `prom-client`.
- [ ] Add OpenTelemetry spans for tracing sync operations.

### Testing

- [ ] Unit tests for `layerSyncHandler` (mock the repositories and client).
- [ ] Unit tests for `syncManager` scheduling logic.
- [ ] Integration tests with a real database.
