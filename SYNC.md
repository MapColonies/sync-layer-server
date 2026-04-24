# Sync Layer Module

## Overview

The sync module continuously synchronizes geospatial layer data from a third-party GraphQL API into a remote PostgreSQL database. It fetches data in pages, inserts new objects, updates deprecated ones, and tracks progress per layer using offset-based pagination.

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
│Client│ │ (offset, status)  │ │ (insert/update)   │
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
│   └── layersClientModel.ts      # GetLayerPage query string
├── dal/
│   └── repositories/
│       ├── syncStateRepository.ts    # Tracks sync offset and status per layer
│       └── layerDataRepository.ts    # Inserts new objects / updates deprecated ones
├── common/
│   ├── syncConfig.ts             # Static config (layers, intervals, page size, URL)
│   └── ...                       # Shared infra (config, constants, DI, tracing)
└── types/
    ├── index.ts                  # Barrel export
    ├── syncConfig.ts             # SyncConfig interface
    ├── syncState.ts              # SyncStatus enum + SyncStateEntry interface
    ├── scheduler.ts              # ScheduleEntry interface
    └── thirdParty.ts             # LayerObject, DeprecatedObject, ThirdPartyResponse
```

## How It Works

### Sync Lifecycle

1. **Startup** - `SyncManager.start()` reads the configured layers, initializes sync state for each (status: `SYNCING`, offset: `0`), and pushes them into a min-heap scheduler.

2. **Scheduler Loop** - The loop pops the next due layer, sleeps until its scheduled time, then calls `fetchAndSyncLayerPage()`.

3. **Page Fetch** - `layerClient.fetchPage()` sends a GraphQL query to the third-party API requesting up to `pageSize` objects starting from the current offset.

4. **Data Processing** - The handler orchestrates the response and delegates to `layerDataRepository`:
   - `insertObjects()` - Batch upserts new/updated geospatial objects into the remote DB layer table.
   - `deleteDeprecatedObjects()` - Batch deletes deprecated objects from the remote DB by id.

5. **State Update** - `syncStateRepository` advances the offset to `nextRecord`.

6. **Status Transition** - When a page returns 0 objects during `SYNCING`, the layer transitions to `READY` (initial sync complete).

7. **Re-schedule** - The layer is pushed back into the heap with:
   - `syncIntervalMs` (500ms) while `SYNCING` (fast initial catch-up)
   - `pollIntervalMs` (10 min) once `READY` (periodic polling for changes)

### Configuration

| Property            | Default                          | Description                                      |
|---------------------|----------------------------------|--------------------------------------------------|
| `layers`            | `['obstacles']`                  | Layer names to sync                              |
| `syncIntervalMs`    | `500`                            | Delay between pages during initial sync          |
| `pollIntervalMs`    | `600000` (10 min)                | Delay between polls after initial sync completes |
| `pageSize`          | `500`                            | Max records requested per page                   |
| `thirdPartyBaseUrl` | `http://mock-third-party/graphql`| GraphQL endpoint URL                             |

## What Still Needs to Be Done

### Remote Database Integration
- [ ] **syncStateRepository** - Persist sync state (offset, status) to a `sync_state` table in the remote PostgreSQL database instead of the in-memory `Map`. Currently resets on restart.
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
