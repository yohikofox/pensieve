/**
 * Migration v19 Tests - upload_queue table
 *
 * Tests for Task 6.1: Create upload_queue table for audio upload tracking
 */

import { open, type DB, __resetDatabase } from '@op-engineering/op-sqlite';
import { runMigrations } from '../migrations';

describe('Migration v19: upload_queue table', () => {
  let db: DB;

  beforeEach(() => {
    // Reset shared mock database
    __resetDatabase();

    // Create fresh in-memory database for each test
    db = open({ name: ':memory:' });
    db.executeSync('PRAGMA foreign_keys = ON');
  });

  afterEach(() => {
    // Reset mock database after each test
    __resetDatabase();
  });

  describe('Table Creation', () => {
    it('should create upload_queue table with correct schema', () => {
      // Run migrations
      runMigrations(db);

      // Verify table exists
      const tableInfo = db.executeSync('PRAGMA table_info(upload_queue)');
      const columns = tableInfo.rows || [];

      expect(columns.length).toBeGreaterThan(0);

      // Verify columns
      const columnNames = columns.map((col: any) => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('capture_id');
      expect(columnNames).toContain('file_path');
      expect(columnNames).toContain('file_size');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('progress');
      expect(columnNames).toContain('retry_count');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    it('should have status CHECK constraint', () => {
      runMigrations(db);

      // Create test capture first (FK requirement)
      db.executeSync(`
        INSERT INTO captures (id, type, state, created_at, updated_at)
        VALUES ('test-capture-1', 'audio', 'captured', ${Date.now()}, ${Date.now()})
      `);

      // Valid status values should work
      const validStatuses = ['pending', 'uploading', 'completed', 'failed'];

      validStatuses.forEach((status) => {
        const result = db.executeSync(
          `INSERT INTO upload_queue (id, capture_id, file_path, file_size, status, created_at, updated_at)
           VALUES (?, 'test-capture-1', '/path/test.m4a', 1024, ?, ${Date.now()}, ${Date.now()})`,
          [`test-${status}`, status],
        );

        expect(result.rowsAffected).toBe(1);
      });

      // Invalid status should fail
      expect(() => {
        db.executeSync(
          `INSERT INTO upload_queue (id, capture_id, file_path, file_size, status, created_at, updated_at)
           VALUES ('test-invalid', 'test-capture-1', '/path/test.m4a', 1024, 'invalid', ${Date.now()}, ${Date.now()})`,
        );
      }).toThrow();
    });

    it('should have FK constraint to captures table', () => {
      runMigrations(db);

      // Verify FK constraint exists
      const fkCheck = db.executeSync('PRAGMA foreign_key_list(upload_queue)');
      const fkRows = fkCheck.rows || [];

      expect(fkRows.length).toBeGreaterThan(0);
      expect(fkRows[0].table).toBe('captures');
      expect(fkRows[0].on_delete).toBe('CASCADE');
    });

    it('should enforce FK constraint (cascade delete)', () => {
      runMigrations(db);

      // Create capture
      db.executeSync(`
        INSERT INTO captures (id, type, state, created_at, updated_at)
        VALUES ('test-capture-2', 'audio', 'captured', ${Date.now()}, ${Date.now()})
      `);

      // Create upload queue entry
      db.executeSync(`
        INSERT INTO upload_queue (id, capture_id, file_path, file_size, status, created_at, updated_at)
        VALUES ('test-upload-1', 'test-capture-2', '/path/test.m4a', 1024, 'pending', ${Date.now()}, ${Date.now()})
      `);

      // Verify upload exists
      const beforeDelete = db.executeSync('SELECT * FROM upload_queue WHERE id = ?', ['test-upload-1']);
      expect(beforeDelete.rows?.length).toBe(1);

      // Delete capture (should cascade to upload_queue)
      db.executeSync('DELETE FROM captures WHERE id = ?', ['test-capture-2']);

      // Verify upload was deleted
      const afterDelete = db.executeSync('SELECT * FROM upload_queue WHERE id = ?', ['test-upload-1']);
      expect(afterDelete.rows?.length).toBe(0);
    });

    it('should have default values for progress and retry_count', () => {
      runMigrations(db);

      // Create capture
      db.executeSync(`
        INSERT INTO captures (id, type, state, created_at, updated_at)
        VALUES ('test-capture-3', 'audio', 'captured', ${Date.now()}, ${Date.now()})
      `);

      // Insert without specifying progress and retry_count
      db.executeSync(`
        INSERT INTO upload_queue (id, capture_id, file_path, file_size, status, created_at, updated_at)
        VALUES ('test-upload-2', 'test-capture-3', '/path/test.m4a', 1024, 'pending', ${Date.now()}, ${Date.now()})
      `);

      // Verify defaults
      const result = db.executeSync('SELECT progress, retry_count FROM upload_queue WHERE id = ?', ['test-upload-2']);

      expect(result.rows?.[0].progress).toBe(0.0);
      expect(result.rows?.[0].retry_count).toBe(0);
    });
  });

  describe('Indexes', () => {
    it('should create index on status column', () => {
      runMigrations(db);

      const indexCheck = db.executeSync("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='upload_queue'");
      const indexNames = (indexCheck.rows || []).map((row: any) => row.name);

      expect(indexNames).toContain('idx_upload_queue_status');
    });

    it('should create index on capture_id column', () => {
      runMigrations(db);

      const indexCheck = db.executeSync("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='upload_queue'");
      const indexNames = (indexCheck.rows || []).map((row: any) => row.name);

      expect(indexNames).toContain('idx_upload_queue_capture');
    });
  });

  describe('Data Operations', () => {
    it('should insert and query upload queue entries', () => {
      runMigrations(db);

      // Create capture
      db.executeSync(`
        INSERT INTO captures (id, type, state, created_at, updated_at)
        VALUES ('test-capture-4', 'audio', 'captured', ${Date.now()}, ${Date.now()})
      `);

      // Insert upload entry
      const now = Date.now();
      db.executeSync(
        `INSERT INTO upload_queue
         (id, capture_id, file_path, file_size, status, progress, retry_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['upload-1', 'test-capture-4', '/audio/test.m4a', 50000, 'uploading', 0.5, 2, now, now],
      );

      // Query
      const result = db.executeSync('SELECT * FROM upload_queue WHERE id = ?', ['upload-1']);
      const row = result.rows?.[0];

      expect(row).toBeDefined();
      expect(row.id).toBe('upload-1');
      expect(row.capture_id).toBe('test-capture-4');
      expect(row.file_path).toBe('/audio/test.m4a');
      expect(row.file_size).toBe(50000);
      expect(row.status).toBe('uploading');
      expect(row.progress).toBe(0.5);
      expect(row.retry_count).toBe(2);
    });

    it('should update upload progress and status', () => {
      runMigrations(db);

      // Create capture
      const now = Date.now();
      db.executeSync(`
        INSERT INTO captures (id, type, state, created_at, updated_at)
        VALUES ('test-capture-5', 'audio', 'captured', ${now}, ${now})
      `);

      // Insert upload entry
      db.executeSync(
        `INSERT INTO upload_queue
         (id, capture_id, file_path, file_size, status, progress, retry_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['upload-2', 'test-capture-5', '/audio/test.m4a', 100000, 'uploading', 0.3, 0, now, now],
      );

      // Update progress
      db.executeSync(
        'UPDATE upload_queue SET progress = ?, updated_at = ? WHERE id = ?',
        [0.75, Date.now(), 'upload-2'],
      );

      // Verify update
      const result = db.executeSync('SELECT progress FROM upload_queue WHERE id = ?', ['upload-2']);
      expect(result.rows?.[0].progress).toBe(0.75);
    });

    it('should query pending uploads by status', () => {
      runMigrations(db);

      const now = Date.now();

      // Create captures
      db.executeSync(`
        INSERT INTO captures (id, type, state, created_at, updated_at)
        VALUES
          ('capture-6', 'audio', 'captured', ${now}, ${now}),
          ('capture-7', 'audio', 'captured', ${now}, ${now}),
          ('capture-8', 'audio', 'captured', ${now}, ${now})
      `);

      // Insert uploads with different statuses
      db.executeSync(
        `INSERT INTO upload_queue
         (id, capture_id, file_path, file_size, status, created_at, updated_at)
         VALUES
          ('upload-3', 'capture-6', '/audio/1.m4a', 1000, 'pending', ${now}, ${now}),
          ('upload-4', 'capture-7', '/audio/2.m4a', 2000, 'uploading', ${now}, ${now}),
          ('upload-5', 'capture-8', '/audio/3.m4a', 3000, 'pending', ${now}, ${now})`,
      );

      // Query pending uploads
      const result = db.executeSync("SELECT id FROM upload_queue WHERE status = 'pending' ORDER BY created_at");
      const ids = (result.rows || []).map((row: any) => row.id);

      expect(ids).toEqual(['upload-3', 'upload-5']);
    });
  });

  describe('Migration Version', () => {
    it('should set database version to 19', () => {
      runMigrations(db);

      const versionCheck = db.executeSync('PRAGMA user_version');
      const version = versionCheck.rows?.[0].user_version;

      expect(version).toBe(25); // v25 added _changed column to thoughts and todos
    });
  });
});
