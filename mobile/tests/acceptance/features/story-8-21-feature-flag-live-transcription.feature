# language: fr
@story-8.21 @epic-8 @feature-flag
Fonctionnalité: Feature flag — Transcription Live (OFF par défaut)
  En tant qu'administrateur
  Je veux contrôler l'activation du bouton Live par utilisateur
  Afin de déployer la feature progressivement

  # ============================================================================
  # AC2 — Bouton Live masqué si feature désactivée
  # ============================================================================

  @AC2 @feature-off
  Scénario: Bouton Live masqué si feature désactivée
    Étant donné que la feature "live_transcription" est désactivée pour l'utilisateur
    Quand l'utilisateur ouvre CaptureScreen
    Alors seuls les boutons "Voice" et "Text" sont affichés
    Et le bouton "Live" n'est pas visible

  # ============================================================================
  # AC3 — Bouton Live visible si feature activée
  # ============================================================================

  @AC3 @feature-on
  Scénario: Bouton Live visible si feature activée
    Étant donné que la feature "live_transcription" est activée pour l'utilisateur
    Quand l'utilisateur ouvre CaptureScreen
    Alors les boutons "Voice" "Text" et "Live" sont tous affichés
    Et le bouton "Live" est fonctionnel

  # ============================================================================
  # AC4 — Secure-by-default : feature absente → bouton masqué
  # ============================================================================

  @AC4 @offline @secure-by-default
  Scénario: Comportement offline — feature absente protège par défaut
    Étant donné que l'utilisateur est hors ligne avec un cache expiré
    Et que getFeature retourne undefined pour "live_transcription"
    Quand l'utilisateur ouvre CaptureScreen
    Alors le bouton "Live" n'est pas affiché
    Et aucune erreur n'est propagée à l'UI
