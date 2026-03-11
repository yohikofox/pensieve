import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Inject,
  Optional,
} from '@nestjs/common';
import { auth, type AuthApiType } from '../../../../auth/auth.config';

/**
 * AdminGuard — protège les routes du backoffice admin.
 *
 * Valide la session Better Auth (même logique que BetterAuthGuard)
 * et vérifie que l'utilisateur a le rôle 'admin'.
 *
 * Auto-suffisant : n'injecte pas BetterAuthGuard pour éviter les problèmes
 * de résolution de dépendances entre modules (AuthorizationModule, etc.).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly authApi: AuthApiType;

  constructor(@Optional() @Inject('AUTH_API') authApiOverride?: AuthApiType) {
    this.authApi = authApiOverride ?? auth.api;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      user: { id: string; email: string; role: string } | null;
    }>();

    const session = await this.authApi.getSession({
      headers: new Headers(request.headers),
    });

    if (!session) {
      throw new UnauthorizedException('Session invalide ou absente');
    }

    const role =
      (session.user as { id: string; email: string; role?: string }).role ??
      'user';

    if (role !== 'admin') {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      role,
    };

    return true;
  }
}
