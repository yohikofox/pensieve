Feature: Abandonner une tâche (Story 8.14)
  En tant qu'utilisateur
  Je veux pouvoir marquer une tâche comme "abandonnée" sans la supprimer définitivement
  Afin de préserver l'historique de mes décisions tout en gardant ma liste active propre

  Background:
    Given le dépôt de tâches est initialisé
    And une tâche "Appeler le client" avec le statut "todo" existe dans la base de données

  Scenario: Abandon via la vue détail — le statut passe à "abandoned" (AC3)
    Given la tâche "Appeler le client" a le statut "todo"
    When l'utilisateur abandonne la tâche depuis la vue détail
    Then la tâche "Appeler le client" a le statut "abandoned" dans la base de données
    And la tâche "Appeler le client" est toujours présente dans la base de données

  Scenario: Réactivation depuis la vue détail — le statut revient à "todo" (AC5)
    Given la tâche "Appeler le client" a le statut "abandoned"
    When l'utilisateur réactive la tâche depuis la vue détail
    Then la tâche "Appeler le client" a le statut "todo" dans la base de données

  Scenario: Abandon via swipe — le statut passe à "abandoned" (AC1)
    Given la tâche "Appeler le client" a le statut "todo"
    When l'utilisateur effectue un swipe gauche et tape "Abandonner"
    Then la tâche "Appeler le client" a le statut "abandoned" dans la base de données
    And la tâche n'est pas supprimée de la base de données

  Scenario: Filtre "Abandonnées" affiche uniquement les tâches abandonnées (AC4)
    Given une tâche "Préparer le rapport" avec le statut "todo" existe dans la base de données
    And une tâche "Envoyer email" avec le statut "abandoned" existe dans la base de données
    When l'utilisateur sélectionne le filtre "Abandonnées"
    Then seule la tâche "Envoyer email" est visible dans la liste filtrée
    And la tâche "Préparer le rapport" n'est pas visible dans la liste filtrée
    And la tâche "Appeler le client" n'est pas visible dans la liste filtrée
