import { describe, expect, it } from 'vitest';
import { GET_LAYER_PAGE } from '@src/externalClients/layersClientModel';

describe('layersClientModel', () => {
  describe('GET_LAYER_PAGE', () => {
    it('exposes the GetLayerPage GraphQL query', () => {
      expect(GET_LAYER_PAGE).toContain('query GetLayerPage');
    });

    it('declares the required query variables', () => {
      expect(GET_LAYER_PAGE).toContain('$layerName: String!');
      expect(GET_LAYER_PAGE).toContain('$offset: Int!');
      expect(GET_LAYER_PAGE).toContain('$pageSize: Int!');
    });
  });
});
