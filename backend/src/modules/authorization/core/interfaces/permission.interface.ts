import { ResourceType } from '../enums/resource-type.enum';
import { PermissionAction } from '../enums/permission-action.enum';

/**
 * Représentation d'une permission dans le système
 */
export interface IPermission {
  /**
   * ID unique de la permission
   */
  id: string;

  /**
   * Nom de la permission (ex: "thought.read")
   * Format: "{resourceType}.{action}"
   */
  name: string;

  /**
   * Nom d'affichage de la permission
   */
  displayName: string;

  /**
   * Type de ressource concernée
   */
  resourceType: ResourceType;

  /**
   * Action effectuée
   */
  action: PermissionAction;

  /**
   * Indique si cette permission est une feature payante
   * Si true, nécessite une subscription active avec cette permission
   */
  isPaidFeature: boolean;

  /**
   * Date de création
   */
  createdAt: Date;

  /**
   * Date de dernière modification
   */
  updatedAt: Date;
}
