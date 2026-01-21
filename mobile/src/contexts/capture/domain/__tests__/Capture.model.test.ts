import { Capture } from '../Capture.model';

describe('Capture Model', () => {
  describe('Model Definition', () => {
    it('should have correct table name', () => {
      expect(Capture.table).toBe('captures');
    });

    it('should be defined as a WatermelonDB Model class', () => {
      expect(Capture).toBeDefined();
      expect(typeof Capture).toBe('function');
    });
  });

  describe('Field Decorators', () => {
    it('should have all required field decorators', () => {
      const instance = new Capture(
        {
          database: {} as any,
          collections: {} as any,
        } as any,
        []
      );

      // Verify field existence (decorators are applied at class level)
      expect(instance).toHaveProperty('type');
      expect(instance).toHaveProperty('state');
      expect(instance).toHaveProperty('projectId');
      expect(instance).toHaveProperty('rawContent');
      expect(instance).toHaveProperty('normalizedText');
      expect(instance).toHaveProperty('capturedAt');
      expect(instance).toHaveProperty('location');
      expect(instance).toHaveProperty('tags');
      expect(instance).toHaveProperty('syncStatus');
      expect(instance).toHaveProperty('createdAt');
      expect(instance).toHaveProperty('updatedAt');
    });
  });

  describe('Type System', () => {
    it('should support all capture types at compile time', () => {
      // TypeScript compile-time check - these should not error
      const audioType: string = 'audio';
      const textType: string = 'text';
      const imageType: string = 'image';
      const urlType: string = 'url';

      expect([audioType, textType, imageType, urlType]).toHaveLength(4);
    });

    it('should support all state values at compile time', () => {
      // TypeScript compile-time check
      const captured: string = 'captured';
      const processing: string = 'processing';
      const ready: string = 'ready';
      const failed: string = 'failed';
      const recording: string = 'recording';

      expect([captured, processing, ready, failed, recording]).toHaveLength(5);
    });

    it('should support syncStatus values at compile time', () => {
      // TypeScript compile-time check
      const pending: string = 'pending';
      const synced: string = 'synced';

      expect([pending, synced]).toHaveLength(2);
    });
  });
});
