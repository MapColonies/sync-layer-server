import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('layer_obstacles')
export class LayerObjectEntity {
  @PrimaryColumn({ type: 'text' })
  public id!: string;

  @Column({ type: 'jsonb', nullable: true })
  public geometry!: object | null;

  @Column({ type: 'jsonb', default: {} })
  public properties!: object;
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
