export const GET_LAYER_PAGE = `
  query GetLayerPage($layerName: String!, $offset: Int!, $pageSize: Int!) {
    layerPage(layerName: $layerName, offset: $offset, pageSize: $pageSize) {
      totalCount
      returnedCount
      nextRecord
      objects {
        id
        footprint: geometry
        properties
      }
      deprecated {
        id
        updatedFields
      }
    }
  }
`;
