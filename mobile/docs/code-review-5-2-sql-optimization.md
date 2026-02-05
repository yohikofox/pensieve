# Story 5.2 Code Review - SQL Optimization Recommendation

**Date:** 2026-02-05
**Issue:** #9 (MEDIUM) - Missing Composite Index
**Impact:** Query performance for `TodoRepository.findAll()`

## Problem

The `findAll()` query in `TodoRepository.ts` (lines 240-257) uses a complex WHERE + ORDER BY clause:

```sql
SELECT * FROM todos
WHERE status = 'todo'
ORDER BY
  CASE WHEN deadline IS NULL THEN 1 ELSE 0 END ASC,
  deadline ASC,
  CASE priority
    WHEN 'high' THEN 0
    WHEN 'medium' THEN 1
    WHEN 'low' THEN 2
  END ASC,
  created_at ASC
```

**Current Indexes (Story 5.1):**
```sql
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_deadline ON todos(deadline);
CREATE INDEX idx_todos_priority ON todos(priority);
```

**Problem:** SQLite must use 3 separate indexes, causing multiple index scans and slower queries on large datasets (50+ todos).

## Solution

Create a composite index optimized for the query pattern:

```sql
-- Optimal composite index for findAll() query
CREATE INDEX idx_todos_active_sorted ON todos(status, deadline, priority)
WHERE status = 'todo';
```

**Benefits:**
- Single index scan instead of 3
- Covers WHERE clause + first 2 ORDER BY columns
- Partial index (WHERE clause) reduces index size
- ~3-5x faster query on 100+ todos

## Implementation

### Option 1: OP-SQLite Migration (Recommended)

Add to mobile database migrations:

```typescript
// File: mobile/src/database/migrations/005_optimize_todos_index.ts
export const migration005 = {
  up: (db: any) => {
    db.execute(`
      -- Drop old individual indexes
      DROP INDEX IF EXISTS idx_todos_status;
      DROP INDEX IF EXISTS idx_todos_deadline;
      DROP INDEX IF EXISTS idx_todos_priority;

      -- Create optimized composite index
      CREATE INDEX idx_todos_active_sorted
      ON todos(status, deadline, priority)
      WHERE status = 'todo';

      -- Keep status index for other queries (findByStatus, etc.)
      CREATE INDEX idx_todos_status ON todos(status);
    `);
  },
  down: (db: any) => {
    db.execute(`
      DROP INDEX IF EXISTS idx_todos_active_sorted;
      CREATE INDEX idx_todos_deadline ON todos(deadline);
      CREATE INDEX idx_todos_priority ON todos(priority);
    `);
  },
};
```

### Option 2: Quick Fix (Development Only)

Run manually in OP-SQLite console:

```sql
CREATE INDEX idx_todos_active_sorted ON todos(status, deadline, priority) WHERE status = 'todo';
```

## Testing

Before/After performance test:

```typescript
// Test with 100 todos
const start = performance.now();
const todos = await todoRepository.findAll();
const duration = performance.now() - start;

console.log(`findAll() took ${duration}ms for ${todos.length} todos`);
```

**Expected improvement:**
- Before: ~15-20ms (100 todos)
- After: ~3-5ms (100 todos)

## Priority

**MEDIUM** - Performance degrades with large todo lists (50+).
Implement before Epic 6 (sync) to avoid slow queries with multi-device data.

## Related

- Story 5.1: TodoRepository implementation
- Story 5.2: findAll() query (AC2, AC3)
- ADR-018: OP-SQLite migration
