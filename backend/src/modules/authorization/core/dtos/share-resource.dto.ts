import { ShareRole } from '../enums/share-role.enum';
import { ResourceType } from '../enums/resource-type.enum';

/**
 * Paramètres pour partager une ressource avec un autre utilisateur
 */
export interface ShareResourceParams {
  /**
   * Type de la ressource à partager
   */
  resourceType: ResourceType;

  /**
   * ID de la ressource à partager
   */
  resourceId: string;

  /**
   * ID du propriétaire de la ressource
   */
  ownerId: string;

  /**
   * ID de l'utilisateur avec qui partager
   */
  sharedWithId: string;

  /**
   * Rôle de partage (viewer, contributor, admin)
   */
  shareRole: ShareRole;

  /**
   * Date d'expiration du partage (optionnel)
   */
  expiresAt?: Date;
}
