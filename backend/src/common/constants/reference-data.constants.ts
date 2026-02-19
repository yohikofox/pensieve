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

export const THOUGHT_STATUS_IDS = {
  /** Thought actif — état par défaut après digestion IA */
  ACTIVE: 'd0000000-0000-7000-8000-000000000001',
  /** Thought archivé — masqué du feed principal */
  ARCHIVED: 'd0000000-0000-7000-8000-000000000002',
} as const;
