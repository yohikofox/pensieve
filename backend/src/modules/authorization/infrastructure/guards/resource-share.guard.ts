import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IAuthorizationService } from '../../core/interfaces/authorization.interface';
import {
  SHARED_ACCESS_KEY,
  SharedAccessMetadata,
} from '../decorators/allow-shared-access.decorator';

/**
 * Guard to check if user has access to a shared resource
 *
 * Allows access if user is EITHER:
 * - The owner, OR
 * - Has the resource shared with them
 *
 * Usage with @AllowSharedAccess decorator
 */
@Injectable()
export class ResourceShareGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject('IAuthorizationService')
    private readonly authService: IAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get shared access metadata
    const metadata = this.reflector.get<SharedAccessMetadata>(
      SHARED_ACCESS_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      // No shared access configuration, allow access
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Extract resource ID from route params
    const resourceId = request.params[metadata.paramKey];

    if (!resourceId) {
      throw new BadRequestException(
        `Missing resource ID parameter: ${metadata.paramKey}`,
      );
    }

    // Check if user is the owner (bypass share check)
    const isOwner = await this.authService.isResourceOwner(
      user.id,
      metadata.resourceType,
      resourceId,
    );

    if (isOwner) {
      return true; // Owner always has access
    }

    // Check if user has shared access with required permission
    const hasSharedAccess = await this.authService.hasPermission({
      userId: user.id,
      permission: metadata.requiredPermission,
      resourceId,
      resourceType: metadata.resourceType,
    });

    if (!hasSharedAccess) {
      throw new ForbiddenException(
        `Access denied: You do not have access to this ${metadata.resourceType}`,
      );
    }

    return true;
  }
}
