import axios from 'axios';
import type { LayerObject, ThirdPartyResponse } from '../../types';
import { getSyncConfig } from '../../common/syncConfig';
import { buildLayerQuery } from '../layersClientModel';
import { withSpan } from '../../common/telemetry';

interface GraphQLResponse {
  data?: Record<string, LayerObject[]>;
  extensions?: {
    sequence: string;
    deletedEntitiesCount: number;
    fetchedEntitiesCount: number;
    deletedEntitiesIds: string[];
  };
}

export async function fetchPage(layerName: string, sequence: string): Promise<ThirdPartyResponse> {
  const config = getSyncConfig();

  return withSpan(
    'layersClient.fetchPage',
    {
      'http.method': 'POST',
      'http.url': config.thirdPartyBaseUrl,
      'sync.layer': layerName,
      'sync.sequence': sequence,
      'sync.pageSize': config.pageSize,
    },
    async (span) => {
      const response = await axios.post<GraphQLResponse>(config.thirdPartyBaseUrl, { query: buildLayerQuery(layerName) }, {
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
      });

      span.setAttribute('http.status_code', response.status);

      const json = response.data;

      if (!json.data || !json.extensions) {
        throw new Error('Malformed response from third-party API');
      }

      const objects = json.data[layerName] ?? [];
      const { sequence: nextSequence, deletedEntitiesCount, fetchedEntitiesCount, deletedEntitiesIds } = json.extensions;

      span.setAttributes({
        'sync.fetchedCount': fetchedEntitiesCount,
        'sync.deletedCount': deletedEntitiesCount,
        'sync.nextSequence': nextSequence,
      });

      return {
        nextSequence,
        fetchedCount: fetchedEntitiesCount,
        deletedCount: deletedEntitiesCount,
        deletedIds: deletedEntitiesIds ?? [],
        objects,
      };
    }
  );
}
