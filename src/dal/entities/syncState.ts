import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

export enum SyncStatus {
  SYNCING = 'SYNCING',
  READY = 'READY',
}

@Entity('sync_state')
export class SyncStateEntry {
  @PrimaryColumn({ name: 'layer_name', type: 'text' })
  public layerName!: string;

  @Column({ type: 'text', default: SyncStatus.SYNCING })
  public status!: SyncStatus;

  @Column({ name: 'last_offset', type: 'integer', default: 0 })
  public lastOffset!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  public updatedAt!: Date;
}
