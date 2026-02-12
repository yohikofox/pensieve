import { SetMetadata } from '@nestjs/common';

/**
 * Key for storing permission metadata
 */
export const PERMISSION_KEY = 'required_permission';

/**
 * Decorator to require a specific permission for a route
 *
 * @param permission - Permission name (e.g., "thought.read")
 *
 * @example
 * @Get()
 * @UseGuards(PermissionGuard)
 * @RequirePermission('thought.read')
 * async getThoughts() {
 *   // Only users with "thought.read" permission can access this
 * }
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);
