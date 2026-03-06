/**
 * Feature Flag Keys — Constantes capacités produit
 * Story 24.3: Feature Flag System — Adaptation Mobile & UI Gating
 * Story 8.22: Refactoring orientation fonctionnalité (remplace flags orientés composant)
 *
 * Centralized constants for all feature flag keys.
 * Use these when reading from settingsStore.getFeature(key).
 *
 * Keys must match the string values returned by the backend
 * (POST /api/users/:userId/features → Record<string, boolean>).
 *
 * Convention de nommage : <capacité_produit> (pas <composant_ui>)
 * ✅ Bon : 'url_capture', 'projects', 'news'
 * ❌ Mauvais : 'capture_media_buttons', 'news_tab', 'projects_tab'
 *
 * Le nom d'un feature flag doit répondre à la question :
 * "Quelle capacité l'utilisateur acquiert-il ?"
 */
export const FEATURE_KEYS = {
  // Capacités produit — nommage fonctionnel
  DEBUG_MODE:         'debug_mode',         // ✅ inchangé
  DATA_MINING:        'data_mining',         // ✅ inchangé
  LIVE_TRANSCRIPTION: 'live_transcription',  // ✅ Story 8.21

  NEWS:               'news',               // remplace NEWS_TAB
  PROJECTS:           'projects',           // remplace PROJECTS_TAB
  URL_CAPTURE:        'url_capture',        // remplace part of CAPTURE_MEDIA_BUTTONS
  PHOTO_CAPTURE:      'photo_capture',      // remplace part of CAPTURE_MEDIA_BUTTONS
  DOCUMENT_CAPTURE:   'document_capture',   // remplace part of CAPTURE_MEDIA_BUTTONS
  CLIPBOARD_CAPTURE:  'clipboard_capture',  // remplace part of CAPTURE_MEDIA_BUTTONS

  // @deprecated — à supprimer après vérification en production (Story 8.22)
  /** @deprecated Utiliser NEWS à la place */
  NEWS_TAB:               'news_tab',
  /** @deprecated Utiliser PROJECTS à la place */
  PROJECTS_TAB:           'projects_tab',
  /** @deprecated Utiliser URL_CAPTURE, PHOTO_CAPTURE, DOCUMENT_CAPTURE, CLIPBOARD_CAPTURE */
  CAPTURE_MEDIA_BUTTONS:  'capture_media_buttons',
} as const;

export type FeatureKey = typeof FEATURE_KEYS[keyof typeof FEATURE_KEYS];
