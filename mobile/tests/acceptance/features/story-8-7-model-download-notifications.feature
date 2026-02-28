# language: fr
@story-8.7 @epic-8
Fonctionnalité: Téléchargement de Modèles en Arrière-Plan avec Notifications
  En tant qu'utilisateur de Pensieve
  Je veux que les modèles IA se téléchargent en arrière-plan
  Afin d'être notifié quand c'est terminé, même si j'ai quitté l'écran de téléchargement

  # ============================================================================
  # AC1 & AC5: Notification de progression (Android uniquement, 10 % debounce)
  # ============================================================================

  @AC1 @AC5 @android-only
  Scénario: Envoyer une notification de progression tous les 10 % sur Android
    Étant donné l'application tourne sur Android
    Et un téléchargement de modèle est en cours
    Quand la progression passe de 0 % à 10 %
    Alors une notification de progression est envoyée avec "10%"
    Et une progression de 15 % ne déclenche pas de nouvelle notification
    Et une progression de 20 % déclenche une nouvelle notification avec "20%"

  @AC1 @ios-skip
  Scénario: Ne pas envoyer de notification de progression sur iOS
    Étant donné l'application tourne sur iOS
    Et un téléchargement de modèle est en cours
    Quand la progression est mise à jour à 50 %
    Alors aucune notification de progression n'est envoyée

  # ============================================================================
  # AC2: Permission de notification avant téléchargement
  # ============================================================================

  @AC2 @permissions
  Scénario: Demander la permission avant les notifications si non accordée
    Étant donné la permission de notification n'a pas encore été accordée
    Quand le service de notification est initialisé
    Alors la permission de notification est demandée à l'utilisateur

  @AC2 @permissions-already-granted
  Scénario: Ne pas redemander la permission si déjà accordée
    Étant donné la permission de notification est déjà accordée
    Quand le service de notification est initialisé
    Alors la permission de notification n'est pas demandée à nouveau
    Et la méthode retourne true

  # ============================================================================
  # AC3: Notification de succès après téléchargement
  # ============================================================================

  @AC3 @success-notification
  Scénario: Notifier l'utilisateur quand un modèle LLM est téléchargé
    Étant donné un modèle LLM est en cours de téléchargement
    Quand le téléchargement se termine avec succès
    Alors une notification "Modèle téléchargé" est envoyée
    Et la notification contient le nom du modèle
    Et la notification permet de naviguer vers l'écran LLM

  @AC3 @success-notification-whisper
  Scénario: Notifier l'utilisateur quand un modèle Whisper est téléchargé
    Étant donné un modèle Whisper est en cours de téléchargement
    Quand le téléchargement se termine avec succès
    Alors une notification "Modèle téléchargé" est envoyée
    Et la notification permet de naviguer vers l'écran Whisper

  # ============================================================================
  # AC4: Notification d'erreur en cas d'échec
  # ============================================================================

  @AC4 @error-notification
  Scénario: Notifier l'utilisateur en cas d'échec de téléchargement
    Étant donné un modèle est en cours de téléchargement
    Quand le téléchargement échoue avec une erreur réseau
    Alors une notification "Échec du téléchargement" est envoyée
    Et la notification invite à réessayer

  # ============================================================================
  # AC6: Suppression de la notification de progression après fin
  # ============================================================================

  @AC6 @dismiss-progress
  Scénario: Supprimer la notification de progression après le succès
    Étant donné une notification de progression est affichée
    Quand le téléchargement se termine
    Alors la notification de progression est supprimée
    Et la notification de succès s'affiche à la place
