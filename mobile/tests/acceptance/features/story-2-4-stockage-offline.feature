# language: fr
@story-2.4 @epic-2
Fonctionnalité: Stockage Offline des Captures
  En tant qu'utilisateur de Pensieve
  Je veux que mes captures soient stockées de manière sécurisée sur mon appareil même sans réseau
  Afin de ne jamais perdre une pensée et d'y accéder à tout moment

  # ============================================================================
  # AC1: Persistance des Captures Offline
  # ============================================================================

  @AC1 @persistence @offline
  Scénario: Persister captures audio en mode offline
    Étant donné que l'appareil est hors ligne
    Quand l'utilisateur crée une capture audio
    Alors la Capture est persistée dans WatermelonDB
    Et le fichier audio est stocké dans le storage sécurisé
    Et la Capture est dans la queue de synchronisation
    Et la Capture est ajoutée à la queue de synchronisation

  @AC1 @secure-storage
  Scénario: Stocker fichiers audio dans secure storage
    Étant donné que l'utilisateur crée une capture audio
    Quand le fichier audio est écrit sur le disque
    Alors le fichier est stocké dans "FileSystem.documentDirectory/captures/"
    Et le chemin du fichier est enregistré dans la metadata
    Et le fichier est accessible via le filePath de la Capture

  @AC1 @text-persistence
  Scénario: Persister captures texte en mode offline
    Étant donné que l'appareil est hors ligne
    Quand l'utilisateur crée une capture texte "Ma pensée importante"
    Alors la Capture est persistée dans WatermelonDB
    Et le texte est stocké dans le champ rawContent
    Et aucun fichier audio n'est créé (filePath = null)
    Et la capture est dans la queue de synchronisation

  @AC1 @sync-queue
  Scénario: Queue de synchronisation pour captures pending
    Étant donné que l'utilisateur crée 5 captures en mode offline
    Quand toutes les captures sont sauvegardées
    Alors les 5 captures sont dans la queue de synchronisation
    Et les 5 Captures sont dans la SyncQueue
    Et la SyncQueue.getQueueSize() retourne 5

  @AC1 @data-driven
  Plan du scénario: Persister différents types de captures
    Étant donné que l'appareil est hors ligne
    Quand l'utilisateur crée une capture de type "<type>"
    Alors la Capture est persistée avec type "<type>"
    Et la capture est dans la queue de synchronisation

    Exemples:
      | type  |
      | AUDIO |
      | TEXT  |

  # ============================================================================
  # AC2: Création Multiple Sans Réseau (NFR7: 100% Offline Availability)
  # ============================================================================

  @AC2 @offline @NFR7
  Scénario: Créer 10 captures successivement offline
    Étant donné que l'appareil est hors ligne
    Quand l'utilisateur crée 10 captures audio successivement
    Alors toutes les 10 captures sont sauvegardées sans erreurs
    Et aucune exception réseau n'est levée
    Et toutes les captures sont dans la queue de synchronisation

  @AC2 @storage-monitoring
  Scénario: Monitoring de l'espace de stockage
    Étant donné que l'appareil a 500 MB d'espace disponible
    Quand l'utilisateur crée une capture audio
    Alors l'espace de stockage est vérifié avant la capture
    Et le StorageManager.getAvailableSpace() est appelé
    Et aucune erreur n'est levée (espace suffisant)

  @AC2 @storage-warning
  Scénario: Warning si espace < 100 MB
    Étant donné que l'appareil a 80 MB d'espace disponible
    Quand l'utilisateur tente de créer une capture audio
    Alors un warning s'affiche avec le message "Storage running low"
    Et l'utilisateur peut choisir de continuer ou annuler
    Et si l'utilisateur continue, la capture est créée

  @AC2 @storage-critical
  Scénario: Bloquer capture si espace < 50 MB
    Étant donné que l'appareil a 40 MB d'espace disponible
    Quand l'utilisateur tente de créer une capture audio
    Alors un dialog bloquant s'affiche "Insufficient storage"
    Et la capture est bloquée (ne peut pas être créée)
    Et l'utilisateur est invité à libérer de l'espace

  @AC2 @no-network-errors
  Scénario: Pas d'erreurs réseau en mode offline
    Étant donné que l'appareil est hors ligne
    Quand l'utilisateur crée 5 captures audio
    Alors aucune tentative de connexion réseau n'est faite
    Et aucune exception réseau n'est levée
    Et les 5 captures sont sauvegardées localement

  # ============================================================================
  # AC3: Accès Rapide aux Captures Offline (NFR4: < 1s Load Time)
  # ============================================================================

  @AC3 @performance @NFR4
  Scénario: Charger captures en < 1s au démarrage
    Étant donné que l'utilisateur a 50 captures offline
    Quand l'utilisateur ouvre l'application
    Alors toutes les captures sont chargées depuis WatermelonDB
    Et le chargement prend moins de 1 seconde
    Et le feed affiche les 50 captures

  @AC3 @offline-indicator
  Scénario: Afficher indicateur offline dans le feed
    Étant donné que l'utilisateur a 3 captures dans la queue de synchronisation
    Et l'utilisateur a 2 captures synchronisées
    Quand l'utilisateur ouvre le feed
    Alors les 3 captures pending affichent une icône cloud slash
    Et les 2 captures synced n'affichent pas d'icône offline

  @AC3 @no-network-errors-display
  Scénario: Aucune erreur réseau affichée
    Étant donné que l'appareil est hors ligne
    Et l'utilisateur a 10 captures offline
    Quand l'utilisateur ouvre l'application
    Alors le feed se charge sans erreurs
    Et aucun message "Network error" n'est affiché
    Et aucun toast d'erreur réseau n'apparaît

  @AC3 @optimistic-ui
  Scénario: Optimistic UI - captures apparaissent instantanément
    Quand l'utilisateur crée une capture audio
    Alors la capture apparaît immédiatement dans le feed
    Et l'indicateur "pending" est affiché
    Et l'utilisateur n'attend pas de confirmation réseau

  @AC3 @data-driven @performance
  Plan du scénario: Charger différentes quantités de captures
    Étant donné que l'utilisateur a <nombre> captures offline
    Quand l'utilisateur ouvre l'application
    Alors les captures se chargent en moins de 1 seconde

    Exemples:
      | nombre |
      | 10     |
      | 50     |
      | 100    |
      | 500    |

  # ============================================================================
  # AC4: Récupération après Crash (NFR8: Crash Recovery)
  # ============================================================================

  @AC4 @crash-recovery @NFR8
  Scénario: Récupérer captures après crash
    Étant donné que l'utilisateur a créé 5 captures offline
    Et l'application crash avant synchronisation
    Quand l'utilisateur relance l'application
    Alors les 5 captures sont récupérées intactes
    Et toutes les métadonnées sont préservées
    Et les fichiers audio existent toujours

  @AC4 @sync-status-preservation
  Scénario: Préserver syncStatus après crash
    Étant donné que l'utilisateur a 3 captures dans la queue de synchronisation
    Et l'application crash
    Quand l'utilisateur relance l'application
    Alors les 3 captures sont toujours dans la queue de synchronisation
    Et elles sont toujours dans la SyncQueue

  @AC4 @zero-data-loss @NFR6
  Scénario: Zero data loss après crash
    Étant donné que l'utilisateur a créé 10 captures
    Et l'application crash
    Quand l'utilisateur relance l'application
    Alors exactement 10 captures sont présentes
    Et aucune capture n'est perdue
    Et tous les fichiers audio sont intacts

  @AC4 @db-integrity
  Scénario: Vérifier intégrité WatermelonDB au démarrage
    Étant donné que l'application démarre après un crash
    Quand le CrashRecoveryService s'exécute
    Alors l'intégrité de WatermelonDB est vérifiée
    Et le count des Captures correspond aux fichiers présents
    Et aucune corruption de base n'est détectée

  @AC4 @orphan-cleanup
  Scénario: Nettoyer fichiers orphelins après crash
    Étant donné que 2 fichiers audio existent sans Capture associée (orphelins)
    Quand le CrashRecoveryService s'exécute au démarrage
    Alors les 2 fichiers orphelins sont supprimés
    Et seuls les fichiers avec Captures valides restent

  # ============================================================================
  # AC5: Gestion du Stockage (Retention Policy)
  # ============================================================================

  @AC5 @retention-policy
  Scénario: Nettoyer fichiers audio > 90 jours
    Étant donné que l'utilisateur a 100 captures de plus de 90 jours
    Et l'utilisateur a 50 captures de moins de 90 jours
    Quand le cleanup automatique s'exécute
    Alors les fichiers audio des 100 anciennes captures sont supprimés
    Et les fichiers audio des 50 récentes captures sont conservés

  @AC5 @preserve-metadata
  Scénario: Conserver transcriptions et metadata
    Étant donné que l'utilisateur a des captures > 90 jours
    Quand le cleanup automatique supprime les fichiers audio
    Alors les transcriptions (normalizedText) sont conservées
    Et les métadonnées (capturedAt, duration, etc.) sont conservées
    Et seuls les fichiers audio (filePath) sont supprimés

  @AC5 @cleanup-notification
  Scénario: Notification avant cleanup
    Étant donné que le cleanup automatique doit s'exécuter
    Quand le StorageManager détecte des fichiers à nettoyer
    Alors une notification est envoyée à l'utilisateur
    Et l'utilisateur peut confirmer ou annuler le cleanup
    Et si l'utilisateur annule, aucun fichier n'est supprimé

  @AC5 @manual-cleanup
  Scénario: Cleanup manuel depuis settings
    Étant donné que l'utilisateur ouvre les paramètres
    Quand l'utilisateur tape sur "Clean up old audio files"
    Alors un dialog de confirmation s'affiche
    Et si l'utilisateur confirme, le cleanup s'exécute
    Et l'espace libéré est affiché après le cleanup

  # ============================================================================
  # AC6: Encryption at Rest (NFR12: Device-Level Encryption)
  # ============================================================================

  @AC6 @encryption @NFR12 @security
  Scénario: Encryter fichiers audio at rest
    Quand l'utilisateur crée une capture audio
    Et le fichier audio est écrit sur le disque
    Alors le fichier est encrypté avec device-level encryption
    Et l'encryption utilise iOS Data Protection ou Android File-based encryption
    Et la Capture a encryptionStatus = true

  @AC6 @encryption-metadata
  Scénario: Metadata avec encryptionStatus flag
    Étant donné que l'utilisateur crée une capture audio
    Quand la Capture est persistée dans WatermelonDB
    Alors la Capture contient le champ encryptionStatus
    Et encryptionStatus = true
    Et la metadata confirme que le fichier est encrypté

  @AC6 @encryption-transparent
  Scénario: Encryption transparente pour l'utilisateur
    Quand l'utilisateur crée une capture audio
    Alors aucune UI d'encryption n'est affichée
    Et l'encryption est gérée automatiquement par l'OS
    Et l'utilisateur n'a aucune action à faire

  @AC6 @encryption-verification
  Scénario: Vérifier encryption lors de l'écriture
    Quand l'utilisateur crée une capture audio
    Et le fichier est écrit avec FileSystem.writeAsStringAsync()
    Alors l'attribut de protection iOS NSFileProtectionComplete est appliqué
    Ou l'encryption Android FileSystem.StorageAccessFramework est activée
    Et le flag encryptionStatus est définit à true dans la Capture

  # ============================================================================
  # Edge Cases & Bug Prevention
  # ============================================================================

  @edge-case @storage-full
  Scénario: Gérer stockage complètement plein
    Étant donné que l'appareil a 0 MB d'espace disponible
    Quand l'utilisateur tente de créer une capture
    Alors un dialog "Storage full" s'affiche
    Et la capture est bloquée
    Et aucune tentative d'écriture n'est faite

  @edge-case @rapid-captures
  Scénario: Créer captures très rapidement (stress test)
    Quand l'utilisateur crée 50 captures en 10 secondes
    Alors toutes les 50 captures sont sauvegardées
    Et aucune collision d'ID ne se produit
    Et tous les fichiers audio sont uniques

  @edge-case @db-corruption
  Scénario: Récupérer d'une corruption de base
    Étant donné que WatermelonDB est corrompu
    Quand l'application démarre
    Alors le CrashRecoveryService détecte la corruption
    Et une tentative de réparation est faite
    Et l'utilisateur est notifié si la réparation échoue

  @edge-case @sync-queue-persistence
  Scénario: Préserver la SyncQueue après redémarrage
    Étant donné que 20 captures sont dans la SyncQueue
    Quand l'application est fermée normalement
    Et l'application est rouverte
    Alors les 20 captures sont toujours dans la SyncQueue
    Et aucune capture n'est perdue de la queue
