import { setTimeout as sleep } from 'node:timers/promises';
import type { Logger } from '@map-colonies/js-logger';
import { Heap } from 'heap-js';
import type { ScheduleEntry } from '../types';
import { getSyncConfig } from '../common/syncConfig';
import * as syncStateRepository from '../dal/repositories/syncStateRepository';
import { fetchAndSyncLayerPage } from '../handler/layerSyncHandler';

const scheduleComparator = (a: ScheduleEntry, b: ScheduleEntry): number => a.nextRunAt - b.nextRunAt;

export class SyncManager {
  private running = false;
  private readonly heap = new Heap<ScheduleEntry>(scheduleComparator);
  private abortController: AbortController | null = null;

  public constructor(private readonly logger: Logger) {}

  public async start(): Promise<void> {
    const config = getSyncConfig();

    this.logger.info(`Initializing sync for layers: ${config.layers.join(', ')}`);

    await syncStateRepository.initializeSyncState(config.layers);

    const initNowTime = Date.now();
    const states = await syncStateRepository.getAllSyncStates();
    for (const state of states) {
      this.heap.push({ layerName: state.layerName, nextRunAt: initNowTime });
      this.logger.info(`Layer "${state.layerName}" scheduled - status: ${state.status}, offset: ${state.lastOffset}`);
    }

    this.running = true;
    void this.runSchedulerLoop();
  }

  public stop(): void {
    this.logger.info('Stopping sync manager...');
    this.running = false;
    this.abortController?.abort();
  }

  private async runSchedulerLoop(): Promise<void> {
    while (this.running) {
      const scheduledEntry = this.heap.pop();
      if (!scheduledEntry) {
        this.logger.warn('No layers in schedule, stopping');
        break;
      }

      const waitMs = scheduledEntry.nextRunAt - Date.now();
      if (waitMs > 0) {
        this.logger.debug(`Sleeping ${waitMs}ms until layer "${scheduledEntry.layerName}" is due`);
        try {
          this.abortController = new AbortController();
          await sleep(waitMs, undefined, { signal: this.abortController.signal });
        } catch {
          if (!this.running) {
            this.heap.push(scheduledEntry);
            break;
          }
        } finally {
          this.abortController = null;
        }
      }

      await fetchAndSyncLayerPage(this.logger, scheduledEntry);

      this.heap.push(scheduledEntry);
    }

    this.logger.info('Scheduler loop exited');
  }
}
