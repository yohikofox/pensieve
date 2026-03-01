# language: fr
@story-8.8 @epic-8
Fonctionnalité: Suggestion de suppression des modèles inutilisés
  En tant qu'utilisateur ayant téléchargé plusieurs modèles
  Je veux être alerté quand un modèle n'a pas été utilisé depuis 15 jours
  Afin de libérer de l'espace disque en supprimant les modèles inutiles

  Contexte:
    Étant donné que je suis un utilisateur authentifié
    Et que le service ModelUsageTrackingService est initialisé

  # ============================================================================
  # AC1 : Tracking de la date de dernière utilisation — LLM
  # ============================================================================

  @AC1 @tracking-llm
  Scénario: Date de dernière utilisation initialisée au téléchargement LLM
    Étant donné que le modèle LLM "qwen2.5-0.5b" n'est pas téléchargé
    Quand le téléchargement du modèle se termine avec succès
    Alors la date de dernière utilisation est enregistrée avec la date actuelle
    Et la clé "@pensieve/model_last_used_llm_qwen2.5-0.5b" existe en AsyncStorage

  @AC1 @tracking-selection
  Scénario: Date de dernière utilisation mise à jour à la sélection
    Étant donné que le modèle LLM "qwen2.5-0.5b" a une lastUsed date de il y a 10 jours
    Quand l'utilisateur sélectionne le modèle "qwen2.5-0.5b" pour une tâche
    Alors la date de dernière utilisation est mise à jour à la date actuelle
    Et le modèle n'apparaît plus dans la liste des modèles inutilisés

  # ============================================================================
  # AC3 : Détection des modèles inutilisés après 15 jours
  # ============================================================================

  @AC3 @detection-unused
  Scénario: Modèle LLM identifié comme inutilisé après 15 jours
    Étant donné que le modèle LLM "qwen2.5-3b" est téléchargé sur le disque
    Et que sa date de dernière utilisation est il y a 16 jours
    Et que l'alerte n'a pas été ignorée
    Quand le système vérifie les modèles inutilisés
    Alors le modèle "qwen2.5-3b" est retourné dans la liste des modèles inactifs
    Et le nombre de jours est "16"

  @AC3 @detection-active
  Scénario: Modèle LLM non identifié si utilisé il y a 14 jours
    Étant donné que le modèle LLM "smollm-135m" est téléchargé sur le disque
    Et que sa date de dernière utilisation est il y a 14 jours
    Quand le système vérifie les modèles inutilisés
    Alors le modèle "smollm-135m" n'est pas dans la liste des modèles inactifs

  @AC3 @detection-no-lastused
  Scénario: Modèle sans lastUsed — comportement prudent
    Étant donné que le modèle LLM "qwen2.5-3b" est téléchargé sur le disque
    Et qu'aucune clé "lastUsed" n'existe pour ce modèle
    Et que le stat du fichier n'est pas disponible
    Quand le système vérifie les modèles inutilisés
    Alors le modèle "qwen2.5-3b" n'est PAS dans la liste des modèles inactifs

  # ============================================================================
  # AC6 : Action "Supprimer" depuis l'alerte
  # ============================================================================

  @AC6 @delete-from-alert
  Scénario: Suppression d'un modèle depuis l'alerte
    Étant donné que le modèle "qwen2.5-3b" affiche une alerte d'inactivité
    Quand l'utilisateur confirme la suppression
    Alors le fichier du modèle est supprimé du disque
    Et les clés AsyncStorage du modèle sont supprimées
    Et la carte du modèle passe en état "Non téléchargé"

  # ============================================================================
  # AC7 : Action "Ignorer" depuis l'alerte
  # ============================================================================

  @AC7 @dismiss-alert
  Scénario: Ignorer une alerte — ne réapparaît pas
    Étant donné que le modèle "qwen2.5-3b" affiche une alerte d'inactivité
    Quand l'utilisateur appuie sur "Ignorer"
    Alors la clé de dismissal est créée en AsyncStorage
    Et le modèle ne réapparaît pas dans la liste des modèles inactifs lors des visites suivantes
