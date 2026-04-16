import type { ThirdPartyResponse } from '../../types';
import { getSyncConfig } from '../../common/syncConfig';
import { GET_LAYER_PAGE } from '../layersClientModel';

export async function fetchPage(layerName: string, offset: number): Promise<ThirdPartyResponse> {
  const { thirdPartyBaseUrl, pageSize } = getSyncConfig();

  const response = await fetch(thirdPartyBaseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: GET_LAYER_PAGE,
      variables: { layerName, offset, pageSize },
    }),
  });

  if (!response.ok) {
    throw new Error(`Third-party API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { data?: { layerPage: ThirdPartyResponse }; errors?: unknown[] };

  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  if (!json.data) {
    throw new Error('No data returned from third-party API');
  }

  return json.data.layerPage;
}
