# language: fr
Fonctionnalité: Story 6.2 - Synchronisation Local → Cloud

  En tant qu'utilisateur,
  Je veux que mes captures locales et modifications se synchronisent automatiquement vers le cloud,
  Afin que mes données soient sauvegardées et accessibles depuis d'autres appareils.

  Contexte:
    Étant donné que l'utilisateur est authentifié
    Et que le service de synchronisation est initialisé

  # ============================================================================
  # AC1: Automatic Network Detection & Sync Trigger
  # ============================================================================

  @ac1 @network-detection
  Scénario: Détection automatique du réseau et déclenchement de la synchronisation
    Étant donné que l'utilisateur a créé 3 captures en mode hors ligne
    Et que le compteur de captures en attente est à 3
    Quand le réseau revient disponible
    Alors la synchronisation est automatiquement déclenchée dans les 5 secondes
    Et les 3 captures sont envoyées au cloud
    Et le statut de synchronisation passe à "synced"

  @ac1 @network-flapping
  Scénario: Protection contre le network flapping (multiples changements réseau rapides)
    Étant donné que l'utilisateur est en mode hors ligne
    Quand le réseau change d'état 5 fois en 3 secondes (on/off/on/off/on)
    Alors une seule synchronisation est déclenchée après stabilisation
    Et le debounce de 5 secondes empêche les multiples triggers

  # ============================================================================
  # AC2: Incremental Sync with Batching
  # ============================================================================

  @ac2 @batching
  Scénario: Synchronisation incrémentale avec batching de 100 records
    Étant donné que l'utilisateur a 250 captures modifiées localement
    Et que toutes les captures ont le flag "_changed = 1"
    Quand la synchronisation est déclenchée
    Alors les captures sont envoyées en 3 batches (100 + 100 + 50)
    Et seuls les records modifiés sont inclus dans le payload
    Et le lastPulledAt est envoyé pour détection de conflits

  @ac2 @soft-deletes
  Scénario: Synchronisation des suppressions logiques (soft deletes)
    Étant donné que l'utilisateur a supprimé 2 captures localement
    Et que les captures ont le statut "_status = 'deleted'" et "_changed = 1"
    Quand la synchronisation est déclenchée
    Alors les 2 suppressions sont incluses dans le payload PUSH
    Et le serveur propage les suppressions dans le cloud
    Et les records supprimés sont marqués comme synchronisés

  # ============================================================================
  # AC3: Foreground Sync (Real-Time)
  # ============================================================================

  @ac3 @real-time-sync
  Scénario: Synchronisation en temps réel après création de capture
    Étant donné que l'utilisateur est en ligne
    Quand l'utilisateur crée une nouvelle capture
    Alors la capture est sauvegardée localement immédiatement
    Et une synchronisation est déclenchée après 3 secondes de debounce
    Et la capture est uploadée au cloud via POST /api/sync/push
    Et l'interface reste réactive pendant la synchronisation

  @ac3 @debounce-coalesce
  Scénario: Debounce coalesce - plusieurs actions rapides = une seule sync
    Étant donné que l'utilisateur est en ligne
    Quand l'utilisateur crée 5 captures en 2 secondes
    Alors une seule synchronisation est déclenchée après 3 secondes de la dernière action
    Et les 5 captures sont synchronisées en un seul batch

  # ============================================================================
  # AC4: Modification Sync with Change Tracking
  # ============================================================================

  @ac4 @change-tracking
  Scénario: Suivi des modifications et reset après synchronisation
    Étant donné que l'utilisateur a une Todo existante avec "_changed = 0"
    Quand l'utilisateur marque la Todo comme complétée
    Alors le flag "_changed" passe à 1 dans la base de données locale
    Et la Todo modifiée est incluse dans la prochaine synchronisation
    Quand la synchronisation réussit
    Alors le flag "_changed" est réinitialisé à 0 pour cette Todo
    Et la Todo n'est plus dans la queue de synchronisation

  @ac4 @round-trip
  Scénario: Round-trip complet Create → Sync → Reset
    Étant donné que l'utilisateur crée une nouvelle Thought
    Alors la Thought a "_changed = 1" immédiatement après création
    Quand la synchronisation s'exécute avec succès
    Alors le serveur confirme la réception de la Thought
    Et "_changed" est réinitialisé à 0 localement
    Et le lastPulledAt est mis à jour avec le timestamp serveur

  # ============================================================================
  # AC5: Network Error Retry with Fibonacci Backoff
  # ============================================================================

  @ac5 @retry-fibonacci
  Scénario: Retry automatique avec Fibonacci backoff après erreur réseau
    Étant donné que l'utilisateur a 5 captures en attente de synchronisation
    Et que le réseau est instable (timeouts intermittents)
    Quand la première tentative de synchronisation échoue (network error)
    Alors la synchronisation est retentée automatiquement
    Et les délais de retry suivent la séquence Fibonacci: 1s, 1s, 2s, 3s, 5s
    Et le flag "_changed = 1" est préservé jusqu'au succès
    Quand la synchronisation réussit finalement à la 4ème tentative
    Alors les 5 captures sont synchronisées
    Et "_changed" est réinitialisé à 0

  @ac5 @retry-limit
  Scénario: Limite de retry et erreur non-retryable
    Étant donné que l'utilisateur a des captures en attente
    Quand la synchronisation échoue avec une erreur d'authentification (AUTH_ERROR)
    Alors aucune retry n'est tentée (erreur non-retryable)
    Et le statut de synchronisation passe à "error"
    Et un message d'erreur est affiché à l'utilisateur

  # ============================================================================
  # AC6: Large Audio File Upload
  # ============================================================================

  @ac6 @audio-upload
  Scénario: Upload d'un fichier audio volumineux après sync metadata
    Étant donné que l'utilisateur a créé une capture audio de 50MB
    Et que la capture a un fichier audio local (raw_content non null)
    Quand la synchronisation metadata réussit
    Alors la capture (sans audio_url) est synchronisée en premier
    Et l'audio est automatiquement ajouté à la queue d'upload
    Et l'upload audio démarre en arrière-plan vers MinIO
    Et la progression de l'upload est trackée dans upload_queue
    Quand l'upload audio se termine avec succès
    Alors l'audio_url est mis à jour dans la capture locale
    Et une synchronisation PUSH met à jour la capture sur le serveur
    Et le statut de l'upload passe à "completed"

  @ac6 @resumable-upload
  Scénario: Upload resumable après interruption réseau
    Étant donné qu'un upload audio de 100MB est en cours (50% complété)
    Et que le dernier chunk uploadé est sauvegardé (last_chunk_uploaded)
    Quand la connexion réseau est interrompue
    Alors l'upload passe au statut "failed"
    Et le retry est tenté avec exponential backoff
    Quand le réseau revient
    Alors l'upload reprend depuis le dernier chunk réussi (50%)
    Et les 50MB restants sont uploadés
    Et l'upload se termine avec succès

  @ac6 @multipart-upload
  Scénario: Upload multipart pour fichiers volumineux
    Étant donné qu'une capture audio de 200MB est en attente d'upload
    Quand l'upload démarre
    Alors le fichier est divisé en chunks de taille appropriée
    Et chaque chunk est uploadé séquentiellement
    Et la progression est mise à jour après chaque chunk (0.0 → 1.0)
    Et l'upload se termine quand tous les chunks sont envoyés

  # ============================================================================
  # AC7: Conflict Resolution (Last-Write-Wins MVP)
  # ============================================================================

  @ac7 @conflict-resolution
  Scénario: Résolution de conflit - server wins (last-write-wins)
    Étant donné que Device A modifie la Todo #1 en mode hors ligne (description: "Acheter pain")
    Et que Device B modifie la même Todo #1 en ligne (description: "Acheter lait")
    Et que Device B synchronise en premier (timestamp serveur: 1000)
    Quand Device A revient en ligne et synchronise (timestamp local: 900)
    Alors un conflit est détecté par le serveur (lastPulledAt < server.last_modified)
    Et le serveur retourne la version gagnante dans conflicts[]
    Et Device A applique la version serveur localement (description: "Acheter lait")
    Et le conflit est loggé pour audit trail
    Et aucune donnée n'est perdue (version perdante loggée)

  @ac7 @conflict-logging
  Scénario: Logging des conflits pour analytics
    Étant donné qu'un conflit de synchronisation se produit
    Quand le conflit est résolu (server wins)
    Alors le conflit est loggé localement avec les détails:
      | Champ          | Valeur                    |
      | entity         | todo                      |
      | record_id      | todo-123                  |
      | resolution     | server_wins               |
      | client_version | "Acheter pain"            |
      | server_version | "Acheter lait"            |
    Et les logs peuvent être consultés pour audit

  # ============================================================================
  # AC8: Sync Success Confirmation
  # ============================================================================

  @ac8 @sync-success
  Scénario: Confirmation de succès et mise à jour des indicateurs UI
    Étant donné que l'utilisateur a 10 captures en attente de synchronisation
    Et que le statut UI affiche "Pending (10)"
    Quand la synchronisation démarre
    Alors le statut UI passe à "Syncing..." avec un spinner
    Quand toutes les captures sont synchronisées avec succès
    Alors le lastPulledAt est mis à jour pour la table "captures"
    Et les flags "_changed" sont réinitialisés à 0 pour les 10 captures
    Et la queue de synchronisation est vidée
    Et le statut UI affiche "Synced ✓ just now"

  @ac8 @sync-error
  Scénario: Gestion d'erreur et indicateur d'erreur
    Étant donné que l'utilisateur a des captures en attente
    Quand la synchronisation échoue avec une erreur serveur (500)
    Alors le statut UI affiche "Error !" en rouge
    Et un message d'erreur descriptif est disponible
    Et les captures restent dans la queue (retry ultérieur)
    Et le flag "_changed = 1" est préservé

  @ac8 @time-elapsed
  Scénario: Affichage du temps écoulé depuis dernière sync
    Étant donné que la dernière synchronisation a réussi il y a 5 minutes
    Quand l'utilisateur consulte le statut de synchronisation
    Alors le statut affiche "Synced ✓ 5m ago"
    Et le format s'adapte au temps écoulé:
      | Temps écoulé  | Format affiché |
      | < 1 minute    | "just now"     |
      | 2 minutes     | "2m ago"       |
      | 3 heures      | "3h ago"       |
      | 5 jours       | "5d ago"       |
