/**
 * Mobile Sync Migrations for OP-SQLite
 * Story 6.1 - Task 2: Sync-Compatible Schema Migrations
 *
 * IMPORTANT: These migrations should be executed on mobile app via OP-SQLite
 * This is a reference SQL file - mobile app needs to implement migration runner
 *
 * Database: OP-SQLite (SQLite on mobile)
 * Version: Add sync columns to existing tables
 */

-- ========================================
-- Add sync columns to captures table
-- ========================================

-- Note: Captures table structure depends on mobile implementation
-- Assuming schema: id (TEXT), userId (TEXT), raw_content (TEXT), etc.

ALTER TABLE captures ADD COLUMN last_modified_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE captures ADD COLUMN _status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE captures ADD COLUMN _changed INTEGER NOT NULL DEFAULT 0;  -- Boolean (0/1)

CREATE INDEX IF NOT EXISTS idx_captures_last_modified ON captures(last_modified_at DESC);
CREATE INDEX IF NOT EXISTS idx_captures_changed ON captures(_changed);
CREATE INDEX IF NOT EXISTS idx_captures_status ON captures(_status);

-- ========================================
-- Add sync columns to thoughts table
-- ========================================

ALTER TABLE thoughts ADD COLUMN last_modified_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE thoughts ADD COLUMN _status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE thoughts ADD COLUMN _changed INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_thoughts_last_modified ON thoughts(last_modified_at DESC);
CREATE INDEX IF NOT EXISTS idx_thoughts_changed ON thoughts(_changed);
CREATE INDEX IF NOT EXISTS idx_thoughts_status ON thoughts(_status);

-- ========================================
-- Add sync columns to ideas table
-- ========================================

ALTER TABLE ideas ADD COLUMN last_modified_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ideas ADD COLUMN _status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE ideas ADD COLUMN _changed INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ideas_last_modified ON ideas(last_modified_at DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_changed ON ideas(_changed);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(_status);

-- ========================================
-- Add sync columns to todos table
-- ========================================

ALTER TABLE todos ADD COLUMN last_modified_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE todos ADD COLUMN _status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE todos ADD COLUMN _changed INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_todos_last_modified ON todos(last_modified_at DESC);
CREATE INDEX IF NOT EXISTS idx_todos_changed ON todos(_changed);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(_status);

-- ========================================
-- Sync metadata table (local tracking)
-- ========================================

-- Store lastPulledAt timestamps per entity
CREATE TABLE IF NOT EXISTS sync_metadata (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL UNIQUE,  -- 'captures', 'thoughts', 'ideas', 'todos'
  last_pulled_at INTEGER NOT NULL DEFAULT 0,  -- Milliseconds timestamp
  last_pushed_at INTEGER NOT NULL DEFAULT 0,  -- Milliseconds timestamp
  last_sync_status TEXT,  -- 'success', 'error', 'in_progress'
  last_sync_error TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0
);

-- Insert default rows
INSERT OR IGNORE INTO sync_metadata (id, entity) VALUES
  ('captures_sync', 'captures'),
  ('thoughts_sync', 'thoughts'),
  ('ideas_sync', 'ideas'),
  ('todos_sync', 'todos');

-- ========================================
-- Column Definitions
-- ========================================

-- last_modified_at:
--   - INTEGER (milliseconds since epoch)
--   - Updated automatically by mobile app when record changes
--   - Used by server for conflict detection
--
-- _status:
--   - TEXT ('active' | 'deleted')
--   - Soft delete flag for sync consistency
--   - Deleted records synced to server then removed locally
--
-- _changed:
--   - INTEGER (0 = false, 1 = true)
--   - Marks local changes not yet synced to server
--   - Reset to 0 after successful push
--   - Query: SELECT * FROM captures WHERE _changed = 1

-- ========================================
-- Migration Execution Order
-- ========================================
-- 1. Run this SQL file in mobile app via OP-SQLite exec
-- 2. Verify columns added: SELECT * FROM pragma_table_info('captures')
-- 3. Verify indexes created: SELECT * FROM sqlite_master WHERE type='index'
-- 4. Test sync flow with backend /api/sync/pull and /api/sync/push endpoints
