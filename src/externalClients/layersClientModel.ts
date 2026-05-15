// Third-party API uses the layer name as the root query field.
// Pagination/auth inputs are passed via HTTP headers, not GraphQL variables.
export function buildLayerQuery(layerName: string): string {
  return `query {
  ${layerName} {
    createdBy
    creationTime
    deleted
    entityVersion
    geography {
      coordinates {
        latitude
        longitude
      }
      graphicsObjectKind {
        value
      }
      height
      obstacleHeightsRange {
        displayName
      }
    }
    id
    identifiers {
      essence {
        displayName
        value
      }
      name
      number
    }
    lastUpdateTime
    lastUpdatedBy
  }
}`;
}
