/**
 * Interface pour les vérifications de permissions à différents niveaux
 *
 * Cette interface est utilisée en interne par IAuthorizationService
 * pour effectuer les checks de permissions selon différentes sources.
 */
export interface IPermissionChecker {
  /**
   * Vérifie si un utilisateur a une permission via ses rôles
   *
   * Query : user_roles → role_permissions
   *
   * @param userId - ID de l'utilisateur
   * @param permissionId - ID de la permission
   * @returns true si l'utilisateur a la permission via un rôle
   */
  checkRolePermission(userId: string, permissionId: string): Promise<boolean>;

  /**
   * Vérifie si un utilisateur a une permission via sa subscription
   *
   * Query : user_subscriptions → tier_permissions
   *
   * @param userId - ID de l'utilisateur
   * @param permissionId - ID de la permission
   * @returns true si la subscription active de l'utilisateur inclut cette permission
   */
  checkSubscriptionPermission(
    userId: string,
    permissionId: string,
  ): Promise<boolean>;

  /**
   * Vérifie si un utilisateur a un override manuel pour une permission
   *
   * Query : user_permissions
   *
   * @param userId - ID de l'utilisateur
   * @param permissionId - ID de la permission
   * @returns true si override granted, false si override denied, null si pas d'override
   */
  checkUserOverride(
    userId: string,
    permissionId: string,
  ): Promise<boolean | null>;
}
