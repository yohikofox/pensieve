/**
 * Entity changes response structure
 */
interface EntityChangesResponse {
  updated?: any[]; // Records updated since last pull
  deleted?: any[]; // Records marked as deleted
}

/**
 * Changes response grouping all entities
 */
interface ChangesResponse {
  captures?: EntityChangesResponse;
  thoughts?: EntityChangesResponse;
  ideas?: EntityChangesResponse;
  todos?: EntityChangesResponse;
}

/**
 * DTO for sync responses (pull and push)
 * Returns server-side changes to client
 */
export class SyncResponseDto {
  /**
   * Server-side changes since last_pulled_at
   */
  changes!: ChangesResponse;

  /**
   * New server timestamp for next pull
   * Client should save this as last_pulled_at
   */
  timestamp!: number;

  /**
   * Optional conflicts detected during push
   */
  conflicts?: Array<{
    entity: string;
    record_id: string;
    conflict_type: string;
    resolution: 'client_wins' | 'server_wins' | 'merged';
  }>;
}
