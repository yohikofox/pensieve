/**
 * Script d'inspection de la queue de transcription
 *
 * Usage:
 * 1. Mettre ce code dans un bouton de debug dans l'app
 * 2. Ou l'exécuter via Node.js pour inspecter la DB
 */

import { database } from '../src/database';

export function inspectTranscriptionQueue() {
  const db = database.getDatabase();

  console.log('\n========== TRANSCRIPTION QUEUE INSPECTION ==========\n');

  // 1. Items en attente
  console.log('📋 Items en queue (pending):');
  const pendingResult = db.executeSync(
    `SELECT
      id,
      capture_id,
      status,
      audio_path,
      audio_duration,
      created_at,
      updated_at
     FROM transcription_queue
     WHERE status = 'pending'
     ORDER BY created_at ASC`
  );
  const pendingItems = pendingResult.rows || [];
  console.table(pendingItems);
  console.log(`Total pending: ${pendingItems.length}\n`);

  // 2. Items en cours de traitement
  console.log('⚙️  Items en traitement (processing):');
  const processingResult = db.executeSync(
    `SELECT
      id,
      capture_id,
      status,
      audio_path,
      created_at,
      updated_at
     FROM transcription_queue
     WHERE status = 'processing'`
  );
  const processingItems = processingResult.rows || [];
  console.table(processingItems);
  console.log(`Total processing: ${processingItems.length}\n`);

  // 3. Items complétés (si on les garde)
  console.log('✅ Items complétés (completed):');
  const completedResult = db.executeSync(
    `SELECT
      id,
      capture_id,
      status,
      completed_at
     FROM transcription_queue
     WHERE status = 'completed'
     ORDER BY completed_at DESC
     LIMIT 10`
  );
  const completedItems = completedResult.rows || [];
  console.table(completedItems);
  console.log(`Total completed (last 10): ${completedItems.length}\n`);

  // 4. État de pause
  console.log('⏸️  État de pause:');
  const pauseResult = db.executeSync(
    `SELECT value FROM app_settings WHERE key = 'transcription_queue_paused'`
  );
  const pauseState = pauseResult.rows?.[0];
  const isPaused = pauseState?.value === '1';
  console.log(`Queue paused: ${isPaused ? '🔴 OUI' : '🟢 NON'}\n`);

  // 5. Statistiques globales
  console.log('📊 Statistiques globales:');
  const statsResult = db.executeSync(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
     FROM transcription_queue`
  );
  const stats = statsResult.rows?.[0];
  console.table(stats);

  // 6. Dernière activité
  console.log('\n🕐 Dernière activité:');
  const lastActivityResult = db.executeSync(
    `SELECT
      capture_id,
      status,
      MAX(updated_at) as last_update
     FROM transcription_queue
     GROUP BY capture_id, status
     ORDER BY last_update DESC
     LIMIT 1`
  );
  const lastActivity = lastActivityResult.rows?.[0];
  if (lastActivity) {
    const lastUpdateDate = new Date(lastActivity.last_update);
    console.log(`Last update: ${lastUpdateDate.toISOString()}`);
    console.log(`Capture ID: ${lastActivity.capture_id}`);
    console.log(`Status: ${lastActivity.status}`);
  }

  console.log('\n====================================================\n');
}

// Pour inspecter les captures liées
export function inspectCapturesWithTranscription() {
  const db = database.getDatabase();

  console.log('\n========== CAPTURES WITH TRANSCRIPTION ==========\n');

  const capturesResult = db.executeSync(
    `SELECT
      c.id,
      c.type,
      c.state,
      c.raw_content,
      c.normalized_text,
      c.duration,
      tq.status as transcription_status,
      tq.created_at as queued_at
     FROM captures c
     LEFT JOIN transcription_queue tq ON c.id = tq.capture_id
     WHERE c.type = 'audio'
     ORDER BY c.created_at DESC
     LIMIT 20`
  );
  const captures = capturesResult.rows || [];

  console.table(captures);
  console.log(`\nTotal audio captures (last 20): ${captures.length}\n`);
  console.log('====================================================\n');
}
