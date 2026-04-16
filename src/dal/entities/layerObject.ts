export interface LayerObject {
  id: string;
  geometry: unknown;
  properties: Record<string, unknown>;
}

export interface DeprecatedObject {
  id: string;
  updatedFields: Record<string, unknown>;
}
