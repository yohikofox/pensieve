# language: fr
Fonctionnalité: Story 6.5 - Fix Pipeline Audio Upload & Synchro Descendante

  En tant qu'utilisateur,
  Je veux que mes fichiers audio soient uploadés vers le cloud après synchronisation,
  Afin que mes audios soient récupérables après réinstallation de l'application.

  Contexte:
    Étant donné que l'utilisateur est authentifié
    Et que l'AudioUploadService est initialisé

  # ============================================================================
  # BUG 1 FIX: Upload worker déclenché après SyncSuccess
  # ============================================================================

  @bug1-fix @upload-worker
  Scénario: La queue d'upload est consommée après une synchronisation réussie
    Étant donné qu'une capture audio "capture-abc" avec fichier local "/storage/audio.m4a" existe
    Et que la capture a été synchronisée (SyncSuccess)
    Et que la capture est en attente dans la upload_queue avec statut "pending"
    Quand l'UploadOrchestrator traite l'événement SyncSuccess
    Alors AudioUploadService.uploadFile() est appelé pour la capture "capture-abc"
    Et le statut dans upload_queue passe à "completed"

  @bug1-fix @upload-worker @empty-queue
  Scénario: Aucun traitement si la queue est vide
    Étant donné qu'aucune capture audio n'est en attente dans la upload_queue
    Quand l'UploadOrchestrator traite l'événement SyncSuccess avec captures ["capture-xyz"]
    Alors AudioUploadService.uploadFile() n'est pas appelé

  # ============================================================================
  # BUG 2 FIX: audio_url persisté dans captures après upload
  # ============================================================================

  @bug2-fix @audio-url-persistence
  Scénario: L'audio_url est persisté dans captures après upload réussi
    Étant donné qu'une capture audio "capture-abc" est dans la upload_queue avec statut "pending"
    Et que l'AudioUploadService retourne l'audioUrl "audio/user-1/capture-abc.m4a" pour cet upload
    Quand l'UploadOrchestrator traite la queue d'upload
    Alors la capture "capture-abc" dans la table captures a audio_url = "audio/user-1/capture-abc.m4a"

  @bug2-fix @audio-url-persistence @upload-failure
  Scénario: audio_url non mis à jour si l'upload échoue
    Étant donné qu'une capture audio "capture-fail" est dans la upload_queue avec statut "pending"
    Et que l'AudioUploadService retourne une erreur réseau pour cet upload
    Quand l'UploadOrchestrator traite la queue d'upload
    Alors la capture "capture-fail" dans la table captures n'a pas d'audio_url
    Et le statut dans upload_queue passe à "failed"

  # ============================================================================
  # BUG 5 FIX: audioUrl du PULL stocké localement
  # ============================================================================

  @bug5-fix @pull-audio-url
  Scénario: L'audioUrl reçue du PULL est stockée dans captures.audio_url
    Étant donné que le serveur retourne une capture audio avec audioUrl "http://api.example.local:3000/api/uploads/audio/capture-abc"
    Quand SyncService applique les changements serveur (applyServerChanges)
    Alors la capture locale a audio_url = "http://api.example.local:3000/api/uploads/audio/capture-abc"

  @bug5-fix @pull-audio-url @no-overwrite
  Scénario: L'audioUrl n'est pas écrasée si absente du PULL
    Étant donné qu'une capture locale a déjà audio_url = "http://api.example.local:3000/api/uploads/audio/old-capture"
    Et que le serveur retourne la même capture sans audioUrl dans le PULL
    Quand SyncService applique les changements serveur (applyServerChanges)
    Alors la capture locale conserve son audio_url = "http://api.example.local:3000/api/uploads/audio/old-capture"
