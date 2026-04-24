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
    .orIgnore()
    .execute();
}

export async function deleteDeprecatedObjects(layerName: string, deprecated: DeprecatedObject[]): Promise<void> {
  if (deprecated.length === 0) return;

  const ids = deprecated.map((o) => o.id);

  await getRepository()
    .createQueryBuilder()
    .delete()
    .from(LayerObjectEntity)
    .where('layer_name = :layerName AND id IN (:...ids)', { layerName, ids })
    .execute();
}
