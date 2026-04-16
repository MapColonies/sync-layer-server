import type { Repository } from 'typeorm';
import type { DeprecatedObject, LayerObject } from '../entities';
import { LayerObjectEntity } from '../entities';
import { getDataSource } from '../connection';

function getRepository(): Repository<LayerObjectEntity> {
  return getDataSource().getRepository(LayerObjectEntity);
}

export async function insertObjects(_layerName: string, objects: LayerObject[]): Promise<void> {
  if (objects.length === 0) return;

  await getRepository()
    .createQueryBuilder()
    .insert()
    .into(LayerObjectEntity)
    .values(objects as Partial<LayerObjectEntity>[])
    .orUpdate(['geometry', 'properties'], ['id'])
    .execute();
}

export async function updateDeprecatedObjects(_layerName: string, deprecated: DeprecatedObject[]): Promise<void> {
  if (deprecated.length === 0) return;

  const repo = getRepository();
  for (const obj of deprecated) {
    await repo
      .createQueryBuilder()
      .update(LayerObjectEntity)
      .set({ properties: () => `properties || '${JSON.stringify(obj.updatedFields)}'::jsonb` })
      .where('id = :id', { id: obj.id })
      .execute();
  }
}
