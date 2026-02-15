/**
 * Tests for Sync-related Database Migrations
 *
 * Bug Fix Test: Story 6.2 - Missing _changed column
 * Verifies that captures table has _changed column for sync tracking
 *
 * @bug "_changed column not found" error when creating captures
 * @story 6.2 - Cloud-Local Audio Sync
 */

import { open, type DB } from '@op-engineering/op-sqlite';
import { runMigrations } from '../migrations';

describe('Sync Migrations - Bug Fix: _changed column', () => {
  let db: DB;
  const testDbName = 'test-sync-migrations.db';

  beforeAll(() => {
    // Create fresh test database
    db = open({ name: testDbName, location: ':memory:' });
  });

  afterAll(() => {
    // Cleanup (db.close() not supported in mock, memory DB will be cleaned by Jest)
  });

  describe('Bug: captures table missing _changed column', () => {
    it('should have _changed column in captures table after migrations', () => {
      // Run all migrations
      const migrationsApplied = runMigrations(db);
      expect(migrationsApplied).toBeGreaterThan(0);

      // Verify schema has _changed column
      const result = db.executeSync('PRAGMA table_info(captures)');
      const columns = result.rows || [];

      // Find _changed column
      const changedColumn = columns.find((col: any) => col.name === '_changed');

      // BUG: This will FAIL before migration v21 is created
      expect(changedColumn).toBeDefined();
      expect(changedColumn?.name).toBe('_changed');
      expect(changedColumn?.type).toBe('INTEGER'); // Boolean stored as INTEGER in SQLite
      expect(changedColumn?.dflt_value).toBe('0'); // Default value should be 0
    });

    it('should allow INSERT with _changed = 1', () => {
      // Run all migrations
      runMigrations(db);

      // Try to INSERT a capture with _changed = 1 (this will fail without migration v21)
      expect(() => {
        db.executeSync(
          `INSERT INTO captures (
            id, type, state, raw_content, duration, file_size,
            created_at, updated_at, sync_version, _changed
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            'test-capture-001',
            'audio',
            'captured',
            '/path/to/audio.m4a',
            5000,
            1024000,
            Date.now(),
            Date.now(),
            0,
          ],
        );
      }).not.toThrow();

      // Verify the record was inserted with _changed = 1
      const result = db.executeSync(
        'SELECT _changed FROM captures WHERE id = ?',
        ['test-capture-001'],
      );

      const rows = result.rows || [];
      expect(rows[0]?._changed).toBe(1);
    });

    it('should allow UPDATE with _changed = 1', () => {
      // Run all migrations
      runMigrations(db);

      // Insert a test capture
      db.executeSync(
        `INSERT INTO captures (
          id, type, state, raw_content, created_at, updated_at, sync_version, _changed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          'test-capture-002',
          'audio',
          'captured',
          '/path/to/audio.m4a',
          Date.now(),
          Date.now(),
          0,
        ],
      );

      // Try to UPDATE with _changed = 1 (this will fail without migration v21)
      expect(() => {
        db.executeSync(
          `UPDATE captures SET state = ?, _changed = 1 WHERE id = ?`,
          ['processing', 'test-capture-002'],
        );
      }).not.toThrow();

      // Verify _changed was updated
      const result = db.executeSync(
        'SELECT _changed, state FROM captures WHERE id = ?',
        ['test-capture-002'],
      );

      const rows = result.rows || [];
      expect(rows[0]?._changed).toBe(1);
      expect(rows[0]?.state).toBe('processing');
    });
  });
});
