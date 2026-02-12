import { ResourceType } from '../enums/resource-type.enum';

/**
 * Interface pour le contrôle d'accès aux ressources partagées (ACL)
 *
 * Cette interface gère la logique de partage de ressources entre utilisateurs.
 */
export interface IResourceAccessControl {
  /**
   * Vérifie si un utilisateur a accès à une ressource via un partage
   *
   * Query : resource_shares → share_role_permissions
   *
   * Vérifie également que le partage n'est pas expiré (expires_at).
   *
   * @param userId - ID de l'utilisateur
   * @param resourceType - Type de la ressource
   * @param resourceId - ID de la ressource
   * @param requiredPermission - Permission requise (ex: "thought.read")
   * @returns true si l'utilisateur a accès via un partage actif
   *
   * @example
   * const hasAccess = await accessControl.hasShareAccess(
   *   'user-123',
   *   ResourceType.THOUGHT,
   *   'thought-456',
   *   'thought.read'
   * );
   */
  hasShareAccess(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    requiredPermission: string,
  ): Promise<boolean>;

  /**
   * Récupère la liste des ressources partagées avec un utilisateur
   *
   * @param userId - ID de l'utilisateur
   * @param resourceType - Type de ressource
   * @returns Liste des IDs de ressources partagées
   *
   * @example
   * const sharedThoughts = await accessControl.getSharedResources(
   *   'user-123',
   *   ResourceType.THOUGHT
   * );
   * // ['thought-456', 'thought-789']
   */
  getSharedResources(
    userId: string,
    resourceType: ResourceType,
  ): Promise<string[]>;
}
