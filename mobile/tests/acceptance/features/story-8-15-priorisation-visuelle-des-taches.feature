Feature: Priorisation Visuelle des Tâches
  En tant qu'utilisateur
  Je veux identifier visuellement l'urgence de mes tâches grâce à des bordures colorées
  Afin de me concentrer sur ce qui est important sans lire chaque tâche

  Scenario: Tâche en retard affiche un niveau overdue
    Given a todo exists with a deadline in the past
    When I compute the urgency level
    Then the urgency level is "overdue"

  Scenario: Tâche prioritaire (priority=high) sans deadline affiche un niveau prioritaire
    Given a todo exists with priority "high" and no deadline
    When I compute the urgency level
    Then the urgency level is "prioritaire"

  Scenario: Tâche approchante (deadline dans 24h) affiche un niveau approaching
    Given a todo exists with a deadline within 24 hours
    When I compute the urgency level
    Then the urgency level is "approaching"

  Scenario: Tâche normale n'a pas d'urgence particulière
    Given a todo exists with priority "medium" and no deadline
    When I compute the urgency level
    Then the urgency level is "normal"

  Scenario: Précédence overdue sur prioritaire
    Given a todo exists with priority "high" and a deadline in the past
    When I compute the urgency level
    Then the urgency level is "overdue"

  Scenario: Précédence prioritaire sur approaching
    Given a todo exists with priority "high" and a deadline within 24 hours
    When I compute the urgency level
    Then the urgency level is "prioritaire"

  Scenario: Toggle prioritaire - medium devient high
    Given a todo exists with priority "medium" and no deadline
    When I toggle the priority
    Then the new priority is "high"

  Scenario: Toggle prioritaire - high devient medium
    Given a todo exists with priority "high" and no deadline
    When I toggle the priority
    Then the new priority is "medium"
