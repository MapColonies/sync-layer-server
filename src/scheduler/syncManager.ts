import { setTimeout as sleep } from 'node:timers/promises';
import { trace, type Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4 as withSpanAsync } from '@map-colonies/tracing-utils';
import type { Logger } from '@map-colonies/js-logger';
import { Heap } from 'heap-js';
import type { ScheduleEntry } from '../types';
import { getSyncConfig } from '../common/syncConfig';
import * as syncStateRepository from '../dal/repositories/syncStateRepository';
import { fetchAndSyncLayerPage } from '../handler/layerSyncHandler';
import { SERVICE_NAME } from '../common/constants';

const scheduleComparator = (a: ScheduleEntry, b: ScheduleEntry): number => a.nextRunAt - b.nextRunAt;

export class SyncManager {
  public readonly tracer: Tracer = trace.getTracer(SERVICE_NAME);
  private running = false;
  private readonly heap = new Heap<ScheduleEntry>(scheduleComparator);
  private abortController: AbortController | null = null;
  private loopPromise: Promise<void> | null = null;

  public constructor(private readonly logger: Logger) {}

  public async start(): Promise<void> {
    const config = getSyncConfig();

    const layers = config.layers.map((l) => l.name);
    this.logger.info(`Initializing sync for layers: ${layers.join(', ')}`);

    await this.initialize(layers);

    this.running = true;
    this.loopPromise = this.runSchedulerLoop();
  }

  public async stop(): Promise<void> {
    this.logger.info('Stopping sync manager...');
    this.running = false;
    this.abortController?.abort();
    if (this.loopPromise) {
      await this.loopPromise;
      this.loopPromise = null;
    }
  }

  @withSpanAsync
  private async initialize(layers: string[]): Promise<void> {
    await syncStateRepository.initializeSyncState(layers);

    const initNowTime = Date.now();
    const states = await syncStateRepository.getAllSyncStates();

    for (const state of states) {
      this.heap.push({ layerName: state.layerName, nextRunAt: initNowTime });
      this.logger.info(`Layer "${state.layerName}" scheduled - status: ${state.status}, lastSequence: ${state.lastSequence}`);
    }
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
