import { SetMetadata } from '@nestjs/common';
import { ResourceType } from '../../core/enums/resource-type.enum';

/**
 * Key for storing ownership metadata
 */
export const OWNERSHIP_KEY = 'required_ownership';

/**
 * Metadata for ownership requirement
 */
export interface OwnershipMetadata {
  resourceType: ResourceType;
  paramKey: string;
}

/**
 * Decorator to require resource ownership
 *
 * @param metadata - Configuration object
 * @param metadata.resourceType - Type of the resource
 * @param metadata.paramKey - Name of the route parameter containing the resource ID
 *
 * @example
 * @Delete(':id')
 * @UseGuards(ResourceOwnershipGuard)
 * @RequireOwnership({ resourceType: ResourceType.THOUGHT, paramKey: 'id' })
 * async deleteThought(@Param('id') id: string) {
 *   // Only the owner can delete
 * }
 */
export const RequireOwnership = (metadata: OwnershipMetadata) =>
  SetMetadata(OWNERSHIP_KEY, metadata);
