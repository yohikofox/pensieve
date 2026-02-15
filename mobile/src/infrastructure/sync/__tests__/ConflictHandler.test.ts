/**
 * ConflictHandler Tests
 *
 * Story 6.2 - Task 8.3: Mobile conflict resolution handler
 *
 * Implements last-write-wins strategy (ADR-009.2)
 * - Server timestamp wins in conflicts
 * - Local DB updated with server version
 * - Conflicts logged for audit trail
 */

import { ConflictHandler } from '../ConflictHandler';
import { DatabaseConnection } from '../../../database';

// Mock database connection
const mockExecute = jest.fn();
jest.mock('../../../database', () => ({
  DatabaseConnection: {
    getInstance: jest.fn(() => ({
      getDatabase: jest.fn(() => ({
        execute: mockExecute,
      })),
    })),
  },
}));

describe('ConflictHandler', () => {
  let handler: ConflictHandler;

  beforeEach(() => {
    mockExecute.mockClear();
    handler = new ConflictHandler();
  });

  describe('applyConflicts()', () => {
    it('should apply server version for capture conflicts', async () => {
      const conflicts = [
        {
          entity: 'captures',
          record_id: 'capture-1',
          conflict_type: 'concurrent_update',
          resolution: 'server_wins' as const,
          serverVersion: {
            id: 'capture-1',
            raw_content: 'Server version content',
            normalized_text: 'Server normalized',
            updated_at: Date.now(),
          },
        },
      ];

      mockExecute.mockReturnValue({ rowsAffected: 1 });

      await handler.applyConflicts(conflicts);

      // Verify database updated with server version
      const call = mockExecute.mock.calls[0];
      expect(call[0]).toContain('UPDATE captures');
      expect(call[0]).toContain('WHERE id = ?');
      expect(call[1]).toContain('capture-1');
    });

    it('should apply server version for todo conflicts', async () => {
      const conflicts = [
        {
          entity: 'todos',
          record_id: 'todo-1',
          conflict_type: 'concurrent_update',
          resolution: 'server_wins' as const,
          serverVersion: {
            id: 'todo-1',
            description: 'Server todo description',
            status: 'completed',
            updated_at: Date.now(),
          },
        },
      ];

      mockExecute.mockReturnValue({ rowsAffected: 1 });

      await handler.applyConflicts(conflicts);

      const call = mockExecute.mock.calls[0];
      expect(call[0]).toContain('UPDATE todos');
      expect(call[0]).toContain('WHERE id = ?');
      expect(call[1]).toContain('todo-1');
    });

    it('should handle multiple conflicts in batch', async () => {
      const conflicts = [
        {
          entity: 'captures',
          record_id: 'capture-1',
          conflict_type: 'concurrent_update',
          resolution: 'server_wins' as const,
          serverVersion: { id: 'capture-1', raw_content: 'Server 1' },
        },
        {
          entity: 'todos',
          record_id: 'todo-1',
          conflict_type: 'concurrent_update',
          resolution: 'server_wins' as const,
          serverVersion: { id: 'todo-1', description: 'Server todo' },
        },
        {
          entity: 'thoughts',
          record_id: 'thought-1',
          conflict_type: 'concurrent_update',
          resolution: 'server_wins' as const,
          serverVersion: { id: 'thought-1', summary: 'Server thought' },
        },
      ];

      mockExecute.mockReturnValue({ rowsAffected: 1 });

      await handler.applyConflicts(conflicts);

      // Verify all 3 updates executed
      expect(mockExecute).toHaveBeenCalledTimes(3);
    });

    it('should skip conflicts with client_wins resolution', async () => {
      const conflicts = [
        {
          entity: 'captures',
          record_id: 'capture-1',
          conflict_type: 'concurrent_update',
          resolution: 'client_wins' as const,
          serverVersion: { id: 'capture-1', raw_content: 'Server version' },
        },
      ];

      await handler.applyConflicts(conflicts);

      // No database update for client_wins
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should handle empty conflicts array', async () => {
      await handler.applyConflicts([]);

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should continue if one conflict update fails', async () => {
      const conflicts = [
        {
          entity: 'captures',
          record_id: 'capture-1',
          conflict_type: 'concurrent_update',
          resolution: 'server_wins' as const,
          serverVersion: { id: 'capture-1', raw_content: 'Server 1' },
        },
        {
          entity: 'todos',
          record_id: 'todo-1',
          conflict_type: 'concurrent_update',
          resolution: 'server_wins' as const,
          serverVersion: { id: 'todo-1', description: 'Server todo' },
        },
      ];

      // First update fails, second succeeds
      mockExecute
        .mockImplementationOnce(() => {
          throw new Error('Database error');
        })
        .mockReturnValueOnce({ rowsAffected: 1 });

      await handler.applyConflicts(conflicts);

      // Both updates attempted
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('should validate entity type before updating', async () => {
      const conflicts = [
        {
          entity: 'invalid_entity',
          record_id: 'test-1',
          conflict_type: 'concurrent_update',
          resolution: 'server_wins' as const,
          serverVersion: { id: 'test-1', data: 'test' },
        },
      ];

      await handler.applyConflicts(conflicts);

      // Invalid entity should be skipped
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should log conflicts for audit trail', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const conflicts = [
        {
          entity: 'captures',
          record_id: 'capture-1',
          conflict_type: 'concurrent_update',
          resolution: 'server_wins' as const,
          serverVersion: { id: 'capture-1', raw_content: 'Server version' },
        },
      ];

      mockExecute.mockReturnValue({ rowsAffected: 1 });

      await handler.applyConflicts(conflicts);

      // Verify conflict logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ConflictHandler]'),
      );

      consoleSpy.mockRestore();
    });
  });
});
