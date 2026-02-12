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
  OWNERSHIP_KEY,
  OwnershipMetadata,
} from '../decorators/require-ownership.decorator';

/**
 * Guard to check if user owns a resource
 *
 * Usage with @RequireOwnership decorator
 */
@Injectable()
export class ResourceOwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject('IAuthorizationService')
    private readonly authService: IAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get ownership metadata
    const metadata = this.reflector.get<OwnershipMetadata>(
      OWNERSHIP_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      // No ownership requirement, allow access
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

    // Check ownership
    const isOwner = await this.authService.isResourceOwner(
      user.id,
      metadata.resourceType,
      resourceId,
    );

    if (!isOwner) {
      throw new ForbiddenException(
        `Access denied: You do not own this ${metadata.resourceType}`,
      );
    }

    return true;
  }
}
