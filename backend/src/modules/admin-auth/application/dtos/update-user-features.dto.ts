import { IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO for updating user feature flags via admin interface
 * Story 7.1: Support Mode avec Permissions Backend - Task 2
 *
 * All fields are optional to support partial updates (PATCH semantics).
 */
export class UpdateUserFeaturesDto {
  /**
   * Enable or disable debug mode access for the user
   */
  @IsOptional()
  @IsBoolean()
  debug_mode_access?: boolean;

  /**
   * Enable or disable datamining (query builder) access for the user
   */
  @IsOptional()
  @IsBoolean()
  data_mining_access?: boolean;
}
