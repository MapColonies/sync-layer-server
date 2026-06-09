import { trace } from '@opentelemetry/api';
import { asyncCallWithSpan } from '@map-colonies/tracing-utils';
import type { ObjectLiteral, Repository } from 'typeorm';
import type { Logger } from '@map-colonies/js-logger';
import type { LayerObject } from '../entities';
import { LayerObjectEntity } from '../entities';
import { getDataSource } from '../connection';
import { SERVICE_NAME } from '../../common/constants';

const tracer = trace.getTracer(SERVICE_NAME);

function getRepository(): Repository<LayerObjectEntity> {
  return getDataSource().getRepository(LayerObjectEntity);
}

async function insertRow(layerName: string, object: LayerObject): Promise<void> {
  await getRepository()
    .createQueryBuilder()
    .insert()
    .into(LayerObjectEntity)
    .values({ layerName, id: object.id, geom: object.geom, properties: object.properties } as unknown as ObjectLiteral)
    .orUpdate(['geom', 'properties'], ['layer_name', 'id'])
    .execute();
}

export async function insertObjects(logger: Logger, layerName: string, objects: LayerObject[]): Promise<void> {
  if (objects.length === 0) return;

  const rows = objects.map((o) => ({
    layerName,
    id: o.id,
    geom: o.geom,
    properties: o.properties,
  }));

  await asyncCallWithSpan(
    async () => {
      try {
        await getRepository()
          .createQueryBuilder()
          .insert()
          .into(LayerObjectEntity)
          .values(rows as unknown as ObjectLiteral[])
          .orUpdate(['geom', 'properties'], ['layer_name', 'id'])
          .execute();
      } catch (batchErr) {
        logger.warn({ msg: 'Batch insert failed, falling back to per-object inserts', layerName, count: objects.length, err: batchErr });
        for (const object of objects) {
          try {
            await insertRow(layerName, object);
          } catch (err) {
            logger.error({
              msg: 'Insert failed for object, skipping',
              layerName,
              id: object.id,
              geom: object.geom,
              properties: object.properties,
              err,
            });
          }
        }
      }
    },
    tracer,
    'layerDataRepository.insertObjects'
  );
}

export async function deleteDeprecatedObjects(logger: Logger, layerName: string, deletedIds: string[]): Promise<void> {
  if (deletedIds.length === 0) return;

  await asyncCallWithSpan(
    async () => {
      try {
        await getRepository()
          .createQueryBuilder()
          .delete()
          .from(LayerObjectEntity)
          .where('layer_name = :layerName AND id IN (:...ids)', { layerName, ids: deletedIds })
          .execute();
      } catch (batchErr) {
        logger.warn({ msg: 'Batch delete failed, falling back to per-object deletes', layerName, count: deletedIds.length, err: batchErr });
        for (const id of deletedIds) {
          try {
            await getRepository()
              .createQueryBuilder()
              .delete()
              .from(LayerObjectEntity)
              .where('layer_name = :layerName AND id = :id', { layerName, id })
              .execute();
          } catch (err) {
            logger.error({
              msg: 'Delete failed for object, skipping',
              layerName,
              id,
              err,
            });
          }
        }
      }
    },
    tracer,
    'layerDataRepository.deleteDeprecatedObjects'
  );
}
