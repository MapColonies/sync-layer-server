import type { ObjectLiteral, Repository } from 'typeorm';
import type { DeprecatedObject, LayerObject } from '../entities';
import { LayerObjectEntity } from '../entities';
import { getDataSource } from '../connection';

function getRepository(): Repository<LayerObjectEntity> {
  return getDataSource().getRepository(LayerObjectEntity);
}

export async function insertObjects(layerName: string, objects: LayerObject[]): Promise<void> {
  if (objects.length === 0) return;

  const rows = objects.map((o) => ({
    layerName,
    id: o.id,
    geometry: o.geometry,
    properties: o.properties,
  }));

  await getRepository()
    .createQueryBuilder()
    .insert()
    .into(LayerObjectEntity)
    .values(rows as unknown as ObjectLiteral[])
    .orUpdate(['geometry', 'properties'], ['layer_name', 'id'])
    .execute();
}

export async function updateDeprecatedObjects(layerName: string, deprecated: DeprecatedObject[]): Promise<void> {
  if (deprecated.length === 0) return;

  const repo = getRepository();
  for (const obj of deprecated) {
    await repo
      .createQueryBuilder()
      .update(LayerObjectEntity)
      .set({ properties: () => `properties || :patch::jsonb` })
      .where('layer_name = :layerName AND id = :id', { layerName, id: obj.id })
      .setParameter('patch', JSON.stringify(obj.updatedFields))
      .execute();
  }
}
