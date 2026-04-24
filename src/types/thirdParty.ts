import type { LayerObject } from '../dal/entities/layerObject';

export type { LayerObject };

export interface ThirdPartyResponse {
  nextSequence: string;
  fetchedCount: number;
  deletedCount: number;
  deletedIds: string[];
  objects: LayerObject[];
}
