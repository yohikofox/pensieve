import { IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for sync pull requests
 * Client requests changes from server since last_pulled_at timestamp
 */
export class PullRequestDto {
  /**
   * Last pull timestamp in milliseconds (Unix epoch)
   * If not provided or 0, returns all records
   */
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  last_pulled_at?: number;
}
