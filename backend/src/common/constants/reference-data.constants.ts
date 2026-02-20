/**
 * Reference Data Constants — UUIDs déterministes pour les tables référentielles
 *
 * Convention de nommage des préfixes UUID:
 *   a = capture_types
 *   b = capture_states
 *   c = capture_sync_statuses
 *   d = thought_statuses
 *
 * ADR-026 R2: Tables référentielles avec codes immuables.
 * Ces constantes doivent correspondre EXACTEMENT aux seeds de migration.
 *
 * @see Migration 1771600000000-CreateThoughtStatusesAndUpdateCaptureStates
 */

export const CAPTURE_TYPE_IDS = {
  AUDIO: 'a0000000-0000-7000-8000-000000000001',
  TEXT: 'a0000000-0000-7000-8000-000000000002',
} as const;

export const CAPTURE_STATE_IDS = {
  RECORDING: 'b0000000-0000-7000-8000-000000000001',
  CAPTURED: 'b0000000-0000-7000-8000-000000000002',
  FAILED: 'b0000000-0000-7000-8000-000000000003',
  PROCESSING: 'b0000000-0000-7000-8000-000000000004',
  READY: 'b0000000-0000-7000-8000-000000000005',
} as const;

export const CAPTURE_SYNC_STATUS_IDS = {
  ACTIVE: 'c0000000-0000-7000-8000-000000000001',
  DELETED: 'c0000000-0000-7000-8000-000000000002',
} as const;

export const THOUGHT_STATUS_IDS = {
  /** Thought actif — état par défaut après digestion IA */
  ACTIVE: 'd0000000-0000-7000-8000-000000000001',
  /** Thought archivé — masqué du feed principal */
  ARCHIVED: 'd0000000-0000-7000-8000-000000000002',
} as const;
