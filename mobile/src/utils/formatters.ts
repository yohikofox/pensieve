/**
 * Formatting Utilities
 *
 * Pure functions for formatting dates, durations, and other display values
 */

/**
 * Format a Date object to a localized French date string
 * @param date - Date to format
 * @returns Formatted date string (e.g., "lundi 15 janvier 2024, 14:30")
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a duration in milliseconds to a human-readable string
 * @param ms - Duration in milliseconds
 * @returns Formatted duration (e.g., "2min 30s" or "45s")
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}min ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}
