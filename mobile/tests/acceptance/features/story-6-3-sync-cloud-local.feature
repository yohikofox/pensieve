# language: fr
Fonctionnalité: Story 6.3 - Synchronisation Cloud → Local

  En tant qu'utilisateur,
  Je veux que les données cloud se synchronisent automatiquement sur mon appareil lors de ma connexion,
  Afin que je puisse accéder à toutes mes captures depuis n'importe quel appareil.

  Contexte:
    Étant donné que l'utilisateur est authentifié
    Et que le service de synchronisation est initialisé

  # ============================================================================
  # AC1: Initial Full Sync on New Device Login
  # ============================================================================

  @ac1 @initial-sync
  Scénario: Synchronisation complète initiale au premier login
    Étant donné que c'est le premier login sur ce nouvel appareil (pas de lastPulledAt)
    Et que le cloud contient 50 captures, 20 todos et 10 thoughts
    Quand l'authentification se complète
    Alors une synchronisation complète est automatiquement déclenchée (forceFull=true)
    Et toutes les entités sont téléchargées (captures, thoughts, ideas, todos)
    Et la progression est indiquée en pourcentage
    Et le lastPulledAt est mis à jour après succès

  # ============================================================================
  # AC2: Metadata First, Audio Lazy Loading
  # ============================================================================

  @ac2 @lazy-audio
  Scénario: Téléchargement prioritaire des métadonnées, audio à la demande
    Étant donné que le cloud contient une capture audio avec audio_url mais sans audio_local_path
    Et que la capture a été synchronisée (métadonnées uniquement)
    Quand l'utilisateur ouvre le détail de la capture
    Alors l'audio est téléchargé depuis l'URL MinIO S3
    Et le chemin local est mis à jour dans la base de données
    Et la navigation reste possible immédiatement sans attendre l'audio

  @ac2 @audio-dedup
  Scénario: Prévention des téléchargements audio en double
    Étant donné que la capture a déjà un audio_local_path valide
    Quand LazyAudioDownloader.downloadAudioIfNeeded() est appelé
    Alors le fichier local est retourné sans nouveau téléchargement

  # ============================================================================
  # AC3: Real-Time Sync Between Devices (Periodic 15min)
  # ============================================================================

  @ac3 @periodic-sync
  Scénario: Synchronisation périodique automatique toutes les 15 minutes
    Étant donné que PeriodicSyncService est démarré
    Et que le réseau est disponible
    Quand 15 minutes s'écoulent
    Alors SyncService.sync() est appelé automatiquement
    Et la synchronisation utilise la priorité "low"
    Et la source est marquée comme "periodic"

  @ac3 @periodic-offline
  Scénario: Pas de synchronisation périodique en mode hors ligne
    Étant donné que PeriodicSyncService est démarré
    Et que le réseau est indisponible
    Quand 15 minutes s'écoulent
    Alors SyncService.sync() n'est pas appelé

  # ============================================================================
  # AC4: Incremental Sync (Only Changes)
  # ============================================================================

  @ac4 @incremental
  Scénario: Synchronisation incrémentale - uniquement le delta depuis lastPulledAt
    Étant donné que le lastPulledAt est défini à T1
    Et que le cloud a 150 nouveaux enregistrements depuis T1
    Quand la synchronisation PULL est déclenchée
    Alors les données sont téléchargées en 2 batches (100 + 50)
    Et le lastPulledAt est mis à jour après chaque batch
    Et l'UI se met à jour avec les nouvelles données

  # ============================================================================
  # AC5: Deletion Propagation Across Devices
  # ============================================================================

  @ac5 @soft-delete
  Scénario: Propagation des suppressions entre appareils
    Étant donné que le cloud retourne une capture avec _status="deleted"
    Quand la réponse PULL est appliquée localement
    Alors la capture locale est marquée _status="deleted"
    Et la capture n'apparaît plus dans le feed (_status != "deleted")

  # ============================================================================
  # AC6: Network Error Retry with Fibonacci Backoff
  # ============================================================================

  @ac6 @retry
  Scénario: Retry automatique avec Fibonacci backoff après erreur réseau
    Étant donné que la première tentative PULL échoue (HTTP 500)
    Et que la deuxième tentative réussit
    Quand la synchronisation est déclenchée
    Alors le retry est automatique
    Et les données partiellement téléchargées sont préservées

  # ============================================================================
  # AC7: Conflict Resolution (Last-Write-Wins)
  # ============================================================================

  @ac7 @conflicts
  Scénario: Résolution de conflits PULL - server wins
    Étant donné que la réponse PULL contient des conflits
    Et que la résolution est "server_wins"
    Quand les changements sont appliqués localement
    Alors ConflictHandler.applyConflicts() est appelé avec les conflits
    Et la version serveur est appliquée localement

  # ============================================================================
  # AC8: Background Sync After Offline Period
  # ============================================================================

  @ac8 @offline-recovery
  Scénario: Synchronisation automatique au retour du réseau après période hors ligne
    Étant donné que le réseau était hors ligne
    Et que le cloud a accumulé 1000 changements
    Quand le réseau redevient disponible
    Alors la synchronisation est automatiquement déclenchée par AutoSyncOrchestrator
    Et les données sont téléchargées en batches de 100 (chunking)
    Et l'application reste responsive pendant la synchronisation

  # ============================================================================
  # AC9: Sync Completion Confirmation
  # ============================================================================

  @ac9 @completion
  Scénario: Confirmation de fin de synchronisation et mise à jour UI
    Étant donné que le service de synchronisation est en cours
    Quand la synchronisation PULL se termine avec succès
    Alors SyncStatusStore.setSynced() est appelé avec le timestamp
    Et le statut UI passe à "synced"
    Et le lastSyncTime est mis à jour
