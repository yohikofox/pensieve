import { IsBoolean } from 'class-validator';

/**
 * DTO for updating user feature flags via admin interface
 * Story 7.1: Support Mode avec Permissions Backend - Task 2
 */
export class UpdateUserFeaturesDto {
  /**
   * Enable or disable debug mode access for the user
   */
  @IsBoolean()
  debug_mode_access!: boolean;
}
