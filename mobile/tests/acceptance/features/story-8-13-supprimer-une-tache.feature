Feature: Supprimer une tâche (Story 8.13)
  En tant qu'utilisateur
  Je veux pouvoir supprimer définitivement une tâche individuelle
  Afin de garder ma liste d'actions propre

  Background:
    Given le dépôt de tâches est initialisé
    And une tâche "Appeler le client" existe dans la base de données locale

  Scenario: Suppression via la vue détail — la tâche disparaît de la DB (AC4, AC2, AC3)
    Given la tâche "Appeler le client" est présente dans la base de données
    When l'utilisateur confirme la suppression depuis la vue détail
    Then la tâche "Appeler le client" est absente de la base de données

  Scenario: Annulation depuis la vue détail — la tâche reste présente (AC2)
    Given la tâche "Appeler le client" est présente dans la base de données
    When l'utilisateur annule la suppression depuis la vue détail
    Then la tâche "Appeler le client" est toujours présente dans la base de données

  Scenario: Suppression via swipe — la tâche est définitivement supprimée (AC1, AC3)
    Given la tâche "Appeler le client" est présente dans la base de données
    When l'utilisateur effectue un swipe gauche et confirme la suppression
    Then la tâche "Appeler le client" est absente de la base de données
    And les compteurs de tâches sont mis à jour automatiquement

  Scenario: Non-régression corbeille — les tâches soft-deleted ne sont pas affectées (AC5)
    Given une tâche "Tâche générée par IA" avec statut soft-deleted existe dans la base de données
    When l'utilisateur supprime définitivement la tâche "Appeler le client"
    Then la tâche "Tâche générée par IA" soft-deleted est toujours présente dans la base de données
    And la tâche "Tâche générée par IA" soft-deleted a toujours le statut "deleted"
