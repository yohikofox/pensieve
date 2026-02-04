# language: fr

Fonctionnalité: Story 4.2 - Digestion IA - Résumé et Idées Clés

  En tant qu'utilisateur
  Je veux que mes captures soient automatiquement analysées par l'IA pour générer un résumé concis et extraire les idées clés
  Afin que je puisse rapidement comprendre l'essence de mes pensées sans tout relire

  Contexte:
    Étant donné le backend est démarré
    Et RabbitMQ est accessible
    Et OpenAI API est accessible

  # ============================================================================
  # AC1: GPT-4o-mini Integration and Prompt Engineering
  # ============================================================================

  @AC1 @gpt-integration
  Scénario: Digestion d'un contenu court avec GPT-4o-mini
    Étant donné qu'un job de digestion est reçu avec un contenu de 100 mots
    Quand le service OpenAI traite le contenu
    Alors GPT-4o-mini est utilisé comme modèle (gpt-4o-mini)
    Et le timeout est configuré à 30 secondes
    Et la température est configurée à 0.7
    Et max_tokens est configuré à 500
    Et le résultat contient un summary de 2-3 phrases
    Et le résultat contient entre 3 et 10 ideas
    Et le résultat contient un niveau de confidence (high/medium/low)

  @AC1 @prompt-engineering
  Scénario: Validation du format JSON structuré avec Zod
    Étant donné qu'un job de digestion est reçu
    Quand le service OpenAI traite le contenu
    Alors la réponse GPT respecte le format JSON structuré
    Et le schema Zod valide le champ "summary" (10-500 caractères)
    Et le schema Zod valide le champ "ideas" (tableau de 1-10 éléments)
    Et le schema Zod valide chaque idea (5-200 caractères)
    Et le schema Zod valide le champ "confidence" (enum: high/medium/low)

  @AC1 @prompt-engineering @fallback
  Scénario: Fallback sur prompt plain-text si JSON échoue
    Étant donné qu'un job de digestion est reçu
    Et que le prompt principal JSON échoue
    Quand le service OpenAI utilise le fallback
    Alors un prompt plain-text est utilisé
    Et le niveau de confidence est downgraded à "medium"
    Et la réponse est parsée manuellement
    Et le résultat contient un summary valide
    Et le résultat contient des ideas valides

  # ============================================================================
  # AC2: Text Capture Digestion Flow
  # ============================================================================

  @AC2 @text-capture
  Scénario: Digestion d'une capture texte simple
    Étant donné qu'une capture texte "Réunion équipe: discuté roadmap Q1, priorité feature X, deadline mars" existe
    Quand un job de digestion est traité
    Alors le ContentExtractorService extrait le contenu texte brut
    Et le contentType est "text"
    Et le contenu est envoyé à GPT-4o-mini
    Et un Thought est créé avec le summary
    Et 3 Ideas sont créées
    Et le statut de la Capture est mis à jour à "digested"
    Et le temps de traitement est < 30 secondes

  @AC2 @text-capture @long
  Scénario: Digestion d'une capture texte longue avec chunking
    Étant donné qu'une capture texte de 10,000 mots existe
    Quand un job de digestion est traité
    Alors le ContentChunkerService détecte que le contenu dépasse 4000 tokens
    Et le contenu est divisé en chunks de 4000 tokens avec overlap de 200 tokens
    Et chaque chunk est traité séquentiellement par GPT-4o-mini
    Et les summaries sont fusionnés en un summary cohérent
    Et les ideas sont dédupliquées (seuil de similarité 0.8)
    Et wasChunked est true dans le résultat
    Et chunkCount est > 1

  # ============================================================================
  # AC3: Audio Capture Digestion Flow
  # ============================================================================

  @AC3 @audio-capture
  Scénario: Digestion d'une capture audio transcrite
    Étant donné qu'une capture audio a été transcrite par Whisper
    Et que la transcription contient "Idée pour nouvelle feature: système de tags pour organiser les captures"
    Quand un job de digestion est traité
    Alors le ContentExtractorService extrait la transcription
    Et le contentType est "audio"
    Et le prompt GPT adapte son style pour du contenu audio transcrit
    Et un Thought est créé avec le summary
    Et au moins 1 Idea est extraite
    Et le statut de la Capture est mis à jour à "digested"

  @AC3 @audio-capture @empty
  Scénario: Gestion du contenu audio vide ou invalide
    Étant donné qu'une capture audio a une transcription vide
    Quand un job de digestion est traité
    Alors le ContentExtractorService lève une exception "Empty content"
    Et le job échoue
    Et le statut de la Capture est mis à jour à "digestion_failed"
    Et l'erreur est loguée avec le message "Empty content: {captureId}"

  # ============================================================================
  # AC4: Thought and Ideas Persistence
  # ============================================================================

  @AC4 @persistence
  Scénario: Création atomique d'un Thought avec ses Ideas
    Étant donné qu'un job de digestion retourne un summary et 5 ideas
    Quand ThoughtRepository.createWithIdeas est appelé
    Alors un Thought est créé avec le summary
    Et 5 Ideas sont créées avec orderIndex (0-4)
    Et toutes les entités partagent le même userId et captureId
    Et la transaction est atomique (tout ou rien)
    Et un confidenceScore numérique est calculé (high=0.9, medium=0.6, low=0.3)
    Et processingTimeMs est enregistré

  @AC4 @persistence @rollback
  Scénario: Rollback en cas d'échec de création des Ideas
    Étant donné qu'un job de digestion retourne un summary et 3 ideas
    Et que la création de la 2ème Idea échoue
    Quand ThoughtRepository.createWithIdeas est appelé
    Alors la transaction est rollback
    Et aucun Thought n'est créé
    Et aucune Idea n'est créée
    Et une exception est levée

  @AC4 @persistence @event
  Scénario: Publication de l'événement DigestionCompleted
    Étant donné qu'un job de digestion se termine avec succès
    Quand le Thought et les Ideas sont créés
    Alors un événement "digestion.completed" est publié
    Et l'événement contient thoughtId
    Et l'événement contient captureId
    Et l'événement contient userId
    Et l'événement contient summary
    Et l'événement contient ideasCount
    Et l'événement contient processingTimeMs
    Et l'événement contient completedAt timestamp

  # ============================================================================
  # AC5: Real-Time Feed Update Notification
  # ============================================================================

  @AC5 @notification @skip-not-implemented
  Scénario: Notification temps-réel après digestion complétée
    Étant donné qu'un événement "digestion.completed" est publié
    Quand l'événement est reçu par le handler
    Alors une notification temps-réel est envoyée au client
    Et le Feed mobile est mis à jour automatiquement
    Et l'animation de germination est déclenchée

  # ============================================================================
  # AC6: Long Content Chunking Strategy
  # ============================================================================

  @AC6 @chunking
  Scénario: Détection automatique du besoin de chunking
    Étant donné qu'un contenu de 15,000 tokens est reçu
    Quand ContentChunkerService.processContent est appelé
    Alors le service détecte que le contenu dépasse maxTokensPerChunk (4000)
    Et le chunking est activé automatiquement
    Et le résultat contient wasChunked=true

  @AC6 @chunking @overlap
  Scénario: Chunking avec overlap pour préserver le contexte
    Étant donné qu'un contenu de 12,000 tokens est reçu
    Quand le contenu est divisé en chunks
    Alors chaque chunk contient max 4000 tokens
    Et chaque chunk (sauf le premier) commence avec 200 tokens du chunk précédent
    Et le nombre de chunks est calculé: ceil(12000 / 4000) = 3 chunks

  @AC6 @chunking @deduplication
  Scénario: Déduplication des ideas entre les chunks
    Étant donné que chunk 1 retourne ["Feature A", "Feature B"]
    Et que chunk 2 retourne ["Feature B", "Feature C"]
    Quand les ideas sont fusionnées
    Alors la similarité Jaccard est calculée pour chaque paire
    Et "Feature B" (identique) est dédupliquée
    Et le résultat final contient ["Feature A", "Feature B", "Feature C"]

  @AC6 @chunking @confidence
  Scénario: Downgrade de confidence pour contenu très long
    Étant donné qu'un contenu est divisé en 5 chunks
    Et que chaque chunk retourne confidence="high"
    Quand les résultats sont fusionnés
    Alors la confidence finale est downgraded à "medium"
    Et chunkCount (5) est supérieur à 3

  # ============================================================================
  # AC7: Error Handling and Retry Logic
  # ============================================================================

  @AC7 @error-handling
  Scénario: Retry automatique après échec temporaire (timeout)
    Étant donné qu'un job de digestion timeout après 30s
    Quand le job échoue
    Alors RabbitMQ requeue le job avec retry delay (5s → 15s → 45s)
    Et retryCount est incrémenté
    Et le job est retraité automatiquement

  @AC7 @error-handling @max-retries
  Scénario: Échec permanent après 3 tentatives
    Étant donné qu'un job échoue 3 fois consécutives
    Quand la 3ème tentative échoue
    Alors le statut de la Capture est mis à jour à "digestion_failed"
    Et un événement "digestion.job.failed" est publié
    Et le job est déplacé vers la dead-letter queue
    Et l'erreur est loguée avec stack trace

  @AC7 @error-handling @api-errors
  Scénario: Gestion des erreurs API OpenAI
    Étant donné qu'OpenAI retourne une erreur 429 (rate limit)
    Quand le job est traité
    Alors l'erreur est capturée et loguée
    Et le job est retenté avec exponential backoff
    Et le statut de la Capture reste "digesting" pendant le retry

  # ============================================================================
  # AC8: Low Confidence and Edge Cases
  # ============================================================================

  @AC8 @low-confidence
  Scénario: Détection de faible confidence sur contenu court
    Étant donné qu'un contenu de 3 mots "Acheter du lait" est reçu
    Quand GPT traite le contenu
    Alors le niveau de confidence retourné est "low"
    Et le confidenceScore est 0.3
    Et le Thought est créé avec cette confidence
    Et un flag UI indique la faible fiabilité

  @AC8 @low-confidence @ui-flag
  Scénario: Flag UI pour faible confidence
    Étant donné qu'un Thought a été créé avec confidence="low"
    Quand le Thought est affiché dans le Feed
    Alors un indicateur visuel signale la faible confidence
    Et l'utilisateur peut consulter le contenu original

  @AC8 @edge-cases @special-chars
  Scénario: Gestion des caractères spéciaux et émojis
    Étant donné qu'un contenu contient "🚀 Lancer projet 2026 💡 Idée géniale"
    Quand le job est traité
    Alors les émojis sont préservés dans le summary
    Et les caractères spéciaux ne causent pas d'erreur de parsing
    Et le résultat est valide

  @AC8 @edge-cases @code
  Scénario: Gestion du code source dans le contenu
    Étant donné qu'un contenu contient du code TypeScript
    """
    function hello() {
      console.log("Hello World");
    }
    """
    Quand le job est traité
    Alors le code est traité comme du texte brut
    Et le summary décrit l'intention du code
    Et les ideas extraient les concepts clés
