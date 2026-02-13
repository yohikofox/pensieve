import { IsNumber, IsObject, IsNotEmpty } from 'class-validator';

/**
 * Push Request DTO (ADR-009.2)
 *
 * Client sends local changes to server with lastPulledAt for conflict detection.
 */
export class PushRequestDto {
  /**
   * Unix timestamp (ms) of last successful pull.
   * Used for conflict detection.
   */
  @IsNotEmpty()
  @IsNumber()
  lastPulledAt!: number;

  /**
   * Changes object with entity types as keys and arrays of records as values.
   *
   * Example:
   * {
   *   captures: {
   *     updated: [{ id: 'c1', title: 'Updated', last_modified_at: 1736760700000 }],
   *     deleted: ['c2']
   *   },
   *   todos: {
   *     updated: [{ id: 't1', state: 'completed', completed_at: 1736760700000 }]
   *   }
   * }
   */
  @IsNotEmpty()
  @IsObject()
  changes!: {
    [entity: string]: {
      updated?: any[];
      deleted?: string[];
    };
  };
}
