import axios from 'axios';
import { trace } from '@opentelemetry/api';
import { asyncCallWithSpan } from '@map-colonies/tracing-utils';
import type { Logger } from '@map-colonies/js-logger';
import type { LayerObject, ThirdPartyResponse } from '../../types';
import { getSyncConfig } from '../../common/syncConfig';
import { SERVICE_NAME } from '../../common/constants';
import { buildLayerQuery } from '../layersClientModel';
import { geographyToGeoJSON, type RawGeography } from './geometryParser';

interface RawLayerObject {
  createdBy: string | null;
  creationTime: string | null;
  deleted: boolean;
  entityVersion: number | null;
  geography: RawGeography & {
    height: number | null;
    obstacleHeightsRange: { displayName: string } | null;
  };
  id: string;
  identifiers: {
    essence: { displayName: string | null; value: string | null } | null;
    name: string | null;
    number: string | null;
  } | null;
  lastUpdateTime: string | null;
  lastUpdatedBy: string | null;
}

interface GraphQLResponse {
  data?: Record<string, RawLayerObject[]>;
  extensions?: {
    sequence: string;
    deletedEntitiesCount: number;
    fetchedEntitiesCount: number;
    deletedEntitiesIds: string[];
  };
}

const tracer = trace.getTracer(SERVICE_NAME);

function toLayerObject(raw: RawLayerObject): LayerObject {
  return {
    id: raw.id,
    geom: geographyToGeoJSON(raw.geography),
    properties: {
      createdBy: raw.createdBy,
      creationTime: raw.creationTime,
      entityVersion: raw.entityVersion,
      graphicsObjectKind: raw.geography.graphicsObjectKind,
      height: raw.geography.height,
      obstacleHeightsRange: raw.geography.obstacleHeightsRange,
      identifiers: raw.identifiers,
      lastUpdateTime: raw.lastUpdateTime,
      lastUpdatedBy: raw.lastUpdatedBy,
    },
  };
}

export async function fetchPage(logger: Logger, layerName: string, sequence: string): Promise<ThirdPartyResponse> {
  const config = getSyncConfig();

  return asyncCallWithSpan(
    async () => {
      const response = await axios.post<GraphQLResponse>(
        config.thirdPartyBaseUrl,
        { query: buildLayerQuery(layerName, config.layers) },
        {
          headers: {
            'Content-Type': 'application/json',
            'reality-id': String(config.realityId),
            'requesting-sys': config.requestingSystem,
            'requesting-sys-name': config.requestingSystemName,
            sequence,
            'page-size': String(config.pageSize),
            Authorization: config.authToken,
            'use-Delete-Entities': String(config.useDeleteEntities),
          },
        }
      );

      const json = response.data;
      if (!json.data || !json.extensions) {
        throw new Error('Malformed response from third-party API');
      }

      const rawObjects = json.data[layerName] ?? [];
      const objects: LayerObject[] = [];
      for (const raw of rawObjects.filter((o) => !o.deleted)) {
        try {
          objects.push(toLayerObject(raw));
        } catch (err) {
          logger.error({ msg: 'Failed to parse object, skipping', layerName, id: raw.id, geography: raw.geography, err });
        }
      }
      const { sequence: nextSequence, deletedEntitiesCount, fetchedEntitiesCount, deletedEntitiesIds } = json.extensions;

      return {
        nextSequence,
        fetchedCount: fetchedEntitiesCount,
        deletedCount: deletedEntitiesCount,
        deletedIds: deletedEntitiesIds ?? [],
        objects,
      };
    },
    tracer,
    'layersClient.fetchPage'
  );
}
