import { PermissionCheckParams } from '../dtos/permission-check.dto';
import { ShareResourceParams } from '../dtos/share-resource.dto';
import { ResourceType } from '../enums/resource-type.enum';

/**
 * Interface principale du système d'autorisation
 *
 * Cette interface définit le contrat que toute implémentation d'autorisation
 * doit respecter. Elle permet de découpler le code métier de l'implémentation
 * concrète (PostgreSQL, Supabase RLS, Auth0, etc.)
 *
 * @example
 * // Dans un contrôleur
 * constructor(
 *   @Inject('IAuthorizationService')
 *   private readonly authService: IAuthorizationService
 * ) {}
 *
 * async myEndpoint(userId: string, thoughtId: string) {
 *   const canRead = await this.authService.hasPermission({
 *     userId,
 *     permission: 'thought.read',
 *     resourceId: thoughtId,
 *     resourceType: ResourceType.THOUGHT,
 *   });
 *
 *   if (!canRead) {
 *     throw new ForbiddenException();
 *   }
 * }
 */
export interface IAuthorizationService {
  /**
   * Vérifie si un utilisateur a une permission
   *
   * Ordre de résolution :
   * 1. User override (priorité max)
   * 2. Resource share (si resourceId fourni)
   * 3. Subscription tier (si permission payante)
   * 4. Role-based (permissions par défaut)
   *
   * @param params - Paramètres de vérification
   * @returns true si l'utilisateur a la permission, false sinon
   *
   * @example
   * const canRead = await authService.hasPermission({
   *   userId: 'user-123',
   *   permission: 'thought.read',
   * });
   *
   * @example
   * const canReadSpecific = await authService.hasPermission({
   *   userId: 'user-123',
   *   permission: 'thought.read',
   *   resourceId: 'thought-456',
   *   resourceType: ResourceType.THOUGHT,
   * });
   */
  hasPermission(params: PermissionCheckParams): Promise<boolean>;

  /**
   * Récupère toutes les permissions d'un utilisateur
   *
   * Retourne la liste complète des permissions accordées à un utilisateur,
   * incluant les permissions de rôles, de subscription et les overrides.
   *
   * @param userId - ID de l'utilisateur
   * @returns Liste des noms de permissions (ex: ["thought.read", "thought.create"])
   *
   * @example
   * const permissions = await authService.getUserPermissions('user-123');
   * // ["thought.read", "thought.create", "thought.update", "idea.read"]
   */
  getUserPermissions(userId: string): Promise<string[]>;

  /**
   * Vérifie si un utilisateur est propriétaire d'une ressource
   *
   * @param userId - ID de l'utilisateur
   * @param resourceType - Type de la ressource
   * @param resourceId - ID de la ressource
   * @returns true si l'utilisateur est propriétaire, false sinon
   *
   * @example
   * const isOwner = await authService.isResourceOwner(
   *   'user-123',
   *   ResourceType.THOUGHT,
   *   'thought-456'
   * );
   */
  isResourceOwner(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<boolean>;

  /**
   * Partage une ressource avec un autre utilisateur
   *
   * Crée un partage de ressource avec un rôle spécifique.
   * Le partage peut avoir une date d'expiration optionnelle.
   *
   * @param params - Paramètres du partage
   * @throws NotFoundException si la ressource n'existe pas
   * @throws ForbiddenException si l'utilisateur n'est pas propriétaire
   *
   * @example
   * await authService.shareResource({
   *   resourceType: ResourceType.THOUGHT,
   *   resourceId: 'thought-456',
   *   ownerId: 'user-123',
   *   sharedWithId: 'user-789',
   *   shareRole: ShareRole.VIEWER,
   * });
   */
  shareResource(params: ShareResourceParams): Promise<void>;

  /**
   * Révoque un partage de ressource
   *
   * @param shareId - ID du partage à révoquer
   * @throws NotFoundException si le partage n'existe pas
   * @throws ForbiddenException si l'utilisateur n'est pas propriétaire
   *
   * @example
   * await authService.revokeShare('share-123');
   */
  revokeShare(shareId: string): Promise<void>;
}
