import type { ObjectLiteral, Repository } from 'typeorm';
import type { LayerObject } from '../entities';
import { LayerObjectEntity } from '../entities';
import { getDataSource } from '../connection';
import { withSpan } from '../../common/telemetry';

function getRepository(): Repository<LayerObjectEntity> {
  return getDataSource().getRepository(LayerObjectEntity);
}

export async function insertObjects(layerName: string, objects: LayerObject[]): Promise<void> {
  if (objects.length === 0) return;

  const rows = objects.map((o) => ({
    layerName,
    id: o.id,
    footprint: o.footprint,
    properties: o.properties,
  }));

  await withSpan(
    'layerDataRepository.insertObjects',
    { 'db.system': 'postgresql', 'db.operation': 'INSERT', 'sync.layer': layerName, 'sync.rowCount': rows.length },
    async () => {
      await getRepository()
        .createQueryBuilder()
        .insert()
        .into(LayerObjectEntity)
        .values(rows as unknown as ObjectLiteral[])
        .orIgnore()
        .execute();
    }
  );
}

export async function deleteDeprecatedObjects(layerName: string, deletedIds: string[]): Promise<void> {
  if (deletedIds.length === 0) return;

  await withSpan(
    'layerDataRepository.deleteDeprecatedObjects',
    { 'db.system': 'postgresql', 'db.operation': 'DELETE', 'sync.layer': layerName, 'sync.rowCount': deletedIds.length },
    async () => {
      await getRepository()
        .createQueryBuilder()
        .delete()
        .from(LayerObjectEntity)
        .where('layer_name = :layerName AND id IN (:...ids)', { layerName, ids: deletedIds })
        .execute();
    }
  );
}
