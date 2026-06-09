import type { Logger } from '@map-colonies/js-logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteDeprecatedObjects } from '@src/dal/repositories/layerDataRepository';

const mockExecute = vi.fn();
const mockWhere = vi.fn().mockReturnValue({ execute: mockExecute });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockDelete = vi.fn().mockReturnValue({ from: mockFrom });
const mockCreateQueryBuilder = vi.fn().mockReturnValue({ delete: mockDelete });
const mockGetRepository = vi.fn().mockReturnValue({ createQueryBuilder: mockCreateQueryBuilder });

vi.mock('@src/dal/connection', () => ({
  getDataSource: () => ({ getRepository: mockGetRepository }),
}));

vi.mock('@opentelemetry/api', () => ({
  trace: { getTracer: () => ({}) },
}));

vi.mock('@map-colonies/tracing-utils', () => ({
  asyncCallWithSpan: async (fn: () => Promise<void>) => fn(),
}));

function makeLogger(): Logger {
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

describe('deleteDeprecatedObjects', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = makeLogger();
    vi.clearAllMocks();
    mockCreateQueryBuilder.mockReturnValue({ delete: mockDelete });
    mockDelete.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ execute: mockExecute });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fall back to per-object deletes when batch delete throws', async () => {
    const ids = ['id1', 'id2', 'id3'];
    mockExecute.mockRejectedValueOnce(new Error('batch error'));
    mockExecute.mockResolvedValueOnce(undefined);
    mockExecute.mockResolvedValueOnce(undefined);
    mockExecute.mockResolvedValueOnce(undefined);

    await deleteDeprecatedObjects(logger, 'obstacles', ids);

    // Batch call + 3 individual calls = 4 total execute calls
    expect(mockExecute).toHaveBeenCalledTimes(4);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'Batch delete failed, falling back to per-object deletes', layerName: 'obstacles', count: 3 })
    );
    // Verify where was called with each individual id
    expect(mockWhere).toHaveBeenCalledWith('layer_name = :layerName AND id = :id', { layerName: 'obstacles', id: 'id1' });
    expect(mockWhere).toHaveBeenCalledWith('layer_name = :layerName AND id = :id', { layerName: 'obstacles', id: 'id2' });
    expect(mockWhere).toHaveBeenCalledWith('layer_name = :layerName AND id = :id', { layerName: 'obstacles', id: 'id3' });
  });

  it('should log error and continue when individual delete also fails', async () => {
    const ids = ['id1', 'id2', 'id3'];
    mockExecute.mockRejectedValueOnce(new Error('batch error'));
    mockExecute.mockRejectedValueOnce(new Error('individual error'));
    mockExecute.mockResolvedValueOnce(undefined);
    mockExecute.mockResolvedValueOnce(undefined);

    await deleteDeprecatedObjects(logger, 'obstacles', ids);

    // Still attempts all individual deletes despite one failing
    expect(mockExecute).toHaveBeenCalledTimes(4);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'Delete failed for object, skipping', layerName: 'obstacles', id: 'id1' })
    );
    // id2 and id3 are still attempted
    expect(mockWhere).toHaveBeenCalledWith('layer_name = :layerName AND id = :id', { layerName: 'obstacles', id: 'id2' });
    expect(mockWhere).toHaveBeenCalledWith('layer_name = :layerName AND id = :id', { layerName: 'obstacles', id: 'id3' });
  });

  it('should not call any delete when deletedIds is empty', async () => {
    await deleteDeprecatedObjects(logger, 'obstacles', []);

    expect(mockExecute).not.toHaveBeenCalled();
  });
});
