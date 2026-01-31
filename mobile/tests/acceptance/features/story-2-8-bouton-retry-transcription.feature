# language: fr
@story-2.8 @epic-2
Fonctionnalité: Bouton Retry pour Transcriptions en Échec
  En tant qu'utilisateur de Pensieve
  Je veux un bouton "Retry" visible sur les captures avec transcription échouée
  Afin de pouvoir réessayer manuellement la transcription sans naviguer dans les paramètres

  Contexte: Un utilisateur avec des captures audio
    Étant donné que l'application est ouverte
    Et que l'utilisateur est sur l'écran "Mes Captures"

  # ============================================================================
  # AC1: Display Retry Button on Failed Capture Cards
  # ============================================================================

  @AC1 @retry-button-display
  Scénario: Afficher bouton Retry sur capture en échec
    Étant donné qu'une capture audio a une transcription en statut 'failed'
    Quand l'utilisateur consulte la carte de capture dans la liste
    Alors un bouton "Retry" est affiché sur la carte
    Et le bouton a une icône refresh circulaire
    Et le bouton est de couleur orange (warning-500)
    Et le bouton est clairement actionnable

  @AC1 @retry-button-hidden
  Scénario: Masquer bouton Retry sur capture réussie
    Étant donné qu'une capture audio a une transcription en statut 'ready'
    Quand l'utilisateur consulte la carte de capture dans la liste
    Alors aucun bouton "Retry" n'est affiché
    Et le texte transcrit est visible
    Et un badge vert "Prêt" est affiché

  @AC1 @retry-button-hidden-processing
  Scénario: Masquer bouton Retry pendant transcription
    Étant donné qu'une capture audio a une transcription en statut 'processing'
    Quand l'utilisateur consulte la carte de capture dans la liste
    Alors aucun bouton "Retry" n'est affiché
    Et un spinner de progression est affiché
    Et le texte "En cours..." est visible

  # ============================================================================
  # AC2: Retry Button Triggers Manual Transcription Attempt
  # ============================================================================

  @AC2 @retry-trigger
  Scénario: Déclencher transcription manuelle via bouton Retry
    Étant donné qu'une capture audio a une transcription en statut 'failed'
    Et que le bouton "Retry" est visible
    Quand l'utilisateur appuie sur le bouton "Retry"
    Alors le statut de la capture passe immédiatement à 'processing'
    Et la capture est ajoutée à la TranscriptionQueue
    Et un spinner de progression remplace le bouton "Retry"
    Et un toast "Nouvelle tentative de transcription..." apparaît

  @AC2 @retry-metadata-update
  Scénario: Mettre à jour métadonnées retry lors du retry manuel
    Étant donné qu'une capture a 0 tentatives de retry
    Et que retryWindowStartAt est null
    Quand l'utilisateur appuie sur le bouton "Retry"
    Alors retryCount passe à 1
    Et retryWindowStartAt est défini à l'heure actuelle
    Et lastRetryAt est défini à l'heure actuelle

  # ============================================================================
  # AC3: Rate Limiting - Maximum 3 Retries per 20-Minute Window
  # ============================================================================

  @AC3 @rate-limiting-allowed
  Scénario: Autoriser retry quand moins de 3 tentatives
    Étant donné qu'une capture a 2 tentatives de retry dans les 20 dernières minutes
    Quand l'utilisateur appuie sur le bouton "Retry"
    Alors le retry est autorisé
    Et la transcription démarre
    Et retryCount passe à 3

  @AC3 @rate-limiting-blocked
  Scénario: Bloquer retry quand 3 tentatives atteintes
    Étant donné qu'une capture a 3 tentatives de retry dans les 20 dernières minutes
    Et que la fenêtre de 20 minutes n'est pas expirée
    Quand l'utilisateur appuie sur le bouton "Retry"
    Alors le bouton "Retry" est désactivé (gris)
    Et un message "Limite atteinte. Réessayez dans X minutes" est affiché
    Et le retry n'est PAS déclenché
    Et un toast d'erreur affiche le temps restant

  @AC3 @countdown-display
  Scénario: Afficher countdown quand limite atteinte
    Étant donné qu'une capture a 3 tentatives de retry
    Et que 10 minutes se sont écoulées depuis le premier retry
    Quand l'utilisateur consulte la carte de capture
    Alors le bouton "Retry" est désactivé (gris)
    Et le message "Limite atteinte. 10 min" est affiché sous le bouton
    Et le countdown se met à jour chaque minute

  @AC3 @countdown-singular
  Scénario: Afficher countdown au singulier (1 minute)
    Étant donné qu'une capture a 3 tentatives de retry
    Et que 19 minutes se sont écoulées depuis le premier retry
    Quand l'utilisateur consulte la carte de capture
    Alors le message affiché est "Limite atteinte. 1 minute"

  # ============================================================================
  # AC4: Reset Retry Counter After 20-Minute Window
  # ============================================================================

  @AC4 @window-reset
  Scénario: Réinitialiser compteur après fenêtre de 20 minutes
    Étant donné qu'une capture a 3 tentatives de retry
    Et que 20 minutes ou plus se sont écoulées depuis le premier retry
    Quand l'utilisateur consulte la carte de capture
    Alors le bouton "Retry" est réactivé (orange)
    Et aucun message de countdown n'est affiché
    Et l'utilisateur peut réessayer la transcription

  @AC4 @window-reset-on-retry
  Scénario: Autoriser nouveau retry après expiration fenêtre
    Étant donné qu'une capture a 3 tentatives de retry
    Et que 25 minutes se sont écoulées depuis le premier retry
    Quand l'utilisateur appuie sur le bouton "Retry"
    Alors le retry est autorisé
    Et retryCount est réinitialisé à 1
    Et retryWindowStartAt est redéfini à l'heure actuelle
    Et la transcription démarre

  # ============================================================================
  # AC5: Show Progress Indicator During Retry Transcription
  # ============================================================================

  @AC5 @progress-indicator
  Scénario: Afficher indicateur de progression pendant retry
    Étant donné qu'une capture est en cours de transcription après un retry
    Et que le statut est 'processing'
    Quand l'utilisateur consulte la carte de capture
    Alors un spinner animé est affiché
    Et le texte "En cours..." est visible
    Et le badge "En cours" (bleu) est affiché
    Et le bouton "Retry" n'est PAS visible

  @AC5 @reactive-update
  Scénario: Mise à jour réactive de l'interface
    Étant donné qu'une capture passe de 'failed' à 'processing'
    Quand le statut de la capture change
    Alors l'interface se met à jour automatiquement
    Et le bouton "Retry" disparaît
    Et le spinner de progression apparaît
    Et aucun rafraîchissement manuel n'est nécessaire

  # ============================================================================
  # AC6: Update Card on Retry Success
  # ============================================================================

  @AC6 @success-update
  Scénario: Mettre à jour carte après succès du retry
    Étant donné qu'une transcription retry est en cours
    Quand la transcription se termine avec succès
    Alors le statut de la capture passe à 'ready'
    Et le bouton "Retry" est supprimé
    Et le texte transcrit est affiché
    Et un badge vert "Prêt" est affiché
    Et le champ transcriptionError est null

  @AC6 @success-animation
  Scénario: Afficher animation de succès (optionnel)
    Étant donné qu'une transcription retry se termine avec succès
    Quand la carte se met à jour
    Alors une brève animation de checkmark vert peut apparaître
    Et le badge passe de bleu (processing) à vert (ready) avec transition

  # ============================================================================
  # AC7: Update Card on Retry Failure (Attempts Remaining)
  # ============================================================================

  @AC7 @failure-update-attempts-remaining
  Scénario: Mettre à jour carte après échec du retry (tentatives restantes)
    Étant donné qu'une transcription retry est en cours
    Et que retryCount est 1
    Quand la transcription échoue
    Alors le statut de la capture repasse à 'failed'
    Et le bouton "Retry" réapparaît
    Et retryCount passe à 2
    Et lastRetryAt est mis à jour
    Et le champ transcriptionError contient le nouveau message d'erreur

  @AC7 @failure-update-limit-reached
  Scénario: Mettre à jour carte après échec du retry (limite atteinte)
    Étant donné qu'une transcription retry est en cours
    Et que retryCount est 3
    Quand la transcription échoue
    Alors le statut de la capture repasse à 'failed'
    Et le bouton "Retry" est désactivé (gris)
    Et le message "Limite atteinte. Réessayez dans X minutes" est affiché
    Et retryCount reste à 3

  @AC7 @preserve-retry-window
  Scénario: Préserver fenêtre de retry après échec
    Étant donné qu'une capture a retryWindowStartAt défini il y a 10 minutes
    Et que retryCount est 2
    Quand la transcription échoue
    Alors retryWindowStartAt reste inchangé (même timestamp)
    Et lastRetryAt est mis à jour à l'heure actuelle
    Et retryCount passe à 3

  # ============================================================================
  # AC8: Debug Mode - Show Detailed Error Messages
  # ============================================================================

  @AC8 @debug-mode-enabled
  Scénario: Afficher message d'erreur détaillé en mode debug
    Étant donné que le mode debug est activé dans les paramètres
    Et qu'une capture a une transcription en échec
    Et que transcriptionError contient "Whisper error: audio format not supported"
    Quand l'utilisateur consulte la carte de capture
    Alors le message d'erreur détaillé "Whisper error: audio format not supported" est affiché
    Et le texte est en rouge (text-status-error)
    Et le texte est en petite taille (text-sm)
    Et le texte est en italique

  @AC8 @debug-mode-disabled
  Scénario: Afficher message d'erreur générique en mode normal
    Étant donné que le mode debug est désactivé dans les paramètres
    Et qu'une capture a une transcription en échec
    Et que transcriptionError contient "Whisper error: timeout"
    Quand l'utilisateur consulte la carte de capture
    Alors le message générique "La transcription a échoué" est affiché
    Et le message d'erreur technique N'est PAS visible

  @AC8 @debug-toggle
  Scénario: Basculer affichage d'erreur avec debug mode
    Étant donné qu'une capture en échec est affichée
    Et que le mode debug est désactivé
    Et que le message générique est affiché
    Quand l'utilisateur active le mode debug dans les paramètres
    Et retourne à la liste des captures
    Alors le message d'erreur détaillé devient visible
    Et le message contient les détails techniques de l'erreur

  # ============================================================================
  # AC9: Persist Retry Attempts and Timestamps Across App Restarts
  # ============================================================================

  @AC9 @persistence-retry-count
  Scénario: Persister retryCount après redémarrage
    Étant donné qu'une capture a retryCount = 2
    Et que retryWindowStartAt est défini
    Quand l'utilisateur ferme et rouvre l'application
    Alors retryCount est toujours 2
    Et la valeur est récupérée depuis OP-SQLite

  @AC9 @persistence-window
  Scénario: Persister fenêtre de retry après redémarrage
    Étant donné qu'une capture a retryCount = 3
    Et que retryWindowStartAt est défini il y a 15 minutes
    Quand l'utilisateur ferme et rouvre l'application
    Alors le bouton "Retry" est toujours désactivé
    Et le countdown affiche "Limite atteinte. 5 min"
    Et le countdown continue correctement

  @AC9 @persistence-window-expired
  Scénario: Fenêtre expirée après redémarrage
    Étant donné qu'une capture a retryCount = 3
    Et que retryWindowStartAt est défini il y a 25 minutes
    Quand l'utilisateur ferme et rouvre l'application
    Alors le bouton "Retry" est réactivé (orange)
    Et aucun countdown n'est affiché
    Et l'utilisateur peut réessayer la transcription

  @AC9 @persistence-error-message
  Scénario: Persister message d'erreur après redémarrage
    Étant donné qu'une capture a transcriptionError = "Whisper error: model not found"
    Et que le mode debug est activé
    Quand l'utilisateur ferme et rouvre l'application
    Alors le message d'erreur "Whisper error: model not found" est toujours affiché
    Et la valeur est récupérée depuis OP-SQLite
