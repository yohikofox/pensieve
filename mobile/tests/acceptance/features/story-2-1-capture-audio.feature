# language: fr
@story-2.1 @epic-2
Fonctionnalité: Capture Audio 1-Tap
  En tant qu'utilisateur de Pensieve
  Je veux capturer mes pensées vocales en un seul tap
  Afin de sauvegarder rapidement mes idées sans friction

  # ============================================================================
  # AC1: Start Recording with < 500ms Latency
  # ============================================================================

  @AC1 @performance @NFR1
  Scénario: Démarrer l'enregistrement avec latence minimale
    Étant donné que l'utilisateur "user-123" est authentifié
    Et que le service d'enregistrement est initialisé
    Quand l'utilisateur démarre un enregistrement
    Alors l'enregistrement démarre en moins de 500ms
    Et une entité Capture est créée avec le statut "recording"
    Et le fichier audio est initialisé dans le stockage

  @AC1 @entity
  Scénario: Créer une entité Capture pendant l'enregistrement
    Quand l'utilisateur démarre un enregistrement
    Alors une entité Capture existe avec:
      | champ      | valeur                    |
      | type       | AUDIO                     |
      | state      | RECORDING                 |
      | syncStatus | pending                   |
    Et la capture a un ID unique généré
    Et la capture a un timestamp capturedAt

  # ============================================================================
  # AC2: Stop and Save Recording
  # ============================================================================

  @AC2 @data-driven
  Plan du scénario: Sauvegarder avec différentes durées d'enregistrement
    Quand l'utilisateur enregistre pendant <durée> secondes
    Et l'utilisateur arrête l'enregistrement
    Alors une Capture est sauvegardée avec:
      | champ        | valeur                  |
      | state        | CAPTURED                |
      | duration     | <durée_ms>              |
      | syncStatus   | pending                 |
    Et le fichier audio existe avec le nom "capture_user-123_*.m4a"
    Et les métadonnées incluent la durée <durée_ms>ms

    Exemples:
      | durée | durée_ms |
      | 1     | 1000     |
      | 2     | 2000     |
      | 5     | 5000     |
      | 30    | 30000    |

  @AC2 @metadata
  Scénario: Stocker les métadonnées complètes du fichier audio
    Quand l'utilisateur enregistre pendant 3 secondes
    Et l'utilisateur arrête l'enregistrement
    Alors la Capture contient les métadonnées:
      | champ      | type     | contrainte  |
      | duration   | number   | 3000        |
      | fileSize   | number   | > 0         |
      | filePath   | string   | non vide    |
      | capturedAt | datetime | aujourd'hui |
      | format     | string   | m4a         |

  @AC2 @naming
  Scénario: Nommer les fichiers selon la convention
    Quand l'utilisateur enregistre pendant 1 seconde
    Et l'utilisateur arrête l'enregistrement
    Alors le fichier audio est nommé selon le pattern:
      """
      capture_{userId}_{timestamp}_{uuid}.m4a
      """
    Et le fichier commence par "capture_user-123_"
    Et le fichier se termine par ".m4a"

  # ============================================================================
  # AC3: Offline Functionality
  # ============================================================================

  @AC3 @offline @NFR7
  Scénario: Capturer en mode hors ligne
    Étant donné que l'appareil est hors ligne
    Quand l'utilisateur enregistre pendant 2 secondes
    Et l'utilisateur arrête l'enregistrement
    Alors la capture fonctionne de manière identique au mode en ligne
    Et la Capture a le statut syncStatus = "pending"
    Et aucune erreur réseau n'est levée

  @AC3 @sync
  Scénario: Marquer pour synchronisation future
    Étant donné que l'appareil est hors ligne
    Quand l'utilisateur complète une capture
    Alors la Capture a syncStatus = "pending"
    Et la Capture sera éligible pour sync quand le réseau reviendra

  # ============================================================================
  # AC4: Crash Recovery
  # ============================================================================

  @AC4 @crash-recovery @NFR8
  Scénario: Récupérer un enregistrement interrompu par crash
    Étant donné que l'utilisateur a démarré un enregistrement
    Et que l'enregistrement dure depuis 2 secondes
    Quand l'application crash
    Et le service de récupération détecte l'enregistrement incomplet
    Alors l'enregistrement partiel est récupéré
    Et une Capture est créée avec state = "RECOVERED"
    Et le fichier audio partiel est préservé

  @AC4 @recovery-notification
  Scénario: Signaler la récupération à l'utilisateur
    Étant donné qu'un enregistrement a été récupéré après crash
    Quand le service de récupération traite la capture
    Alors la Capture a un flag recoveredFromCrash = true
    Et la Capture contient les métadonnées de récupération

  # ============================================================================
  # AC5: Microphone Permission Handling
  # ============================================================================

  @AC5 @permissions
  Scénario: Vérifier les permissions avant d'enregistrer
    Étant donné que les permissions microphone ne sont pas accordées
    Quand l'utilisateur tente de démarrer un enregistrement
    Alors une erreur MicrophonePermissionDenied est levée
    Et aucune Capture n'est créée
    Et aucun fichier audio n'est créé

  @AC5 @permissions
  Scénario: Enregistrer avec permissions accordées
    Étant donné que les permissions microphone sont accordées
    Quand l'utilisateur démarre un enregistrement
    Alors l'enregistrement démarre avec succès
    Et une Capture est créée

  # ============================================================================
  # Edge Cases & Bug Prevention
  # ============================================================================

  @edge-case @bug-prevention
  Plan du scénario: Gérer les enregistrements très courts
    Quand l'utilisateur enregistre pendant <durée> millisecondes
    Et l'utilisateur arrête l'enregistrement
    Alors la Capture est créée malgré la courte durée
    Et la durée stockée est <durée>ms

    Exemples:
      | durée |
      | 100   |
      | 500   |
      | 999   |

  @edge-case @storage
  Scénario: Gérer l'espace de stockage faible
    Étant donné que l'espace de stockage disponible est < 1MB
    Quand l'utilisateur tente de démarrer un enregistrement
    Alors une erreur InsufficientStorage est levée
    Et l'utilisateur est informé du problème de stockage

  @edge-case @concurrent
  Scénario: Empêcher les enregistrements concurrents
    Étant donné qu'un enregistrement est en cours
    Quand l'utilisateur tente de démarrer un second enregistrement
    Alors une erreur RecordingAlreadyInProgress est levée
    Et le premier enregistrement continue sans interruption
