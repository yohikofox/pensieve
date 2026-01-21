# language: fr
@story-2.3 @epic-2
Fonctionnalité: Annuler Capture Audio en Cours
  En tant qu'utilisateur de Pensieve
  Je veux pouvoir annuler un enregistrement en cours
  Afin de rejeter les captures non désirées sans polluer mon historique

  # ============================================================================
  # AC1: Cancel Button → Arrêt Immédiat et Nettoyage
  # ============================================================================

  @AC1 @cancel-button
  Scénario: Annuler enregistrement avec bouton cancel
    Étant donné que l'utilisateur "user-123" enregistre de l'audio
    Quand l'utilisateur tape sur le bouton annuler
    Alors l'enregistrement s'arrête immédiatement
    Et le fichier audio est supprimé du stockage
    Et l'entité Capture est supprimée de la base
    Et l'utilisateur revient à l'écran principal

  @AC1 @file-deletion
  Scénario: Vérifier suppression complète du fichier audio
    Étant donné que l'utilisateur enregistre de l'audio depuis 5 secondes
    Et un fichier audio existe dans le stockage
    Quand l'utilisateur annule l'enregistrement
    Alors le fichier audio est complètement supprimé
    Et aucun fichier orphelin ne reste dans MockFileSystem

  @AC1 @database-cleanup
  Scénario: Vérifier suppression de l'entité Capture
    Étant donné que l'utilisateur enregistre de l'audio
    Et une entité Capture existe avec state "RECORDING"
    Quand l'utilisateur annule l'enregistrement
    Alors l'entité Capture est supprimée de WatermelonDB
    Et le count des Captures est 0

  @AC1 @navigation
  Scénario: Retour à l'écran principal après annulation
    Étant donné que l'utilisateur est sur l'écran d'enregistrement
    Quand l'utilisateur annule l'enregistrement
    Alors l'utilisateur est redirigé vers l'écran principal
    Et l'écran principal est prêt pour une nouvelle capture

  # ============================================================================
  # AC2: Swipe Cancel Gesture → Confirmation Prompt
  # ============================================================================

  @AC2 @swipe-gesture
  Scénario: Swipe cancel déclenche un dialog de confirmation
    Étant donné que l'utilisateur enregistre de l'audio
    Quand l'utilisateur fait un swipe cancel
    Alors un dialog de confirmation s'affiche
    Et le message est "Discard this recording?"
    Et les options "Discard" et "Keep Recording" sont disponibles

  @AC2 @dialog-content
  Scénario: Dialog affiche le bon message et options
    Étant donné que l'utilisateur enregistre de l'audio depuis 10 secondes
    Quand l'utilisateur fait un swipe down
    Alors le dialog s'affiche avec le titre "Discard this recording?"
    Et le bouton "Discard" est visible avec data-testid="cancel-dialog-discard-button"
    Et le bouton "Keep Recording" est visible avec data-testid="cancel-dialog-keep-button"

  @AC2 @confirm-discard
  Scénario: Confirmer 'Discard' annule l'enregistrement
    Étant donné que l'utilisateur enregistre de l'audio
    Et l'utilisateur fait un swipe cancel
    Et le dialog de confirmation s'affiche
    Quand l'utilisateur sélectionne "Discard"
    Alors l'enregistrement est annulé (comme cancel button)
    Et le fichier audio est supprimé
    Et l'entité Capture est supprimée

  @AC2 @keep-recording
  Scénario: Choisir 'Keep Recording' continue l'enregistrement
    Étant donné que l'utilisateur enregistre de l'audio depuis 7 secondes
    Et l'utilisateur fait un swipe cancel
    Et le dialog de confirmation s'affiche
    Quand l'utilisateur sélectionne "Keep Recording"
    Alors le dialog se ferme
    Et l'enregistrement continue
    Et la durée enregistrée est préservée (7000ms)

  @AC2 @swipe-patterns
  Plan du scénario: Tester différents patterns de swipe
    Étant donné que l'utilisateur enregistre de l'audio
    Quand l'utilisateur fait un swipe "<pattern>"
    Alors le dialog de confirmation s'affiche

    Exemples:
      | pattern         |
      | swipe down      |
      | swipe diagonal  |
      | quick swipe     |

  # ============================================================================
  # AC3: Haptic Feedback + Animation de Rejet
  # ============================================================================

  @AC3 @haptics @UX
  Scénario: Déclencher haptic feedback lors de l'annulation
    Quand l'utilisateur annule un enregistrement
    Alors un feedback haptique de type "medium" est déclenché
    Et le feedback est confirmé par MockHaptics

  @AC3 @animation
  Scénario: Afficher animation de rejet
    Quand l'utilisateur annule un enregistrement
    Alors une animation de rejet s'affiche
    Et l'animation montre la capture "disparaître"
    Et l'animation utilise fade-out et slide-down

  @AC3 @performance
  Scénario: Animation durée < 500ms
    Quand l'utilisateur annule un enregistrement
    Alors l'animation de rejet démarre immédiatement
    Et l'animation se termine en moins de 500ms
    Et l'écran principal est affiché après l'animation

  # ============================================================================
  # AC4: Protection Contre Annulation Accidentelle
  # ============================================================================

  @AC4 @confirmation
  Scénario: Afficher confirmation pour prévenir annulation accidentelle
    Étant donné que l'utilisateur enregistre de l'audio
    Quand l'utilisateur tape sur le bouton cancel
    Alors un dialog de confirmation s'affiche TOUJOURS
    Et le message prévient de la perte de données
    Et l'annulation n'est PAS silencieuse

  @AC4 @data-preservation
  Scénario: Continuer l'enregistrement sans perte de données
    Étant donné que l'utilisateur enregistre de l'audio depuis 12 secondes
    Et l'utilisateur tape sur cancel (accidentellement)
    Et le dialog de confirmation apparaît
    Quand l'utilisateur choisit "Keep Recording"
    Alors l'enregistrement continue
    Et la durée est toujours 12000ms (préservée)
    Et aucune donnée n'est perdue

  @AC4 @file-protection
  Scénario: Vérifier que les fichiers ne sont pas supprimés si annulé
    Étant donné que l'utilisateur enregistre de l'audio
    Et un fichier audio "recording-123.m4a" existe
    Et l'utilisateur tape sur cancel
    Quand l'utilisateur choisit "Keep Recording" dans le dialog
    Alors le fichier "recording-123.m4a" existe toujours
    Et l'entité Capture existe toujours avec state "RECORDING"

  @AC4 @double-tap-protection
  Scénario: Double confirmation pour annulation rapide
    Étant donné que l'utilisateur enregistre de l'audio
    Quand l'utilisateur tape rapidement 2 fois sur cancel
    Alors un seul dialog de confirmation s'affiche
    Et le second tap ne bypass pas la confirmation
    Et l'enregistrement n'est pas annulé automatiquement

  # ============================================================================
  # AC5: Fonctionnement Offline Identique (FR4 compliance)
  # ============================================================================

  @AC5 @offline @NFR4 @NFR7
  Scénario: Annuler en mode offline fonctionne identiquement
    Étant donné que l'appareil est hors ligne
    Et l'utilisateur enregistre de l'audio
    Quand l'utilisateur annule l'enregistrement
    Alors l'annulation fonctionne de manière identique au mode en ligne
    Et aucune tentative de connexion réseau n'est faite

  @AC5 @orphan-files
  Scénario: Aucun fichier orphelin après annulation offline
    Étant donné que l'appareil est hors ligne
    Et l'utilisateur enregistre de l'audio
    Et un fichier "offline-recording.m4a" est créé
    Quand l'utilisateur annule l'enregistrement
    Alors le fichier "offline-recording.m4a" est supprimé
    Et MockFileSystem.getFiles().length === 0

  @AC5 @network-errors
  Scénario: Aucune erreur réseau levée
    Étant donné que l'appareil est hors ligne
    Quand l'utilisateur annule un enregistrement
    Alors aucune exception réseau n'est levée
    Et aucun message d'erreur réseau n'est affiché
    Et l'utilisateur ne voit aucune indication d'échec réseau

  @AC5 @sync-queue
  Scénario: Vérifier queue de sync après annulation offline
    Étant donné que l'appareil est hors ligne
    Et l'utilisateur enregistre de l'audio
    Et une Capture avec syncStatus "pending" est créée
    Quand l'utilisateur annule l'enregistrement
    Alors la Capture est supprimée de la base
    Et aucune Capture avec syncStatus "pending" n'existe
    Et la queue de synchronisation ne contient pas cette capture

  # ============================================================================
  # Edge Cases & Bug Prevention
  # ============================================================================

  @edge-case @rapid-cancel
  Scénario: Annulation immédiate après démarrage
    Étant donné que l'utilisateur démarre un enregistrement
    Quand l'utilisateur annule en moins de 100ms
    Alors l'annulation fonctionne correctement
    Et aucun fichier n'est créé
    Et aucune entité Capture ne reste

  @edge-case @multiple-cancel
  Scénario: Plusieurs annulations rapides consécutives
    Étant donné que l'utilisateur enregistre de l'audio
    Quand l'utilisateur annule l'enregistrement
    Et l'utilisateur annule à nouveau (alors que le premier cancel est en cours)
    Alors une seule annulation est traitée
    Et aucune erreur de double-suppression n'est levée

  @edge-case @cancel-during-save
  Scénario: Gérer annulation pendant sauvegarde
    Étant donné que l'utilisateur enregistre de l'audio
    Et l'utilisateur arrête l'enregistrement normalement
    Et la sauvegarde est en cours
    Quand l'utilisateur tente d'annuler pendant la sauvegarde
    Alors l'annulation est ignorée (déjà en train de sauvegarder)
    Et la Capture est sauvegardée normalement
