import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IAuthorizationService } from '../../core/interfaces/authorization.interface';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

/**
 * Guard to check if user has required permission
 *
 * Usage with @RequirePermission decorator
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject('IAuthorizationService')
    private readonly authService: IAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permission from metadata
    const requiredPermission = this.reflector.get<string>(
      PERMISSION_KEY,
      context.getHandler(),
    );

    if (!requiredPermission) {
      // No permission requirement, allow access
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Check permission
    const hasPermission = await this.authService.hasPermission({
      userId: user.id,
      permission: requiredPermission,
    });

    if (!hasPermission) {
      throw new ForbiddenException(
        `Permission denied: ${requiredPermission} required`,
      );
    }

    return true;
  }
}
