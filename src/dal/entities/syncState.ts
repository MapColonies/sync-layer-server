import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

export enum SyncStatus {
  SYNCING = 'SYNCING',
  READY = 'READY',
}

@Entity('sync_state')
export class SyncStateEntry {
  @PrimaryColumn({ name: 'layer_name', type: 'text' })
  public layerName!: string;

  @Column({ type: 'enum', enum: SyncStatus, default: SyncStatus.SYNCING })
  public status!: SyncStatus;

  @Column({ name: 'last_sequence', type: 'text', default: '0' })
  public lastSequence!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  public updatedAt!: Date;
}
