import { Entity, PrimaryColumn, Column, Index, Check } from 'typeorm';
import type { GeoJSON } from 'geojson';

export function getLayerPartitionName(layerName: string): string {
  return `layer_${layerName}`;
}

@Entity('layer_objects')
@Check('layer_objects_valid_geometry', `ST_IsValid("footprint")`)
@Check('layer_objects_extent', `Box2D("footprint") @ Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)', 4326))`)
export class LayerObjectEntity {
  @PrimaryColumn({ name: 'layer_name', type: 'text' })
  public layerName!: string;

  @PrimaryColumn({ type: 'text' })
  public id!: string;

  @Index('idx_layer_objects_footprint', { spatial: true })
  @Column({ type: 'geometry', srid: 4326 })
  public footprint!: GeoJSON;

  @Column({ type: 'jsonb', default: {} })
  public properties!: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  public createdAt!: Date;
}

export interface LayerObject {
  id: string;
  footprint: GeoJSON;
  properties: Record<string, unknown>;
}
