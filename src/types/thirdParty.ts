import type { LayerObject, DeprecatedObject } from '../dal/entities/layerObject';

export type { LayerObject, DeprecatedObject };

export interface ThirdPartyResponse {
  totalCount: number;
  returnedCount: number;
  nextRecord: number;
  objects: LayerObject[];
  deprecated: DeprecatedObject[];
}
