import { IsNumber, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Entity change payload for push requests
 */
class EntityChanges {
  updated?: any[]; // Records to update/create
  deleted?: any[]; // Records to mark as deleted (soft delete)
}

/**
 * Changes payload grouping all entities
 */
class ChangesPayload {
  @IsObject()
  @ValidateNested()
  @Type(() => EntityChanges)
  captures?: EntityChanges;

  @IsObject()
  @ValidateNested()
  @Type(() => EntityChanges)
  thoughts?: EntityChanges;

  @IsObject()
  @ValidateNested()
  @Type(() => EntityChanges)
  ideas?: EntityChanges;

  @IsObject()
  @ValidateNested()
  @Type(() => EntityChanges)
  todos?: EntityChanges;
}

/**
 * DTO for sync push requests
 * Client sends local changes to server
 */
export class PushRequestDto {
  /**
   * Last pull timestamp in milliseconds
   * Used for conflict detection
   */
  @IsNumber()
  last_pulled_at!: number;

  /**
   * Changes grouped by entity type
   */
  @IsObject()
  @ValidateNested()
  @Type(() => ChangesPayload)
  changes!: ChangesPayload;
}
