/**
 * getUrgencyLevel — Calcul du niveau d'urgence d'un Todo
 *
 * Story 8.15 — Subtask 1.1
 * AC1–AC4: Mapping Todo → UrgencyLevel
 *
 * Ordre de précédence : overdue > prioritaire > approaching > normal
 */

import type { Todo } from '../domain/Todo.model';
import { formatDeadline } from './formatDeadline';

export type UrgencyLevel = 'overdue' | 'prioritaire' | 'approaching' | 'normal';

const APPROACHING_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48h

/**
 * Calcule le niveau d'urgence d'un todo.
 *
 * Précédences : overdue > prioritaire > approaching > normal
 * - overdue    : deadline dépassée (isOverdue === true)
 * - prioritaire: priority === 'high' (pas overdue)
 * - approaching: deadline dans les 48h (pas overdue, pas high priority)
 * - normal     : pas d'urgence particulière
 *
 * Note: une deadline "aujourd'hui mais heure déjà passée" retourne 'approaching' (amber)
 * car formatDeadline utilise `!isToday()` pour exclure les deadlines du jour de l'overdue.
 */
export function getUrgencyLevel(todo: Todo): UrgencyLevel {
  if (todo.deadline && formatDeadline(todo.deadline).isOverdue) {
    return 'overdue';
  }
  if (todo.priority === 'high') {
    return 'prioritaire';
  }
  if (todo.deadline && (todo.deadline - Date.now()) <= APPROACHING_THRESHOLD_MS) {
    return 'approaching';
  }
  return 'normal';
}
