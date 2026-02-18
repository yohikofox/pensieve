# language: fr

Fonctionnalité: Indicateurs de Statut de Synchronisation
  En tant qu'utilisateur mobile
  Je veux voir l'état de synchronisation en temps réel
  Afin de savoir si mes données sont à jour

  @story-6.4 @AC2 @task-1
  Scénario: L'indicateur passe à "synchronisé" après un SyncCompletedEvent
    Étant donné l'application est démarrée et le bridge EventBus est actif
    Et le SyncStatusStore est à l'état "en attente"
    Quand un SyncCompletedEvent est publié sur l'EventBus
    Alors le SyncStatusStore passe à l'état "synced"
    Et le timestamp de dernière sync est mis à jour

  @story-6.4 @AC2 @task-1
  Scénario: L'indicateur passe à "pending" après un SyncFailedEvent retryable
    Étant donné l'application est démarrée et le bridge EventBus est actif
    Et le SyncStatusStore est à l'état "syncing"
    Quand un SyncFailedEvent retryable est publié sur l'EventBus
    Alors le SyncStatusStore passe à l'état "pending"
    Et le pendingCount est préservé (pas réinitialisé à 0)

  @story-6.4 @AC2 @task-1
  Scénario: L'indicateur passe à "error" après un SyncFailedEvent non-retryable
    Étant donné l'application est démarrée et le bridge EventBus est actif
    Et le SyncStatusStore est à l'état "syncing"
    Quand un SyncFailedEvent non-retryable est publié avec l'erreur "NETWORK_UNAVAILABLE"
    Alors le SyncStatusStore passe à l'état "error"
    Et le message d'erreur est "NETWORK_UNAVAILABLE"

  @story-6.4 @AC4 @task-5
  Scénario: Le pull-to-refresh déclenche une synchronisation manuelle
    Étant donné l'utilisateur est sur l'écran Captures
    Et l'application est en ligne
    Quand l'utilisateur effectue un pull-to-refresh
    Alors le SyncService.sync() est appelé avec priority "high"
    Et l'indicateur de sync passe à l'état "syncing"

  @story-6.4 @AC6 @task-6
  Scénario: Le sync automatique est ignoré si syncOnWifiOnly est activé en data mobile
    Étant donné le paramètre syncOnWifiOnly est activé
    Et l'appareil est connecté en données mobiles (pas Wi-Fi)
    Quand l'AutoSyncOrchestrator détecte que le réseau revient
    Alors le SyncService.sync() n'est PAS appelé

  @story-6.4 @AC6 @task-6
  Scénario: Le sync automatique fonctionne si syncOnWifiOnly est activé et connexion Wi-Fi
    Étant donné le paramètre syncOnWifiOnly est activé
    Et l'appareil est connecté en Wi-Fi
    Quand l'AutoSyncOrchestrator détecte que le réseau revient
    Alors le SyncService.sync() est appelé

  @story-6.4 @AC7 @task-7
  Scénario: Le rappel hors ligne s'affiche après 24h sans synchronisation
    Étant donné la dernière synchronisation a eu lieu il y a plus de 24 heures
    Et le rappel n'a pas encore été ignoré
    Quand le hook useLongOfflineReminder vérifie l'état
    Alors une alerte "Synchronisation interrompue" s'affiche
