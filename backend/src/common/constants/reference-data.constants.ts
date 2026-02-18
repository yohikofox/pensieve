/**
 * Reference Data Constants — UUIDs déterministes pour les tables référentielles
 *
 * Story 12.2: Migration des PKs entières vers UUID dans les domaines capturés.
 * Story 13.2: Ajout des constantes pour thought_statuses (ADR-026 R2).
 *
 * Ces UUIDs fixes permettent au code de les référencer comme constantes
 * sans nécessiter de lookup DB à chaque opération (ADR-026 R1).
 *
 * Format: <prefix>0000-0000-7000-8000-<sequence>
 *   - a = capture_types
 *   - b = capture_states
 *   - c = capture_sync_statuses
 *   - d = thought_statuses
 *
 * Ces valeurs sont insérées dans la migration MigrateEntityPKsToUUIDDomainGenerated.
 */

export const CAPTURE_TYPE_IDS = {
  AUDIO: 'a0000000-0000-7000-8000-000000000001',
  TEXT: 'a0000000-0000-7000-8000-000000000002',
} as const;

export const CAPTURE_STATE_IDS = {
  RECORDING: 'b0000000-0000-7000-8000-000000000001',
  CAPTURED: 'b0000000-0000-7000-8000-000000000002',
  FAILED: 'b0000000-0000-7000-8000-000000000003',
} as const;

export const CAPTURE_SYNC_STATUS_IDS = {
  ACTIVE: 'c0000000-0000-7000-8000-000000000001',
  DELETED: 'c0000000-0000-7000-8000-000000000002',
} as const;

export const THOUGHT_STATUS_IDS = {
  ACTIVE: 'd0000000-0000-7000-8000-000000000001',
  ARCHIVED: 'd0000000-0000-7000-8000-000000000002',
} as const;
