/**
 * Tests for useSyncInitialization hook
 *
 * Story 6.2 - Bug Fix: Container import issue
 *
 * TDD RED Phase: This test will fail because container is not exported from container.ts
 * GREEN Phase: After fixing, verify that container is accessible and can resolve services
 */

import 'reflect-metadata';
import { container } from '../../../infrastructure/di/container';

describe('useSyncInitialization - DI Container Resolution', () => {
  it('should export container from container.ts (not undefined)', () => {
    // Before fix: container was undefined → "Cannot read property 'resolve' of undefined"
    // After fix: container is exported → defined
    expect(container).toBeDefined();
    expect(container.resolve).toBeDefined();
  });

  it('should be able to import container without throwing', () => {
    // This test verifies that importing container does not crash the app
    // The actual service registration is done in bootstrap.ts at app startup
    expect(() => {
      const { container: testContainer } = require('../../../infrastructure/di/container');
      expect(testContainer).toBeDefined();
    }).not.toThrow();
  });
});
