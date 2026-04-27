import axios from 'axios';
import { trace } from '@opentelemetry/api';
import { asyncCallWithSpan } from '@map-colonies/tracing-utils';
import type { LayerObject, ThirdPartyResponse } from '../../types';
import { getSyncConfig } from '../../common/syncConfig';
import { SERVICE_NAME } from '../../common/constants';
import { buildLayerQuery } from '../layersClientModel';

interface GraphQLResponse {
  data?: Record<string, LayerObject[]>;
  extensions?: {
    sequence: string;
    deletedEntitiesCount: number;
    fetchedEntitiesCount: number;
    deletedEntitiesIds: string[];
  };
}

const tracer = trace.getTracer(SERVICE_NAME);

export async function fetchPage(layerName: string, sequence: string): Promise<ThirdPartyResponse> {
  const config = getSyncConfig();

  return asyncCallWithSpan(
    async () => {
      const response = await axios.post<GraphQLResponse>(
        config.thirdPartyBaseUrl,
        { query: buildLayerQuery(layerName) },
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

      const objects = json.data[layerName] ?? [];
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
