/**
 * Deadline Formatting Utility
 *
 * Story 5.1 - Task 9: Human-Readable Deadline Formatting (AC4)
 * Subtask 9.1-9.7: Format deadlines with relative time and overdue detection
 */

import {
  formatDistanceToNow,
  isPast,
  isToday,
  isTomorrow,
  addDays,
  differenceInDays,
} from "date-fns";
import { fr } from "date-fns/locale";

export interface DeadlineFormat {
  text: string;
  isOverdue: boolean;
  color: "warning" | "normal" | "none";
}

/**
 * Format deadline with human-readable relative time
 * Subtask 9.2-9.7: Implement relative time formatting with overdue detection
 *
 * @param deadline - Unix timestamp (ms) or undefined
 * @returns Formatted deadline with overdue flag and color indicator
 *
 * Examples:
 * - Today → "Aujourd'hui"
 * - Tomorrow → "Demain"
 * - In 3 days → "Dans 3 jours"
 * - Overdue by 2 days → "En retard de 2 jours"
 * - null/undefined → "Pas d'échéance"
 */
export function formatDeadline(deadline?: number): DeadlineFormat {
  // Subtask 9.6: Handle null/undefined deadlines
  if (!deadline) {
    return {
      text: "Pas d'échéance",
      isOverdue: false,
      color: "none",
    };
  }

  const deadlineDate = new Date(deadline);
  const now = new Date();

  // Subtask 9.4: Detect overdue deadlines (deadline < now)
  const overdue = isPast(deadlineDate) && !isToday(deadlineDate);

  if (overdue) {
    // Subtask 9.5: Return warning color for overdue deadlines
    const daysOverdue = Math.abs(differenceInDays(deadlineDate, now));

    if (daysOverdue === 0) {
      return {
        text: "En retard (aujourd'hui)",
        isOverdue: true,
        color: "warning",
      };
    } else if (daysOverdue === 1) {
      return {
        text: "En retard de 1 jour",
        isOverdue: true,
        color: "warning",
      };
    } else {
      return {
        text: `En retard de ${daysOverdue} jours`,
        isOverdue: true,
        color: "warning",
      };
    }
  }

  // Subtask 9.3: Implement relative time formatting
  if (isToday(deadlineDate)) {
    return {
      text: "Aujourd'hui",
      isOverdue: false,
      color: "normal",
    };
  }

  if (isTomorrow(deadlineDate)) {
    return {
      text: "Demain",
      isOverdue: false,
      color: "normal",
    };
  }

  const daysUntil = differenceInDays(deadlineDate, now);

  if (daysUntil <= 7) {
    return {
      text: `Dans ${daysUntil} jour${daysUntil > 1 ? "s" : ""}`,
      isOverdue: false,
      color: "normal",
    };
  }

  // For dates > 7 days, use relative time with date-fns (Issue #16 fix: locale française)
  const relativeTime = formatDistanceToNow(deadlineDate, {
    locale: fr,
    addSuffix: false,
  });

  return {
    text: `Dans ${relativeTime}`,
    isOverdue: false,
    color: "normal",
  };
}

/**
 * Get color value for deadline based on status
 * Helper function for UI components
 *
 * @param format - DeadlineFormat from formatDeadline()
 * @param isDark - Dark mode flag
 * @returns Color hex string
 */
export function getDeadlineColor(
  format: DeadlineFormat,
  isDark: boolean,
): string {
  if (format.color === "warning") {
    return isDark ? "#f87171" : "#dc2626"; // red-400 / red-600
  }

  if (format.color === "normal") {
    return isDark ? "#9ca3af" : "#6b7280"; // gray-400 / gray-600
  }

  // 'none'
  return isDark ? "#9ca3af" : "#6b7280"; // gray-400 / gray-600
}
