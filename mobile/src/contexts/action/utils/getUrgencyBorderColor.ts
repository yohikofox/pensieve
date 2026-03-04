/**
 * getUrgencyBorderColor — Mapping UrgencyLevel → couleur de bordure
 *
 * Story 8.15 — Subtask 1.2
 * ADR-024 : pas de magic strings dans les composants → constantes ici
 */

import type { UrgencyLevel } from './getUrgencyLevel';

export const URGENCY_BORDER_COLORS = {
  overdue:     '#EF4444', // red-500    — identique bg-error-500
  prioritaire: '#F97316', // orange-500 — identique badge "Haute" (bg-warning-500)
  approaching: '#F59E0B', // amber-500
  normal:      'transparent',
} as const satisfies Record<UrgencyLevel, string>;

/**
 * Retourne la couleur hex de la bordure gauche pour un niveau d'urgence.
 */
export function getUrgencyBorderColor(level: UrgencyLevel): string {
  return URGENCY_BORDER_COLORS[level];
}
