import { SetMetadata } from '@nestjs/common';
import { ResourceType } from '../../core/enums/resource-type.enum';

/**
 * Key for storing shared access metadata
 */
export const SHARED_ACCESS_KEY = 'allow_shared_access';

/**
 * Metadata for shared access
 */
export interface SharedAccessMetadata {
  resourceType: ResourceType;
  paramKey: string;
  requiredPermission: string;
}

/**
 * Decorator to allow access to shared resources
 *
 * Allows access if user is EITHER:
 * - The owner of the resource, OR
 * - Has the resource shared with them with the required permission
 *
 * @param metadata - Configuration object
 * @param metadata.resourceType - Type of the resource
 * @param metadata.paramKey - Name of the route parameter containing the resource ID
 * @param metadata.requiredPermission - Permission required for access
 *
 * @example
 * @Get(':id')
 * @UseGuards(ResourceShareGuard)
 * @AllowSharedAccess({
 *   resourceType: ResourceType.THOUGHT,
 *   paramKey: 'id',
 *   requiredPermission: 'thought.read'
 * })
 * async getThought(@Param('id') id: string) {
 *   // Owner OR users with shared read access can view
 * }
 */
export const AllowSharedAccess = (metadata: SharedAccessMetadata) =>
  SetMetadata(SHARED_ACCESS_KEY, metadata);
