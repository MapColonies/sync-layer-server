import { trace } from '@opentelemetry/api';
import { asyncCallWithSpan } from '@map-colonies/tracing-utils';
import type { ObjectLiteral, Repository } from 'typeorm';
import type { LayerObject } from '../entities';
import { LayerObjectEntity } from '../entities';
import { getDataSource } from '../connection';
import { SERVICE_NAME } from '../../common/constants';

const tracer = trace.getTracer(SERVICE_NAME);

function getRepository(): Repository<LayerObjectEntity> {
  return getDataSource().getRepository(LayerObjectEntity);
}

export async function insertObjects(layerName: string, objects: LayerObject[]): Promise<void> {
  if (objects.length === 0) return;

  const rows = objects.map((o) => ({
    layerName,
    id: o.id,
    geom: o.geom,
    properties: o.properties,
  }));

  await asyncCallWithSpan(
    async () => {
      await getRepository()
        .createQueryBuilder()
        .insert()
        .into(LayerObjectEntity)
        .values(rows as unknown as ObjectLiteral[])
        .orIgnore()
        .execute();
    },
    tracer,
    'layerDataRepository.insertObjects'
  );
}

export async function deleteDeprecatedObjects(layerName: string, deletedIds: string[]): Promise<void> {
  if (deletedIds.length === 0) return;

  await asyncCallWithSpan(
    async () => {
      await getRepository()
        .createQueryBuilder()
        .delete()
        .from(LayerObjectEntity)
        .where('layer_name = :layerName AND id IN (:...ids)', { layerName, ids: deletedIds })
        .execute();
    },
    tracer,
    'layerDataRepository.deleteDeprecatedObjects'
  );
}
