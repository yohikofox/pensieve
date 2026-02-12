import { ResourceType } from '../enums/resource-type.enum';

/**
 * Paramètres pour vérifier une permission
 */
export interface PermissionCheckParams {
  /**
   * ID de l'utilisateur qui demande la permission
   */
  userId: string;

  /**
   * Nom de la permission à vérifier (ex: "thought.read")
   */
  permission: string;

  /**
   * ID de la ressource concernée (optionnel)
   * Requis si on vérifie l'accès à une ressource spécifique
   */
  resourceId?: string;

  /**
   * Type de la ressource (optionnel)
   * Requis si resourceId est fourni
   */
  resourceType?: ResourceType;
}
