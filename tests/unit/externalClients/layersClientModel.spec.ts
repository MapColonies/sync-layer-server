import { describe, expect, it } from 'vitest';
import { buildLayerQuery } from '@src/externalClients/layersClientModel';

describe('layersClientModel', () => {
  describe('buildLayerQuery', () => {
    it('uses the layer name as the root selection field', () => {
      const query = buildLayerQuery('obstacles');
      expect(query).toContain('query');
      expect(query).toContain('obstacles {');
    });

    it('requests the fields required to persist a layer object', () => {
      const query = buildLayerQuery('obstacles');
      expect(query).toContain('id');
      expect(query).toContain('footprint: geometry');
      expect(query).toContain('properties');
    });

    it('does not declare variables (pagination goes via HTTP headers)', () => {
      const query = buildLayerQuery('obstacles');
      expect(query).not.toContain('$');
    });
  });
});
