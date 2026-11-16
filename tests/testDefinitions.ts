import type { Logger } from '@map-colonies/js-logger';
import { vi } from 'vitest';
import type { SyncConfig } from '@src/types';

export function makeLogger(): Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  } as unknown as Logger;
}

export function makeSyncConfig(layerNames: string[], overrides: Partial<SyncConfig> = {}): SyncConfig {
  return {
    layers: layerNames.map((name) => ({ name, query: `query { ${name} { id } }` })),
    syncIntervalMs: 500,
    pollIntervalMs: 600_000,
    pageSize: 100,
    thirdPartyBaseUrl: 'https://example.test/graphql',
    realityId: 1,
    requestingSystem: 'sync-layer-server_test',
    requestingSystemName: 'sync-layer-server',
    useDeleteEntities: true,
    authToken: 'token',
    ...overrides,
  };
}
