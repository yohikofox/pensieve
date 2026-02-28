# language: fr
Fonctionnalité: Guide Configuration Modèle LLM Si Absent
  En tant qu'utilisateur ayant activé la digestion IA mais sans modèle LLM téléchargé
  Je veux être guidé vers la configuration du modèle LLM
  Afin de comprendre pourquoi l'analyse n'est pas disponible et pouvoir y remédier

  Contexte:
    Étant donné que je suis un utilisateur authentifié
    Et que l'application est lancée
    Et que la digestion IA (post-processing) est activée dans les settings

  Scénario: Guide visible quand aucun modèle LLM n'est téléchargé
    Étant donné qu'aucun modèle LLM n'est téléchargé
    Et qu'une capture audio existe avec état "ready"
    Quand j'ouvre le détail de cette capture
    Alors je vois le banner "Modèle LLM requis" dans la section Analyse IA
    Et je vois le message "Téléchargez un modèle LLM pour activer l'analyse automatique"
    Et je vois le bouton "Configurer un modèle"
    Et les boutons d'analyse individuels ne sont PAS affichés

  Scénario: Navigation vers LLMSettings depuis le guide
    Étant donné qu'aucun modèle LLM n'est téléchargé
    Et que je vois le banner "Modèle LLM requis"
    Quand j'appuie sur "Configurer un modèle"
    Alors je suis navigué vers l'écran LLMSettings
    Et je peux voir la liste des modèles LLM disponibles

  Scénario: Guide absent quand modèle LLM disponible
    Étant donné qu'un modèle LLM est téléchargé
    Et qu'une capture audio existe avec état "ready"
    Quand j'ouvre le détail de cette capture
    Alors le banner "Modèle LLM requis" n'est PAS visible
    Et les boutons d'analyse normaux sont affichés

  Scénario: Guide absent quand digestion IA est désactivée
    Étant donné qu'aucun modèle LLM n'est téléchargé
    Et que la digestion IA est désactivée dans les settings
    Et qu'une capture audio existe avec état "ready"
    Quand j'ouvre le détail de cette capture
    Alors le banner "Modèle LLM requis" n'est PAS visible

  Scénario: hasLLMModelAvailable null en cas d'erreur de service
    Étant donné que ILLMModelService.getBestAvailableModel lève une erreur
    Et qu'une capture audio existe
    Quand j'ouvre le détail de cette capture
    Alors aucun banner LLM n'est affiché (état inconnu ignoré)
    Et aucune erreur visible à l'utilisateur
