import { IsNumber, IsOptional, IsString } from 'class-validator';

/**
 * Pull Request DTO (ADR-009.2)
 *
 * Client sends lastPulledAt timestamp to get changes since last sync.
 */
export class PullRequestDto {
  /**
   * Unix timestamp (ms) of last successful pull.
   * Server returns changes after this timestamp.
   */
  @IsOptional()
  @IsNumber()
  lastPulledAt?: number;

  /**
   * Optional: Comma-separated list of entities to sync (e.g., "capture,todo").
   * If omitted, sync all.
   */
  @IsOptional()
  @IsString()
  entities?: string;
}
