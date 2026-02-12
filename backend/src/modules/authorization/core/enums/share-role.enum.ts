/**
 * Rôles de partage disponibles pour les ressources partagées
 */
export enum ShareRole {
  /**
   * Lecture seule
   */
  VIEWER = 'viewer',

  /**
   * Lecture et modification
   */
  CONTRIBUTOR = 'contributor',

  /**
   * Toutes les permissions (lecture, modification, suppression, partage)
   */
  ADMIN = 'admin',
}
