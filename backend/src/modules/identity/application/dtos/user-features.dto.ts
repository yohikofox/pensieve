/**
 * DTO pour les feature flags d'un utilisateur
 * Story 24.1: Feature Flag System — Migration vers Record<string, boolean>
 *
 * Retourne toutes les features connues du système avec leur valeur résolue.
 * La résolution applique l'algorithme deny-wins (FeatureResolutionService).
 *
 * Exemple de réponse :
 * {
 *   "debug_mode": false,
 *   "data_mining": false,
 *   "news_tab": true,
 *   "projects_tab": false,
 *   "capture_media_buttons": false
 * }
 */
export type UserFeaturesDto = Record<string, boolean>;
