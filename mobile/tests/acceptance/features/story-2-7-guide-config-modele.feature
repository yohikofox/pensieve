# language: fr
Fonctionnalité: Guide Configuration Modèle Whisper
  En tant qu'utilisateur
  Je veux être guidé vers la configuration du modèle Whisper
  Afin de pouvoir transcrire mes captures audio

  Contexte:
    Étant donné que je suis un utilisateur authentifié
    Et que l'application est lancée

  # ============================================================================
  # AC1-2: Check proactif + Modal prompt avant capture
  # ============================================================================

  Scénario: L'utilisateur tente de capturer sans modèle disponible
    Étant donné qu'aucun modèle Whisper n'est téléchargé
    Quand je navigue vers l'écran de capture
    Et que je tape sur le bouton de capture vocale
    Alors je vois le modal "Modèle de transcription requis"
    Et je vois le message "Download a Whisper model to enable audio transcription"
    Et je vois le bouton "Go to Settings"
    Et je vois le bouton "Continue without transcription"

  Scénario: L'utilisateur navigue vers Settings depuis le modal
    Étant donné qu'aucun modèle Whisper n'est téléchargé
    Et que je vois le modal "Modèle de transcription requis"
    Quand je tape sur "Go to Settings"
    Alors le modal se ferme
    Et je suis redirigé vers l'écran WhisperSettings
    Et je vois la liste des modèles Whisper disponibles

  Scénario: L'utilisateur continue la capture sans modèle
    Étant donné qu'aucun modèle Whisper n'est téléchargé
    Et que je vois le modal "Modèle de transcription requis"
    Quand je tape sur "Continue without transcription"
    Alors le modal se ferme
    Et l'enregistrement audio commence
    Et je vois l'interface d'enregistrement
    Et je peux arrêter l'enregistrement
    Et la capture est sauvegardée avec state="captured"
    Et la capture n'a pas de normalizedText

  Scénario: L'utilisateur capture avec modèle disponible
    Étant donné que le modèle "tiny" est téléchargé
    Quand je navigue vers l'écran de capture
    Et que je tape sur le bouton de capture vocale
    Alors le modal "Modèle de transcription requis" ne s'affiche PAS
    Et l'enregistrement audio commence immédiatement

  # ============================================================================
  # AC4-5: Message + Bouton dans CaptureDetailView
  # ============================================================================

  Scénario: L'utilisateur ouvre une capture sans modèle disponible
    Étant donné qu'aucun modèle Whisper n'est téléchargé
    Et qu'une capture audio existe avec state="captured" et normalizedText=null
    Quand je navigue vers le détail de cette capture
    Alors je vois le badge "Modèle de transcription requis"
    Et je vois le bouton "Télécharger un modèle"
    Et le badge est de couleur rouge/error

  Scénario: L'utilisateur clique sur le bouton Configure Model
    Étant donné qu'aucun modèle Whisper n'est téléchargé
    Et que je vois le badge "Modèle de transcription requis"
    Et que je vois le bouton "Télécharger un modèle"
    Quand je tape sur "Télécharger un modèle"
    Alors je suis redirigé vers l'écran WhisperSettings
    Et je vois la liste des modèles Whisper disponibles

  Scénario: L'utilisateur voit le status normal quand modèle disponible
    Étant donné que le modèle "tiny" est téléchargé
    Et qu'une capture audio existe avec state="captured" et normalizedText=null
    Quand je navigue vers le détail de cette capture
    Alors je vois le badge "En attente de transcription"
    Et je NE vois PAS le badge "Modèle de transcription requis"
    Et je NE vois PAS le bouton "Télécharger un modèle"

  # ============================================================================
  # AC6: Auto-resume transcription quand modèle disponible
  # ============================================================================

  Scénario: Le système reprend automatiquement les transcriptions en attente
    Étant donné qu'aucun modèle Whisper n'est téléchargé
    Et que 3 captures audio existent avec state="captured" et normalizedText=null
    Quand je télécharge le modèle "tiny"
    Et que le téléchargement se termine avec succès
    Et que la vérification du checksum passe
    Alors le système détecte les 3 captures en attente
    Et les 3 captures sont ajoutées à la TranscriptionQueue automatiquement
    Et je vois un log "AC6: Auto-resumed 3/3 capture(s)"

  Scénario: Auto-resume ignore les captures déjà transcrites
    Étant donné qu'aucun modèle Whisper n'est téléchargé
    Et que 2 captures audio existent avec state="captured" et normalizedText=null
    Et que 1 capture audio existe avec state="ready" et normalizedText="texte"
    Quand je télécharge le modèle "base"
    Et que le téléchargement se termine avec succès
    Alors le système détecte 2 captures en attente
    Et seulement 2 captures sont ajoutées à la queue
    Et la capture déjà transcrite est ignorée

  Scénario: Auto-resume ignore les captures texte
    Étant donné qu'aucun modèle Whisper n'est téléchargé
    Et que 1 capture audio existe avec state="captured" et normalizedText=null
    Et que 2 captures texte existent
    Quand je télécharge le modèle "tiny"
    Et que le téléchargement se termine avec succès
    Alors le système détecte 1 capture en attente
    Et seulement 1 capture est ajoutée à la queue
    Et les captures texte sont ignorées

  # ============================================================================
  # AC7: Badge "Pending model" dans la liste
  # ============================================================================

  Scénario: L'utilisateur voit le badge "Modèle requis" dans la liste
    Étant donné qu'aucun modèle Whisper n'est téléchargé
    Et que 2 captures audio existent avec state="captured" et normalizedText=null
    Quand je navigue vers l'écran CapturesList
    Alors je vois 2 captures avec le badge "Modèle requis"
    Et le badge est de couleur rouge/error
    Et le badge a l'icône "alert-circle"

  Scénario: Le badge change quand modèle devient disponible
    Étant donné qu'aucun modèle Whisper n'est téléchargé
    Et que 1 capture audio existe avec state="captured" et normalizedText=null
    Et que je suis sur l'écran CapturesList
    Et que je vois le badge "Modèle requis"
    Quand je navigue vers WhisperSettings
    Et que je télécharge le modèle "tiny"
    Et que je retourne vers CapturesList
    Alors le badge change pour "En attente de transcription"
    Et le badge est de couleur warning/jaune
    Et le badge a l'icône "clock"

  Scénario: Les captures avec transcription n'ont pas le badge "Modèle requis"
    Étant donné qu'aucun modèle Whisper n'est téléchargé
    Et que 1 capture audio existe avec state="ready" et normalizedText="Bonjour"
    Quand je navigue vers l'écran CapturesList
    Alors je vois le badge "Transcription terminée"
    Et je NE vois PAS le badge "Modèle requis"

  # ============================================================================
  # AC3: Workflow complet - Capture sans modèle puis download
  # ============================================================================

  Scénario: Workflow complet de capture sans modèle puis configuration
    Étant donné qu'aucun modèle Whisper n'est téléchargé
    # Capture sans modèle
    Quand je navigue vers l'écran de capture
    Et que je tape sur le bouton de capture vocale
    Alors je vois le modal "Modèle de transcription requis"
    Quand je tape sur "Continue without transcription"
    Alors l'enregistrement commence
    Quand j'enregistre pendant 3 secondes
    Et que j'arrête l'enregistrement
    Alors la capture est sauvegardée avec state="captured"
    # Vérification dans la liste
    Quand je navigue vers CapturesList
    Alors je vois la capture avec le badge "Modèle requis"
    # Configuration du modèle
    Quand je navigue vers WhisperSettings
    Et que je télécharge le modèle "tiny"
    Et que le téléchargement se termine
    # Vérification auto-resume
    Alors la capture est automatiquement ajoutée à la queue
    Et la transcription démarre
    # Vérification finale
    Quand je retourne vers CapturesList
    Alors je vois la capture avec le badge "Transcription en cours" ou "Transcription terminée"

  # ============================================================================
  # Edge cases et robustesse
  # ============================================================================

  Scénario: Le check de modèle échoue gracieusement
    Étant donné que TranscriptionModelService.getBestAvailableModel() lève une erreur
    Quand je navigue vers l'écran de capture
    Et que je tape sur le bouton de capture vocale
    Alors l'enregistrement commence quand même
    Et aucun modal d'erreur ne s'affiche
    Et un warning est loggé

  Scénario: Auto-resume échoue pour une capture spécifique
    Étant donné qu'aucun modèle Whisper n'est téléchargé
    Et que 2 captures audio existent avec state="captured"
    Et que TranscriptionQueueService.enqueue() échoue pour la capture #1
    Quand je télécharge le modèle "tiny"
    Alors la capture #1 n'est pas ajoutée à la queue
    Mais la capture #2 est ajoutée avec succès
    Et un log d'erreur est émis pour la capture #1
    Et je vois "AC6: Auto-resumed 1/2 capture(s)"

  Scénario: Badge "Pending model" a priorité sur "Pending"
    Étant donné qu'aucun modèle Whisper n'est téléchargé
    Et qu'une capture audio existe avec state="captured" et normalizedText=null
    Et que la capture n'est PAS dans la queue
    Quand je navigue vers CapturesList
    Alors je vois le badge "Modèle requis"
    Et je NE vois PAS le badge "En attente de transcription"
