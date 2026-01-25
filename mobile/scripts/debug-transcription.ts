/**
 * Debug script to check transcription queue state
 *
 * Usage:
 * npx ts-node --project tsconfig.json scripts/debug-transcription.ts
 */

import { database } from '../src/database';

console.log('=== Transcription Queue Debug ===\n');

const db = database.getDatabase();

// 1. Check if table exists
try {
  const tableCheck = db.executeSync(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='transcription_queue'`
  );
  console.log('1. Table existence check:');
  console.log(tableCheck.rows && tableCheck.rows.length > 0
    ? '✅ transcription_queue table exists'
    : '❌ transcription_queue table NOT FOUND');
  console.log();
} catch (error) {
  console.error('❌ Error checking table:', error);
}

// 2. Check table schema
try {
  const schema = db.executeSync(`PRAGMA table_info(transcription_queue)`);
  console.log('2. Table schema:');
  console.table(schema.rows);
  console.log();
} catch (error) {
  console.error('❌ Error getting schema:', error);
}

// 3. Count total items in queue
try {
  const countResult = db.executeSync(`SELECT COUNT(*) as total FROM transcription_queue`);
  const count = countResult.rows?.[0]?.total || 0;
  console.log(`3. Total items in queue: ${count}`);
  console.log();
} catch (error) {
  console.error('❌ Error counting items:', error);
}

// 4. Show all queue items
try {
  const itemsResult = db.executeSync(`SELECT * FROM transcription_queue ORDER BY created_at DESC LIMIT 10`);
  console.log('4. Recent queue items (last 10):');
  if (itemsResult.rows && itemsResult.rows.length > 0) {
    console.table(itemsResult.rows);
  } else {
    console.log('  (empty)');
  }
  console.log();
} catch (error) {
  console.error('❌ Error fetching items:', error);
}

// 5. Check stats by status
try {
  const statsResult = db.executeSync(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
     FROM transcription_queue`
  );
  console.log('5. Stats by status:');
  console.table(statsResult.rows);
  console.log();
} catch (error) {
  console.error('❌ Error getting stats:', error);
}

// 6. Check recent audio captures
try {
  const capturesResult = db.executeSync(
    `SELECT id, type, state, raw_content, duration, created_at
     FROM captures
     WHERE type = 'audio'
     ORDER BY created_at DESC
     LIMIT 5`
  );
  console.log('6. Recent audio captures:');
  if (capturesResult.rows && capturesResult.rows.length > 0) {
    console.table(capturesResult.rows);
  } else {
    console.log('  (no audio captures found)');
  }
  console.log();
} catch (error) {
  console.error('❌ Error fetching captures:', error);
}

// 7. Check if there are captures that should be in queue but aren't
try {
  const missingResult = db.executeSync(
    `SELECT c.id, c.state, c.raw_content, c.created_at
     FROM captures c
     LEFT JOIN transcription_queue tq ON c.id = tq.capture_id
     WHERE c.type = 'audio'
     AND c.state = 'captured'
     AND tq.id IS NULL
     ORDER BY c.created_at DESC
     LIMIT 5`
  );
  console.log('7. Audio captures NOT in transcription queue (but should be):');
  if (missingResult.rows && missingResult.rows.length > 0) {
    console.log('⚠️ Found captures that should be in queue:');
    console.table(missingResult.rows);
  } else {
    console.log('  ✅ All audio captures are properly queued (or none exist)');
  }
  console.log();
} catch (error) {
  console.error('❌ Error checking missing items:', error);
}

console.log('=== Debug Complete ===');
