# language: fr

Fonctionnalité: Story 4.1 - Queue Asynchrone pour Digestion IA

  En tant que développeur
  Je veux un système de queue asynchrone robuste pour les jobs de digestion IA
  Afin que le traitement IA s'exécute de manière fiable en arrière-plan sans bloquer l'expérience utilisateur

  Contexte:
    Étant donné le backend est démarré
    Et RabbitMQ est accessible

  # ============================================================================
  # AC1: RabbitMQ Queue Infrastructure Setup
  # ============================================================================

  @AC1 @infrastructure
  Scénario: Configuration infrastructure RabbitMQ avec queues durables
    Quand je vérifie la configuration RabbitMQ
    Alors la queue "digestion-jobs" existe
    Et la queue est durable pour survivre aux redémarrages
    Et la persistence des messages est activée
    Et la queue supporte les priorités (x-max-priority = 10)

  @AC1 @infrastructure @dead-letter
  Scénario: Configuration de la dead-letter queue pour les retries
    Quand je vérifie la configuration RabbitMQ
    Alors la queue "digestion-failed" existe
    Et l'exchange "digestion-dlx" est configuré
    Et la queue "digestion-jobs" route vers "digestion-dlx" en cas d'échec

  @AC1 @infrastructure @connection-pooling
  Scénario: Configuration du connection pooling
    Quand je vérifie la configuration de connexion RabbitMQ
    Alors le prefetch count est configuré à 3 (max concurrent jobs)
    Et le heartbeat est configuré à 30 secondes
    Et les connexions sont réutilisées (pooling)

  # ============================================================================
  # AC2: Automatic Job Publishing After Transcription
  # ============================================================================

  @AC2 @job-publishing
  Scénario: Publication automatique d'un job après transcription audio
    Étant donné qu'une capture audio a été transcrite
    Quand la transcription se termine avec succès
    Alors un job de digestion est automatiquement publié dans la queue RabbitMQ
    Et le payload du job contient le captureId
    Et le payload du job contient le userId
    Et le payload du job contient le contentType "audio_transcribed"
    Et le payload du job contient la priority "normal"
    Et le statut de la Capture est mis à jour à "queued_for_digestion"

  @AC2 @job-publishing @text-capture
  Scénario: Publication automatique d'un job pour capture texte (bypass transcription)
    Étant donné qu'une capture texte a été créée
    Quand la capture texte est sauvegardée
    Alors un job de digestion est automatiquement publié dans la queue RabbitMQ
    Et le payload du job contient le contentType "text"
    Et le statut de la Capture est mis à jour à "queued_for_digestion"

  @AC2 @job-publishing @user-initiated
  Scénario: Publication d'un job haute priorité pour action utilisateur
    Étant donné qu'une capture est créée suite à une action utilisateur explicite
    Quand le job est publié
    Alors la priority du job est "high"
    Et le job sera traité avant les jobs "normal"

  @AC2 @job-publishing @event
  Scénario: Événement DigestionJobQueued publié après mise en queue
    Étant donné qu'une capture est prête pour digestion
    Quand le job est publié dans RabbitMQ
    Alors un événement "DigestionJobQueued" est émis
    Et l'événement contient le captureId
    Et l'événement contient le userId
    Et l'événement contient le timestamp queuedAt

  # ============================================================================
  # AC3: Priority-Based Job Processing
  # ============================================================================

  @AC3 @priority @concurrency
  Scénario: Traitement par priorité (high avant normal)
    Étant donné 2 jobs "normal" sont en queue
    Et 1 job "high" est publié après
    Quand le worker commence à traiter
    Alors le job "high" est traité en premier
    Et les jobs "normal" sont traités ensuite dans l'ordre FIFO

  @AC3 @concurrency @rate-limiting
  Scénario: Limitation de concurrence à 3 jobs simultanés (éviter rate limiting OpenAI)
    Étant donné 10 jobs sont publiés dans la queue
    Quand les workers commencent à traiter
    Alors au maximum 3 jobs sont traités simultanément
    Et les 7 autres jobs attendent en queue
    Et chaque job terminé libère un slot pour le suivant

  @AC3 @timeout
  Scénario: Timeout de job après 60 secondes (2x NFR3 target)
    Étant donné qu'un job est en cours de traitement
    Et le job prend plus de 60 secondes
    Quand le timeout est atteint
    Alors le job est automatiquement rejeté (nack)
    Et le job est déplacé vers la dead-letter queue
    Et une erreur "JobTimeoutExceeded" est loggée

  # ============================================================================
  # AC4: Real-Time Progress Updates
  # ============================================================================

  @AC4 @progress @status-update
  Scénario: Mise à jour du statut "digesting" au début du traitement
    Étant donné qu'un job est en queue
    Quand le worker commence à traiter le job
    Alors le statut de la Capture est mis à jour à "digesting"
    Et le timestamp processing_started_at est enregistré
    Et un événement "DigestionJobStarted" est émis

  @AC4 @progress @real-time-deferred
  Scénario: Mises à jour de progression en temps réel via WebSocket
    # NOTE: Deferred to Story 4.4 (Subtask 4.3-4.4)
    Étant donné qu'un job de digestion est en cours
    Quand le worker publie des mises à jour de progression
    Alors les événements de progression sont envoyés via WebSocket
    Et le client mobile reçoit les mises à jour en temps réel
    Et le pourcentage de progression est calculé si déterminable

  # ============================================================================
  # AC5: Retry Logic with Exponential Backoff
  # ============================================================================

  @AC5 @retry @exponential-backoff
  Plan du scénario: Retry avec backoff exponentiel après échec
    Étant donné qu'un job échoue à cause d'une erreur API OpenAI
    Quand l'échec est détecté
    Alors le job est nack et déplacé vers la dead-letter queue
    Et une retry est tentée après <délai> secondes (attempt <attempt>)
    Et le header x-retry-count est incrémenté à <attempt>

    Exemples:
      | attempt | délai |
      | 1       | 5     |
      | 2       | 15    |
      | 3       | 45    |

  @AC5 @retry @max-retries
  Scénario: Échec définitif après 3 tentatives
    Étant donné qu'un job a échoué 3 fois (retry exhausted)
    Quand la 3ème retry échoue
    Alors le statut de la Capture est mis à jour à "digestion_failed"
    Et les détails de l'erreur sont sauvegardés (error message, stack trace)
    Et un événement "DigestionJobFailed" est émis
    Et le job reste dans la dead-letter queue pour inspection manuelle

  @AC5 @retry @manual-retry
  Scénario: Retry manuelle d'un job échoué via endpoint API
    Étant donné qu'une Capture a le statut "digestion_failed"
    Quand l'utilisateur appelle POST /digestion/:captureId/retry
    Alors un nouveau job est publié dans la queue
    Et le compteur de retry est réinitialisé à 0
    Et le statut de la Capture est mis à jour à "queued_for_digestion"

  @AC5 @retry @error-logging
  Scénario: Logging détaillé des erreurs pour debugging
    Étant donné qu'un job échoue à cause d'une exception
    Quand l'erreur est détectée
    Alors le message d'erreur complet est loggué
    Et la stack trace est loggée
    Et le payload du job est loggué pour reproduction
    Et le timestamp de l'erreur est enregistré

  # ============================================================================
  # AC6: Queue Monitoring and Load Management
  # ============================================================================

  @AC6 @monitoring @queue-depth
  Scénario: Surveillance de la profondeur de la queue
    Étant donné 50 jobs sont en queue
    Quand je consulte les métriques
    Alors la profondeur de la queue est exposée via getQueueDepth()
    Et la profondeur retourne 50

  @AC6 @monitoring @overload-alert
  Scénario: Alerte déclenchée si queue > 100 jobs
    Étant donné 150 jobs sont en queue
    Quand je vérifie si la queue est surchargée
    Alors isQueueOverloaded() retourne true
    Et une alerte est déclenchée (log warning)
    Et un événement "QueueOverloaded" est émis

  @AC6 @monitoring @estimated-wait-time
  Scénario: Calcul du temps de traitement estimé (NFR5: feedback obligatoire)
    Étant donné 30 jobs sont en queue
    Et chaque job prend en moyenne 25 secondes
    Quand je calcule le temps d'attente estimé
    Alors calculateEstimatedWaitTime() retourne environ 250 secondes (30 jobs / 3 workers * 25s)
    Et cette information est exposée à l'utilisateur

  @AC6 @monitoring @metrics
  Scénario: Exposition des métriques Prometheus pour observabilité
    Quand je consulte GET /metrics
    Alors les métriques suivantes sont exposées :
      | métrique                      | type    |
      | digestion_jobs_total          | counter |
      | digestion_jobs_failed_total   | counter |
      | digestion_job_duration_seconds| histogram |
      | digestion_queue_depth         | gauge   |
    Et les métriques sont au format Prometheus

  @AC6 @monitoring @graceful-degradation
  Scénario: Dégradation gracieuse sous forte charge
    Étant donné la queue contient plus de 200 jobs
    Quand shouldPauseJobCreation() est appelé
    Alors la méthode retourne true
    Et la création de nouveaux jobs est temporairement suspendue
    Et un message d'erreur explicite est retourné à l'utilisateur
    Et le système continue de traiter les jobs existants sans crash

  # ============================================================================
  # AC7: Offline Batch Processing
  # ============================================================================

  @AC7 @offline @batch-processing-partial-deferred
  Scénario: Détection du retour de connectivité réseau
    # NOTE: Subtask 7.1 deferred to Epic 6 (Sync)
    # Mobile-side network detection will be handled in Sync epic
    Étant donné l'utilisateur a créé des captures hors ligne
    Et la connectivité réseau revient
    Quand le mobile détecte le retour réseau
    Alors les captures en attente sont soumises automatiquement au backend
    Et le backend accepte les captures et les met en queue

  @AC7 @offline @batch-submit
  Scénario: Soumission batch de captures en attente via POST /digestion/batch
    Étant donné le mobile a 5 captures en attente de digestion
    Quand le mobile appelle POST /digestion/batch avec l'array de captureIds
    Alors le backend publie 5 jobs de digestion dans la queue
    Et chaque job a le priority basé sur la récence de l'activité utilisateur
    Et une réponse JSON contient le statut de chaque capture (success/error)

  @AC7 @offline @recency-priority
  Scénario: Priorisation des jobs par récence d'activité utilisateur
    Étant donné 3 captures ont été créées : capture-1 (il y a 10min), capture-2 (il y a 2min), capture-3 (il y a 5min)
    Quand le mobile soumet ces captures triées par récence (frontend-sorted)
    Alors les jobs sont publiés dans l'ordre : capture-2, capture-3, capture-1
    Et tous les jobs ont la même priority "normal" (priorité FIFO via ordre de soumission)

  @AC7 @offline @batch-optimization
  Scénario: Optimisation des appels API via endpoint batch unique
    Étant donné le mobile a 10 captures en attente
    Quand le mobile soumet les captures
    Alors un seul appel HTTP POST /digestion/batch est effectué (pas 10 appels individuels)
    Et le payload contient un array de 10 captureIds
    Et le backend traite le batch en une seule transaction

  @AC7 @offline @partial-failure
  Scénario: Gestion des échecs partiels dans un batch
    Étant donné un batch de 5 captures : [capture-1, capture-2-INVALID, capture-3, capture-4, capture-5]
    Quand le backend traite le batch
    Alors 4 jobs sont publiés avec succès (capture-1, 3, 4, 5)
    Et 1 job échoue avec une erreur "CaptureNotFound" (capture-2)
    Et la réponse JSON contient :
      """
      {
        "success": [
          { "captureId": "capture-1", "status": "queued" },
          { "captureId": "capture-3", "status": "queued" },
          { "captureId": "capture-4", "status": "queued" },
          { "captureId": "capture-5", "status": "queued" }
        ],
        "errors": [
          { "captureId": "capture-2-INVALID", "error": "CaptureNotFound" }
        ]
      }
      """
    Et le mobile peut retry uniquement capture-2 si nécessaire

  # ============================================================================
  # Edge Cases & Performance Tests
  # ============================================================================

  @edge-case @load-test
  Scénario: Test de charge avec 100+ jobs concurrents
    Étant donné 150 jobs sont publiés dans la queue
    Quand les workers traitent la queue
    Alors tous les jobs sont traités sans perte de message
    Et le système ne crash pas sous la charge
    Et les métriques de performance sont collectées

  @edge-case @rabbitmq-restart
  Scénario: Récupération après redémarrage de RabbitMQ
    Étant donné 10 jobs durables sont en queue
    Quand RabbitMQ redémarre
    Alors les 10 jobs sont toujours présents dans la queue (persistence)
    Et les jobs sont traités normalement après reconnexion
    Et aucun job n'est perdu

  @edge-case @duplicate-job
  Scénario: Prévention de jobs duplicata pour une même capture
    Étant donné qu'un job pour capture-123 est déjà en queue
    Quand un nouveau job pour capture-123 est publié
    Alors le job existant est conservé
    Et le nouveau job est rejeté avec une erreur "DuplicateJob"
    Et le statut de la capture reste "queued_for_digestion" (pas de changement)
