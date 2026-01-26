/**
 * Utility pour combiner des classes conditionnellement
 * Similar to clsx/classnames but lightweight
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Type-safe pick utility for selecting specific keys from an object
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return keys.reduce(
    (result, key) => {
      if (key in obj) {
        result[key] = obj[key];
      }
      return result;
    },
    {} as Pick<T, K>
  );
}

/**
 * Format duration in seconds to human-readable format
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
}
