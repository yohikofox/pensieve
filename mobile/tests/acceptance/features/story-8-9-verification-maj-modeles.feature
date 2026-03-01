# language: fr
@story-8.9 @epic-8
Fonctionnalité: Vérification Automatique des Mises à Jour des Modèles
  En tant qu'utilisateur ayant téléchargé des modèles LLM et/ou Whisper
  Je veux être notifié automatiquement quand une mise à jour est disponible
  Afin de maintenir mes modèles à jour sans les surveiller manuellement

  Contexte:
    Étant donné que je suis un utilisateur authentifié
    Et que j'ai au moins un modèle LLM téléchargé

  # ============================================================================
  # AC1 : Vérification automatique 1 fois par jour
  # ============================================================================

  @AC1 @auto-check
  Scénario: Vérification automatique au premier accès à l'écran (AC1)
    Étant donné que le modèle "Qwen2.5 3B" n'a jamais été vérifié
    Quand j'ouvre LLMSettingsScreen
    Alors la vérification est déclenchée automatiquement pour ce modèle
    Et la date de dernière vérification est enregistrée

  # ============================================================================
  # AC3 : Throttle — pas de re-vérification si déjà vérifiée aujourd'hui
  # ============================================================================

  @AC3 @throttle
  Scénario: Throttle — pas de re-vérification si déjà vérifiée aujourd'hui (AC3)
    Étant donné que le modèle "Qwen2.5 3B" a été vérifié aujourd'hui
    Quand le système évalue si une vérification est nécessaire
    Alors isCheckNeeded retourne false
    Et aucune requête réseau n'est effectuée

  # ============================================================================
  # AC5 : Notification push quand une mise à jour est disponible
  # ============================================================================

  @AC5 @update-notification
  Scénario: Détection mise à jour disponible → notification (AC5)
    Étant donné que le modèle "Qwen2.5 3B" a un ETag stocké "etag-v1"
    Et que la source retourne l'ETag "etag-v2" (différent)
    Quand la vérification est effectuée
    Alors le statut retourné est "update-available"
    Et une notification "Mise à jour disponible" est planifiée
    Et le badge "Update" s'affiche sur la carte du modèle

  # ============================================================================
  # AC2 : Bouton de vérification manuelle
  # ============================================================================

  @AC2 @manual-check
  Scénario: Vérification manuelle force le check (AC2)
    Étant donné que le modèle "Qwen2.5 3B" a été vérifié aujourd'hui
    Quand j'appuie sur le bouton "Vérifier les mises à jour"
    Alors la vérification est effectuée malgré le throttle
    Et le résultat est affiché immédiatement
