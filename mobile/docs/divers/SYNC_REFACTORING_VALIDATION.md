# Sync Architecture Refactoring - Validation Guide

**Date:** 2026-01-24
**Type:** Major Architectural Refactoring
**Database Migration:** v1 → v2

## Overview

This document provides step-by-step instructions to validate the major sync architecture refactoring that eliminated the dual source of truth (sync_status column + sync_queue table) in favor of sync_queue as the exclusive sync status source.

## What Changed?

### Before (v1):
- ✅ `captures.sync_status` column: 'pending' | 'synced' | 'conflict'
- ✅ `sync_queue` table: Independent tracking
- ❌ **Problem:** Two sources that could desynchronize

### After (v2):
- ✅ `sync_queue` table: **Single source of truth**
- ✅ FK constraint: `sync_queue.entity_id → captures.id ON DELETE CASCADE`
- ✅ Pending: Presence in sync_queue
- ✅ Synced: Absence in sync_queue
- ✅ Conflict: `operation='conflict'` in sync_queue

## Validation Steps

### Step 1: Run Automated Validation

```bash
cd pensieve/mobile
./scripts/validate-sync-refactoring.sh
```

This script performs 13 automated checks:
1. ✅ Schema version = 2
2. ✅ sync_status column removed
3. ✅ FK constraint added
4. ✅ 'conflict' operation type added
5. ✅ Migration v2 exists with rollback
6. ✅ Domain model updated (no syncStatus)
7. ✅ Repository interface updated (5 new methods)
8. ✅ Repository implementation uses JOIN queries
9. ✅ Services refactored (OfflineSyncService, RetentionPolicyService)
10. ✅ Test context mocks updated
11. ✅ Gherkin scenarios refactored (44 scenarios)
12. ✅ Step definitions created
13. ✅ TypeScript compilation passes

**Expected Output:**
```
================================================
📊 Validation Summary
================================================

Total Checks: XX
Passed: XX
Failed: 0
Warnings: 0

✅ All validation checks passed!

Next steps:
1. Run unit tests: npm test
2. Run acceptance tests: npm run test:acceptance
3. Manual testing: ...
```

### Step 2: Run Unit Tests

```bash
npm test
```

**What to look for:**
- All tests should pass (or at least no new failures)
- Check for any tests that reference `syncStatus` (should be none)
- Verify Repository tests use new methods (findPendingSync, findSynced)

### Step 3: Run Acceptance Tests (BDD)

```bash
npm run test:acceptance
```

**What to look for:**
- All Gherkin scenarios should pass
- Check step definitions use sync_queue patterns
- Verify no "syncStatus" references in test output

### Step 4: Manual Testing

#### 4.1 Create Capture & Verify Sync Queue

1. **Start app in offline mode**
   ```bash
   npm start
   # Toggle airplane mode in simulator/device
   ```

2. **Create audio capture**
   - Tap record button
   - Record for 3 seconds
   - Stop recording

3. **Verify in sync_queue**
   - Open React Native Debugger / Flipper
   - Check database: `SELECT * FROM sync_queue`
   - Expected: 1 row with `entity_type='capture'`, `operation='create'`

4. **Check OfflineIndicator**
   - Should show: "🔴 Offline - 1 capture en attente"
   - NOT: "🔴 Offline - 0 capture en attente" (this was the bug!)

#### 4.2 Sync & Verify Removal

1. **Go back online**
   - Disable airplane mode
   - Wait for sync to complete

2. **Verify sync_queue cleared**
   - Check database: `SELECT * FROM sync_queue WHERE entity_type='capture'`
   - Expected: 0 rows

3. **Check OfflineIndicator**
   - Should hide (no pending captures)

#### 4.3 Delete Capture & Verify CASCADE

1. **Create capture in offline mode**
   - Follow 4.1 steps

2. **Check sync_queue**
   - Should have 1 entry

3. **Delete the capture**
   - Swipe to delete or use delete button

4. **Verify CASCADE worked**
   - Check: `SELECT * FROM sync_queue WHERE entity_id='<deleted_id>'`
   - Expected: 0 rows (FK CASCADE deleted it)

#### 4.4 Migration Test (Fresh Install)

1. **Clear app data** (simulates fresh install with v2)
   ```bash
   # iOS Simulator
   xcrun simctl uninstall booted com.pensieve.mobile

   # Android
   adb uninstall com.pensieve.mobile
   ```

2. **Reinstall & start app**
   ```bash
   npm start
   # Build and run
   ```

3. **Verify schema v2 created**
   - Check database schema
   - No sync_status column in captures
   - FK constraint exists on sync_queue

4. **Create capture**
   - Should automatically add to sync_queue
   - Verify with database query

## Migration Verification

### Pre-Migration Checks

**If upgrading from v1 to v2:**

The migration automatically runs when app starts with SCHEMA_VERSION = 2.

**Migration performs:**
1. Creates captures_new without sync_status
2. Migrates all data
3. Migrates pending captures → sync_queue (operation='create')
4. Migrates conflict captures → sync_queue (operation='conflict')
5. Swaps tables
6. Adds FK constraint to sync_queue

**Validation during migration:**
```typescript
// Pre-migration: Check for orphaned entries
SELECT COUNT(*) FROM sync_queue sq
WHERE entity_type = 'capture'
  AND NOT EXISTS (SELECT 1 FROM captures WHERE id = sq.entity_id)
// Expected: 0 (or auto-cleaned)

// Post-migration: Verify sync_status removed
PRAGMA table_info(captures)
// Expected: No 'sync_status' column

// Post-migration: Verify FK exists
PRAGMA foreign_key_list(sync_queue)
// Expected: FK to captures(id)
```

