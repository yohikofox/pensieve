import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  Optional,
} from '@nestjs/common';
import { auth, type AuthApiType } from '../auth.config';

/**
 * BetterAuthGuard — ADR-029: Replaces SupabaseAuthGuard
 *
 * Validates Better Auth session tokens on incoming HTTP requests.
 * Populates request.user with { id, email, role } on success.
 *
 * Guard = boundary: throws UnauthorizedException (exceptions OK per ADR-023).
 * Does NOT return Result<T> — guards are HTTP boundaries, not application services.
 */
@Injectable()
export class BetterAuthGuard implements CanActivate {
  private readonly authApi: AuthApiType;

  constructor(@Optional() @Inject('AUTH_API') authApiOverride?: AuthApiType) {
    // Allow injecting mock auth API for testing
    this.authApi = authApiOverride ?? auth.api;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      user: { id: string; email: string; role: string } | null;
    }>();

    const session = await this.authApi.getSession({
      headers: new Headers(request.headers as Record<string, string>),
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or missing session');
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      role: (session.user as { id: string; email: string; role?: string }).role ?? 'user',
    };

    return true;
  }
}
