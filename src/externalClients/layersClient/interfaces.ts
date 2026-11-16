export interface RawCoordinate {
  latitude: number;
  longitude: number;
}

export interface RawGeography {
  coordinates: RawCoordinate[];
  graphicsObjectKind: { value: string };
}

export interface RawLayerObject {
  createdBy: string | null;
  creationTime: string | null;
  deleted: boolean;
  entityVersion: number | null;
  geography: RawGeography & {
    height: number | null;
    obstacleHeightsRange: { displayName: string | null; value: string | null } | null;
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

export interface GraphQLResponse {
  data?: Record<string, RawLayerObject[]>;
  extensions?: {
    sequence: string;
    deletedEntitiesCount: number;
    fetchedEntitiesCount: number;
    deletedEntitiesIDs?: string[];
  };
}