### Rollback (If Needed)

If migration fails or issues found:

```typescript
import { rollbackTo } from './src/database/migrations';
import { database } from './src/database';

// Rollback to v1
rollbackTo(database, 1);
```

This will:
- Recreate sync_status column
- Infer sync status from sync_queue
- Remove FK constraint
- Remove 'conflict' operations

## Troubleshooting

### Issue: TypeScript Errors

**Problem:** `Property 'syncStatus' does not exist on type 'Capture'`

**Solution:**
- Old code referencing `capture.syncStatus`
- Replace with: `await repository.isPendingSync(capture.id)`

### Issue: Gherkin Steps Undefined

**Problem:** Step definition `la capture est dans la queue de synchronisation` not found

**Solution:**
- Ensure `tests/acceptance/support/sync-queue-steps.ts` is imported
- Check step definition matches Gherkin exactly (accents, spacing)

### Issue: OfflineIndicator Shows 0

**Problem:** Created capture but indicator shows "0 captures en attente"

**Solution:**
- Verify capture was added to sync_queue during create
- Check `CaptureRepository.create()` calls `syncQueueService.enqueue()`
- Inspect database: `SELECT * FROM sync_queue`

### Issue: Migration Fails - sync_status column not found

**Problem:** Migration v2 fails with error about `sync_status` column not existing

**Root Cause:** Migration v1 was creating v2 schema (without sync_status) instead of v1 schema

**Solution:** ✅ **FIXED** - Migration v1 now creates proper v1 schema with sync_status column
- Uninstall app to clear old database
- Rebuild app from scratch
- Migration v1 will create v1 schema, then v2 will migrate properly

### Issue: Other Migration Failures

**Problem:** Migration v2 throws other errors during startup

**Solution:**
1. Check logs for specific error
2. Common issues:
   - Orphaned sync_queue entries (auto-cleaned by migration)
   - FK constraint violation (check data integrity)
   - SQL syntax errors (check OP-SQLite compatibility)
3. If persistent, rollback to v1 and report issue

## Performance Validation

### Query Performance

Test that JOIN queries perform well:

```sql
-- Before (column-based)
SELECT * FROM captures WHERE sync_status = 'pending'

-- After (JOIN-based)
SELECT c.* FROM captures c
INNER JOIN sync_queue sq ON c.id = sq.entity_id
WHERE sq.entity_type = 'capture'
  AND sq.operation IN ('create', 'update', 'delete')
```

**Verify indexes used:**
- `idx_sync_queue_entity` on sync_queue(entity_type, entity_id)
- `idx_captures_created_at` for ordering

**Expected performance:** Similar or better than v1 (JOIN is efficient with proper indexes)

## Success Criteria

### ✅ Refactoring Complete When:

- [ ] All automated validation checks pass
- [ ] Unit tests pass (0 failures related to sync)
- [ ] Acceptance tests pass (0 Gherkin step failures)
- [ ] Manual test: Create capture → appears in sync_queue
- [ ] Manual test: OfflineIndicator shows correct count (not 0!)
- [ ] Manual test: Sync → removes from sync_queue
- [ ] Manual test: Delete capture → CASCADE works
- [ ] Migration test: Fresh install creates v2 schema
- [ ] Migration test: Upgrade from v1 → v2 preserves data
- [ ] No TypeScript errors
- [ ] No runtime crashes
- [ ] Performance acceptable (queries < 100ms for 1000 captures)

## Reporting Issues

If validation fails or issues found:

1. **Document the issue:**
   - Exact error message
   - Steps to reproduce
   - Database state (dump sync_queue + captures)

2. **Check known issues:**
   - See Story 2.4 documentation in `_bmad-output/implementation-artifacts/`

3. **Rollback if critical:**
   ```typescript
   rollbackTo(database, 1)
   ```

4. **Report to team:**
   - Include validation script output
   - Include test failure logs
   - Include database schema dump

## Documentation

- **Full Refactoring Documentation:** `_bmad-output/implementation-artifacts/2-4-stockage-offline-des-captures.md`
- **Migration Code:** `pensieve/mobile/src/database/migrations.ts`
- **Schema:** `pensieve/mobile/src/database/schema.ts`
- **Repository:** `pensieve/mobile/src/contexts/capture/data/CaptureRepository.ts`

## Next Steps After Validation

Once all validation passes:

1. **Update sprint-status.yaml** (if needed)
2. **Commit changes:**
   ```bash
   git add .
   git commit -m "refactor: unified sync architecture v2 - eliminate sync_status column

   - Remove captures.sync_status column (single source of truth = sync_queue)
   - Add FK constraint: sync_queue.entity_id → captures.id ON DELETE CASCADE
   - Add 'conflict' operation type to sync_queue
   - Implement 5 new repository methods (findPendingSync, findSynced, etc.)
   - Refactor services (OfflineSyncService, RetentionPolicyService)
   - Update 44 Gherkin scenarios + create sync-queue-steps.ts
   - Database migration v1→v2 with rollback support

   Fixes: OfflineIndicator bug (showing 0 when captures exist)
   Migration: Automated 12-step SQL migration with validation
   Breaking: ICaptureRepository.findBySyncStatus() removed"
   ```
3. **Push to remote**
4. **Create PR** (if needed)
5. **Mark Story 2.4 as completely done** ✅

---

**Validation Script:** `pensieve/mobile/scripts/validate-sync-refactoring.sh`
**Last Updated:** 2026-01-24
