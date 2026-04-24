import { Entity, PrimaryColumn, Column } from 'typeorm';


export function getLayerPartitionName(layerName: string): string {
  return `layer_${layerName}`;
}

@Entity('layer_objects')
export class LayerObjectEntity {
  @PrimaryColumn({ name: 'layer_name', type: 'text' })
  public layerName!: string;

  @PrimaryColumn({ type: 'text' })
  public id!: string;

  @Column({ type: 'jsonb', nullable: true })
  public geometry!: object | null;

  @Column({ type: 'jsonb', default: {} })
  public properties!: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  public createdAt!: Date;
}

export interface LayerObject {
  id: string;
  geometry: object | null;
  properties: Record<string, unknown>;
}

export interface DeprecatedObject {
  id: string;
  updatedFields: Record<string, unknown>;
}
