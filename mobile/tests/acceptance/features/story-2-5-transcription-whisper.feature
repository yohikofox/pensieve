# language: fr
@story-2.5 @epic-2
Fonctionnalité: Transcription On-Device avec Whisper
  En tant qu'utilisateur de Pensieve
  Je veux que mes captures audio soient automatiquement transcrites en texte sur mon appareil
  Afin de pouvoir lire mes pensées même hors ligne, sans envoyer mon audio à des tiers

  # ============================================================================
  # AC1: Queuing Automatique Après Audio Capture
  # ============================================================================

  @AC1 @auto-queue
  Scénario: Queuer transcription automatiquement après capture
    Étant donné que l'utilisateur a créé une capture audio
    Quand le fichier audio est sauvegardé
    Alors un job de transcription est automatiquement queued
    Et le statut de la Capture passe à "TRANSCRIBING"
    Et le processus background de transcription démarre

  @AC1 @background-process
  Scénario: Processus background démarre automatiquement
    Étant donné qu'un job de transcription est dans la queue
    Quand le BackgroundTranscriptionService démarre
    Alors le job est traité en arrière-plan
    Et l'utilisateur peut continuer à utiliser l'app

  @AC1 @non-blocking
  Scénario: Utilisateur peut continuer à utiliser l'app
    Étant donné qu'une transcription est en cours
    Quand l'utilisateur navigue dans l'application
    Alors l'interface reste responsive
    Et la transcription continue en background

  @AC1 @state-update
  Scénario: Mettre à jour statut Capture à 'TRANSCRIBING'
    Étant donné qu'une capture audio est sauvegardée
    Quand la transcription est queued
    Alors le statut de la Capture est "TRANSCRIBING"
    Et l'ancien statut "CAPTURED" est remplacé

  # ============================================================================
  # AC2: Transcription avec Performance NFR2 (< 2x Audio Duration)
  # ============================================================================

  @AC2 @performance @NFR2
  Scénario: Transcrire audio en < 2x durée
    Étant donné qu'une capture audio de 30 secondes est enregistrée
    Quand Whisper traite le fichier audio
    Alors la transcription se termine en moins de 60 secondes
    Et le texte transcrit est stocké dans normalizedText
    Et le statut de la Capture passe à "TRANSCRIBED"

  @AC2 @storage
  Scénario: Stocker texte dans normalizedText
    Étant donné qu'une transcription Whisper est terminée
    Quand le texte transcrit est "Ma pensée importante"
    Alors la Capture contient normalizedText = "Ma pensée importante"
    Et le rawContent contient toujours le chemin du fichier audio

  @AC2 @state-final
  Scénario: Mettre à jour statut à 'TRANSCRIBED'
    Étant donné qu'une transcription est réussie
    Quand le texte est stocké dans la Capture
    Alors le statut passe de "TRANSCRIBING" à "TRANSCRIBED"
    Et la Capture est accessible pour consultation

  @AC2 @file-retention
  Scénario: Conserver fichier audio original
    Étant donné qu'une capture audio a été transcrite
    Quand la transcription est terminée
    Alors le fichier audio original existe toujours
    Et le filePath de la Capture pointe vers le fichier
    Et le fichier n'est JAMAIS supprimé

  @AC2 @data-driven @performance
  Plan du scénario: Transcrire différentes durées audio
    Étant donné qu'une capture audio de <durée> secondes est enregistrée
    Quand Whisper traite le fichier
    Alors la transcription se termine en moins de <max_durée> secondes

    Exemples:
      | durée | max_durée |
      | 10    | 20        |
      | 30    | 60        |
      | 60    | 120       |
      | 120   | 240       |

  # ============================================================================
  # AC3: Fonctionnement Offline (FR7: Local Transcription)
  # ============================================================================

  @AC3 @offline @FR7
  Scénario: Transcrire en mode offline
    Étant donné que l'appareil est hors ligne
    Et qu'une capture audio est sauvegardée
    Quand la transcription démarre
    Alors la transcription fonctionne de manière identique au mode en ligne
    Et le texte transcrit est stocké localement

  @AC3 @no-network
  Scénario: Aucun appel réseau pendant transcription
    Étant donné que l'appareil est hors ligne
    Quand Whisper transcrit un fichier audio
    Alors aucun appel réseau n'est fait
    Et aucune exception réseau n'est levée
    Et la transcription est 100% locale

  @AC3 @model-installed
  Scénario: Modèle Whisper déjà installé
    Étant donné que l'appareil est hors ligne
    Quand l'application vérifie le modèle Whisper
    Alors le modèle (~500 MB) est déjà installé sur l'appareil
    Et la transcription peut démarrer immédiatement

  # ============================================================================
  # AC4: Download du Modèle Whisper au Premier Lancement
  # ============================================================================

  @AC4 @model-download
  Scénario: Télécharger modèle Whisper au premier lancement
    Étant donné que le modèle Whisper n'est pas installé
    Quand l'utilisateur crée sa première capture audio
    Alors un prompt s'affiche "Download Whisper model (~500 MB)?"
    Et l'utilisateur peut accepter ou refuser
    Et si l'utilisateur accepte, le téléchargement démarre

  @AC4 @download-progress
  Scénario: Afficher progression du téléchargement
    Étant donné que le modèle Whisper est en cours de téléchargement
    Quand la progression avance de 0% à 100%
    Alors une barre de progression s'affiche
    Et le pourcentage est visible (ex: "45%")
    Et l'utilisateur peut suivre l'avancement

  @AC4 @capture-before-model
  Scénario: Sauvegarder captures avant modèle prêt
    Étant donné que le modèle Whisper est en cours de téléchargement
    Quand l'utilisateur crée 3 captures audio
    Alors les 3 captures sont sauvegardées localement
    Et aucune transcription ne démarre (modèle pas prêt)
    Et les 3 captures restent avec statut "CAPTURED"

  @AC4 @queue-until-ready
  Scénario: Queuer transcriptions jusqu'à modèle disponible
    Étant donné que 5 captures audio attendent le modèle Whisper
    Quand le téléchargement du modèle se termine
    Alors les 5 jobs de transcription sont automatiquement queued
    Et le premier job démarre immédiatement
    Et les 4 autres attendent dans la queue FIFO

  # ============================================================================
  # AC5: Feedback Visuel pour Long Audio (NFR5: No Waiting Without Feedback)
  # ============================================================================

  @AC5 @progress-feedback @NFR5
  Scénario: Afficher progression pour audio long (> 10s)
    Étant donné qu'une capture audio de 60 secondes est en cours de transcription
    Quand la transcription prend plus de 10 secondes
    Alors un indicateur de progression s'affiche
    Et l'utilisateur voit le feedback visuel (spinner ou pourcentage)

  @AC5 @non-blocking-ui
  Scénario: App reste utilisable pendant transcription
    Étant donné qu'une transcription longue est en cours (120 secondes)
    Quand l'utilisateur navigue dans l'app
    Alors l'interface reste responsive
    Et l'utilisateur peut créer d'autres captures
    Et la transcription continue en background

  @AC5 @background-task
  Scénario: Transcription en background
    Étant donné qu'une transcription est en cours
    Quand l'utilisateur passe l'app en arrière-plan (home button)
    Alors la transcription continue en background
    Et quand l'utilisateur revient, la transcription est terminée
    Et le texte transcrit est disponible

  # ============================================================================
  # AC6: Gestion des Erreurs de Transcription
  # ============================================================================

  @AC6 @error-handling
  Scénario: Gérer erreur de transcription
    Étant donné qu'une transcription est en cours
    Quand Whisper rencontre une erreur (audio corrompu)
    Alors le statut de la Capture passe à "TRANSCRIPTION_FAILED"
    Et l'erreur est loggée pour debugging
    Et l'utilisateur est notifié de l'échec

  @AC6 @error-logging
  Scénario: Logger erreur pour debugging
    Étant donné qu'une transcription échoue
    Quand l'erreur est capturée
    Alors le stacktrace est loggé dans la console
    Et le chemin du fichier audio est inclus dans le log
    Et le timestamp de l'erreur est enregistré

  @AC6 @retry-option
  Scénario: Notifier utilisateur avec retry
    Étant donné qu'une transcription a échoué
    Quand l'utilisateur ouvre la notification d'erreur
    Alors un message "Transcription failed. Retry?" s'affiche
    Et un bouton "Retry" est disponible
    Et si l'utilisateur tape Retry, la transcription redémarre

  @AC6 @preserve-audio
  Scénario: Préserver audio après erreur
    Étant donné qu'une transcription a échoué
    Quand l'erreur est capturée
    Alors le fichier audio original est toujours présent
    Et le filePath de la Capture existe
    Et l'utilisateur peut réécouter l'audio

  # ============================================================================
  # AC7: Queue FIFO pour Transcriptions Multiples
  # ============================================================================

  @AC7 @fifo-queue
  Scénario: Queue FIFO pour 5 transcriptions
    Étant donné que l'utilisateur crée 5 captures audio successivement
    Quand les 5 jobs de transcription sont queued
    Alors ils sont traités dans l'ordre FIFO (First In First Out)
    Et le premier job créé est le premier traité
    Et le dernier job créé est le dernier traité

  @AC7 @single-process
  Scénario: Une seule transcription à la fois
    Étant donné que 3 transcriptions sont dans la queue
    Quand le premier job démarre
    Alors un seul job a le statut "processing"
    Et les 2 autres ont le statut "pending"
    Et le deuxième job ne démarre qu'après le premier

  @AC7 @queue-status-ui
  Scénario: Afficher statut queue dans UI
    Étant donné que 4 transcriptions sont en attente dans la queue
    Quand l'utilisateur ouvre l'app
    Alors un badge "4 transcriptions pending" s'affiche
    Et l'utilisateur voit combien de jobs restent
    Et le badge se met à jour quand un job se termine

  # ============================================================================
  # Edge Cases & Bug Prevention
  # ============================================================================

  @edge-case @very-long-audio
  Scénario: Transcrire audio très long (10+ minutes)
    Étant donné qu'une capture audio de 600 secondes (10 minutes) est enregistrée
    Quand Whisper traite le fichier
    Alors la transcription se termine en moins de 1200 secondes (< 2x)
    Et la progression est affichée en continu
    Et le texte complet est stocké

  @edge-case @queue-full
  Scénario: Gérer queue pleine (20+ jobs)
    Étant donné que 25 transcriptions sont dans la queue
    Quand l'utilisateur crée une 26ème capture
    Alors le job est ajouté à la queue sans erreur
    Et la queue peut gérer des volumes élevés
    Et les jobs sont traités un par un

  @edge-case @model-download-interrupted
  Scénario: Reprendre téléchargement interrompu
    Étant donné que le téléchargement du modèle Whisper est à 50%
    Quand l'appareil perd la connexion
    Alors le téléchargement est mis en pause
    Et quand la connexion revient, le téléchargement reprend à 50%
    Et le modèle se télécharge complètement
