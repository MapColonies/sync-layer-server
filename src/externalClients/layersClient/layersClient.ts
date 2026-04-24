import type { LayerObject, ThirdPartyResponse } from '../../types';
import { getSyncConfig } from '../../common/syncConfig';
import { buildLayerQuery } from '../layersClientModel';

interface GraphQLResponse {
  data?: Record<string, LayerObject[]>;
  extensions?: {
    sequence: string;
    deletedEntitiesCount: number;
    fetchedEntitiesCount: number;
    deletedEntitiesIds: string[];
  };
  errors?: unknown[];
}

export async function fetchPage(layerName: string, sequence: string): Promise<ThirdPartyResponse> {
  const config = getSyncConfig();

  const response = await fetch(config.thirdPartyBaseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'reality-id': String(config.realityId),
      'requesting-sys': config.requestingSystem,
      'requesting-sys-name': config.requestingSystemName,
      sequence,
      'page-size': String(config.pageSize),
      Authorization: config.auth.token,
      'use-Delete-Entities': String(config.useDeleteEntities),
    },
    body: JSON.stringify({ query: buildLayerQuery(layerName) }),
  });

  if (!response.ok) {
    throw new Error(`Third-party API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as GraphQLResponse;

  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

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
}
