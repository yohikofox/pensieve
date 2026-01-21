# language: fr
@story-2.6 @epic-2
Fonctionnalité: Consultation de Transcription
  En tant qu'utilisateur de Pensieve
  Je veux consulter la transcription complète de mes captures audio
  Afin de lire mes pensées sous forme de texte et vérifier l'exactitude de la transcription

  # ============================================================================
  # AC1: Afficher Transcription Complète avec Métadonnées
  # ============================================================================

  @AC1 @transcription-display
  Scénario: Afficher transcription complète avec métadonnées
    Étant donné qu'une capture audio "capture-123" a été transcrite
    Et que la transcription est "Ma pensée importante sur le business"
    Et que le timestamp de transcription est "2026-01-21 14:30:00"
    Et que la durée audio est 155 secondes
    Quand l'utilisateur ouvre la vue détail de la capture
    Alors la transcription complète est affichée
    Et le texte affiché est "Ma pensée importante sur le business"
    Et le timestamp "2026-01-21 14:30:00" est visible
    Et la durée "2:35" est affichée

  @AC1 @timestamp
  Scénario: Afficher timestamp de transcription
    Étant donné qu'une capture audio a été transcrite le "2026-01-21 10:15:00"
    Quand l'utilisateur ouvre la vue détail
    Alors le timestamp "2026-01-21 10:15:00" est affiché
    Et le format du timestamp est lisible

  @AC1 @audio-duration
  Scénario: Afficher durée audio
    Étant donné qu'une capture audio de 90 secondes a été transcrite
    Quand l'utilisateur ouvre la vue détail
    Alors la durée "1:30" est affichée
    Et le format est "MM:SS"

  @AC1 @audio-availability
  Scénario: Rendre fichier audio disponible
    Étant donné qu'une capture audio transcrite existe
    Et que le fichier audio est "/audio/capture-123.m4a"
    Quand l'utilisateur ouvre la vue détail
    Alors le fichier audio est chargé dans le player
    Et le bouton play est visible

  # ============================================================================
  # AC2: Contrôles de Lecture Audio
  # ============================================================================

  @AC2 @audio-playback
  Scénario: Lire audio avec contrôles de lecture
    Étant donné qu'une capture audio transcrite est ouverte
    Et que le fichier audio est chargé
    Quand l'utilisateur tape sur le bouton play
    Alors l'audio démarre immédiatement
    Et les contrôles de lecture sont visibles
    Et le bouton play devient pause
    Et la barre de progression s'affiche

  @AC2 @pause
  Scénario: Pause audio en lecture
    Étant donné que l'audio d'une capture est en cours de lecture
    Quand l'utilisateur tape sur le bouton pause
    Alors l'audio s'arrête
    Et le bouton pause devient play
    Et la position de lecture est conservée

  @AC2 @progress-bar
  Scénario: Afficher barre de progression
    Étant donné qu'une capture audio est en cours de lecture
    Et que la durée totale est 120 secondes
    Et que la position actuelle est 45 secondes
    Quand l'utilisateur regarde la barre de progression
    Alors le temps actuel "0:45" est affiché
    Et le temps total "2:00" est affiché
    Et la barre de progression indique 37.5% de progression

  @AC2 @simultaneous-audio-text
  Scénario: Écouter en lisant la transcription
    Étant donné qu'une capture audio transcrite est ouverte
    Et que l'audio est en cours de lecture
    Quand l'utilisateur scroll la transcription
    Alors l'audio continue de jouer
    Et le scroll fonctionne normalement
    Et l'utilisateur peut lire le texte pendant la lecture

  @AC2 @audio-state-persistence
  Scénario: Reprendre lecture après navigation
    Étant donné qu'une capture audio est en pause à 30 secondes
    Quand l'utilisateur navigue vers une autre vue
    Et revient à la capture
    Alors la position de lecture reste à 30 secondes
    Et le bouton play est disponible
    Et l'utilisateur peut reprendre la lecture

  # ============================================================================
  # AC3: Indicateur Transcription en Cours (Live Update)
  # ============================================================================

  @AC3 @transcription-in-progress
  Scénario: Afficher indicateur transcription en cours
    Étant donné qu'une capture audio est en cours de transcription
    Et que le statut est "TRANSCRIBING"
    Quand l'utilisateur ouvre la vue détail
    Alors un indicateur "Transcription in progress..." est affiché
    Et un spinner de chargement est visible
    Et aucun texte de transcription n'est affiché

  @AC3 @audio-during-transcription
  Scénario: Audio disponible pendant transcription
    Étant donné qu'une capture audio est en cours de transcription
    Quand l'utilisateur ouvre la vue détail
    Alors le fichier audio est chargé
    Et le bouton play est disponible
    Et l'utilisateur peut écouter l'audio pendant la transcription

  @AC3 @live-update
  Scénario: Live update quand transcription prête
    Étant donné qu'une capture audio est en cours de transcription
    Et que l'utilisateur a ouvert la vue détail
    Quand la transcription se termine avec succès
    Et que le statut passe à "TRANSCRIBED"
    Alors l'indicateur "Transcription in progress..." disparaît
    Et le texte transcrit apparaît automatiquement
    Et l'utilisateur n'a pas besoin de rafraîchir manuellement

  @AC3 @polling
  Scénario: Polling state change
    Étant donné qu'une capture est en cours de transcription
    Et que la vue détail observe les changements de statut
    Quand le statut est mis à jour en base de données
    Alors la vue détail détecte le changement
    Et met à jour l'UI automatiquement

  # ============================================================================
  # AC4: Gestion Transcription Échouée avec Retry
  # ============================================================================

  @AC4 @transcription-failed
  Scénario: Afficher erreur transcription échouée
    Étant donné qu'une transcription a échoué pour la capture "capture-456"
    Et que le statut est "TRANSCRIPTION_FAILED"
    Quand l'utilisateur ouvre la vue détail
    Alors un message "Transcription failed" est affiché
    Et aucun texte de transcription n'est visible
    Et le fichier audio reste disponible

  @AC4 @retry-button
  Scénario: Bouton retry disponible
    Étant donné qu'une transcription a échoué
    Quand l'utilisateur ouvre la vue détail
    Alors un bouton "Retry" est affiché
    Et le bouton est cliquable

  @AC4 @retry-action
  Scénario: Retry redémarre transcription
    Étant donné qu'une transcription a échoué pour "capture-456"
    Et que l'utilisateur ouvre la vue détail
    Quand l'utilisateur tape sur le bouton "Retry"
    Alors un nouveau job de transcription est créé dans la queue
    Et le statut de la capture passe à "TRANSCRIBING"
    Et l'indicateur "Transcription in progress..." s'affiche

  @AC4 @audio-after-failure
  Scénario: Audio lisible après échec
    Étant donné qu'une transcription a échoué
    Et que le fichier audio est "/audio/capture-456.m4a"
    Quand l'utilisateur ouvre la vue détail
    Alors le fichier audio est chargé dans le player
    Et l'utilisateur peut lire l'audio
    Et le fichier audio n'a pas été supprimé

  # ============================================================================
  # AC5: Fonctionnement Offline (FR23: Local Cache Compliance)
  # ============================================================================

  @AC5 @offline @FR23
  Scénario: Consulter transcription offline
    Étant donné que l'appareil est hors ligne
    Et qu'une capture audio transcrite existe en cache local
    Quand l'utilisateur ouvre la vue détail
    Alors la transcription est chargée depuis la base locale
    Et toutes les métadonnées sont affichées (timestamp, durée)
    Et le fichier audio est chargé depuis le stockage local
    Et aucun appel réseau n'est fait

  @AC5 @no-network-errors
  Scénario: Aucune erreur réseau offline
    Étant donné que l'appareil est hors ligne
    Et qu'une capture transcrite est ouverte
    Quand l'utilisateur consulte la transcription
    Alors aucun message "connection lost" n'est affiché
    Et aucune erreur réseau n'apparaît
    Et l'UI fonctionne normalement

  @AC5 @audio-playback-offline
  Scénario: Audio playback offline
    Étant donné que l'appareil est hors ligne
    Et qu'une capture audio transcrite est ouverte
    Quand l'utilisateur tape sur le bouton play
    Alors l'audio se lit depuis le stockage local
    Et aucun téléchargement réseau n'est tenté
    Et la lecture fonctionne normalement

  # ============================================================================
  # AC6: Captures Texte (Non-Audio) - Différenciation UI
  # ============================================================================

  @AC6 @text-capture
  Scénario: Afficher capture texte (non-audio)
    Étant donné qu'une capture de type "TEXT" existe
    Et que le contenu texte est "Ma pensée rapide"
    Quand l'utilisateur ouvre la vue détail
    Alors seul le contenu texte "Ma pensée rapide" est affiché
    Et aucune section transcription n'est visible
    Et aucun bouton audio play n'est affiché

  @AC6 @capture-type-badge
  Scénario: Différencier type capture dans UI
    Étant donné qu'une capture de type "TEXT" est ouverte
    Quand l'utilisateur regarde la vue détail
    Alors un badge "Text Capture" est affiché
    Et le type de capture est clairement indiqué

  # ============================================================================
  # AC7: Formatage du Texte et Caractères Spéciaux
  # ============================================================================

  @AC7 @line-breaks
  Scénario: Préserver sauts de ligne
    Étant donné qu'une transcription contient des sauts de ligne
    Et que le texte est "Première ligne\nDeuxième ligne\nTroisième ligne"
    Quand l'utilisateur ouvre la vue détail
    Alors le texte est affiché sur 3 lignes distinctes
    Et les sauts de ligne sont préservés visuellement

  @AC7 @special-characters
  Scénario: Afficher caractères spéciaux
    Étant donné qu'une transcription contient des accents et ponctuation
    Et que le texte est "Café, élève, à côté! Vraiment?"
    Quand l'utilisateur ouvre la vue détail
    Alors tous les accents (é, à, ô) sont affichés correctement
    Et la ponctuation (!, ?) est visible
    Et aucun caractère n'est corrompu

  @AC7 @long-text-scroll
  Scénario: Gérer texte long avec scroll
    Étant donné qu'une transcription contient 500 mots
    Quand l'utilisateur ouvre la vue détail
    Alors le texte scroll verticalement
    Et l'UI ne casse pas avec le texte long
    Et la lecture reste fluide

  @AC7 @readability
  Scénario: Optimiser lisibilité
    Étant donné qu'une transcription est affichée
    Quand l'utilisateur lit le texte
    Alors la taille de police est lisible
    Et l'espacement des lignes est confortable
    Et le contraste texte/fond est suffisant
