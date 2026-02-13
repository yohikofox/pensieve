/**
 * Sync Response DTO (ADR-009.2)
 *
 * Server response for both pull and push operations.
 * Contains changes to apply on client and new timestamp for next sync.
 */
export class SyncResponseDto {
  /**
   * Changes object with entity types as keys and updated/deleted records.
   *
   * Example:
   * {
   *   captures: {
   *     updated: [{ id: 'c1', title: 'Server capture', last_modified_at: 1736760000000 }],
   *     deleted: ['c2']
   *   },
   *   thoughts: {
   *     updated: [{ id: 'th1', content: 'AI generated thought', last_modified_at: 1736760100000 }]
   *   }
   * }
   */
  changes!: {
    [entity: string]: {
      updated?: any[];
      deleted?: string[];
    };
  };

  /**
   * New timestamp for client to store as lastPulledAt for next sync.
   */
  timestamp!: number;

  /**
   * Optional: Array of conflicts detected and resolved during push.
   *
   * Example: [{ entity: 'todo', recordId: 't1', resolution: 'per-column-hybrid' }]
   */
  conflicts?: Array<{
    entity: string;
    recordId: string;
    resolution: string;
  }>;
}
