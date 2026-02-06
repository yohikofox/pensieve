Feature: Story 5.3 - Filtres et Tri des Actions

  As a user
  I want to filter and sort my actions by status, priority, and deadline
  So that I can focus on the most relevant todos for my current context

  Background:
    Given je suis un utilisateur authentifié
    And l'app mobile est lancée
    And je suis sur l'écran Actions

  # ==========================================================================
  # AC1: Filter Tabs Display
  # ==========================================================================

  Scenario: Affichage des tabs de filtres avec badges (AC1)
    Given j'ai 5 todos actives et 3 todos complétées
    When je regarde le haut de l'écran Actions
    Then je vois 3 tabs de filtres: "Toutes", "À faire", "Faites"
    And le tab "Toutes" affiche le badge "8"
    And le tab "À faire" affiche le badge "5"
    And le tab "Faites" affiche le badge "3"
    And le tab actuellement actif est visuellement mis en évidence

  # ==========================================================================
  # AC2: "À faire" Filter
  # ==========================================================================

  Scenario: Filtrer les todos actives uniquement (AC2)
    Given j'ai 4 todos actives et 2 todos complétées
    When je tape sur le tab "À faire"
    Then seules les 4 todos actives sont affichées
    And les todos complétées sont cachées
    And le tab "À faire" est visuellement actif
    And la liste s'actualise avec une animation fluide

  # ==========================================================================
  # AC3: "Faites" Filter
  # ==========================================================================

  Scenario: Filtrer les todos complétées uniquement (AC3)
    Given j'ai 3 todos actives et 4 todos complétées
    When je tape sur le tab "Faites"
    Then seules les 4 todos complétées sont affichées
    And toutes les todos affichent des checkboxes cochées
    And les descriptions ont un style barré (strikethrough)
    And les todos sont triées par date de complétion (plus récente en premier)

  Scenario: Décocher une todo complétée (AC3)
    Given je filtre par "Faites"
    And j'ai 2 todos complétées
    When je tape sur la checkbox d'une todo complétée
    Then la todo devient active (status='todo')
    And elle disparaît de la liste "Faites" avec animation
    And le badge "À faire" augmente de 1
    And le badge "Faites" diminue de 1

  # ==========================================================================
  # AC4: "Toutes" Filter
  # ==========================================================================

  Scenario: Afficher toutes les todos (AC4)
    Given j'ai 3 todos actives et 2 todos complétées
    When je tape sur le tab "Toutes"
    Then les 5 todos sont affichées
    And les todos actives apparaissent en premier
    And les todos complétées apparaissent ensuite
    And les deux sections sont visuellement séparées

  # ==========================================================================
  # AC5: Additional Sort Options
  # ==========================================================================

  Scenario: Accéder aux options de tri (AC5)
    Given je visualise la liste des actions
    When je tape sur le bouton "Trier"
    Then un menu s'ouvre avec 4 options de tri:
      | option             |
      | Par défaut         |
      | Par priorité       |
      | Par date de création |
      | Alphabétique       |
    And l'option actuellement active est cochée

  Scenario: Persistence du tri sélectionné (AC5)
    Given j'ai sélectionné le tri "Par priorité"
    When je quitte l'app et je reviens
    Then le tri "Par priorité" est toujours actif
    And mes préférences de tri sont restaurées

  # ==========================================================================
  # AC6: Sort by Priority
  # ==========================================================================

  Scenario: Trier par priorité (AC6)
    Given j'ai les todos suivantes:
      | description    | priority | deadline   |
      | Todo basse     | low      | tomorrow   |
      | Todo haute 1   | high     | next_week  |
      | Todo moyenne   | medium   | today      |
      | Todo haute 2   | high     | today      |
    When je sélectionne "Trier par priorité"
    Then les todos sont affichées dans cet ordre:
      | position | description  | justification                              |
      | 1        | Todo haute 2 | High priority, today (secondary: deadline) |
      | 2        | Todo haute 1 | High priority, next_week                   |
      | 3        | Todo moyenne | Medium priority                            |
      | 4        | Todo basse   | Low priority                               |
    And la liste se réordonne avec une animation fluide

  # ==========================================================================
  # AC7: Sort by Created Date
  # ==========================================================================

  Scenario: Trier par date de création (AC7)
    Given j'ai 4 todos créées à des moments différents
    When je sélectionne "Trier par date de création"
    Then les todos sont ordonnées chronologiquement (plus récentes en premier)
    And je vois le timestamp de création sur chaque carte
    And cela m'aide à identifier les tâches récentes ou anciennes

  # ==========================================================================
  # AC8: Filter and Sort State Persistence
  # ==========================================================================

  Scenario: Persistence des préférences filtre + tri (AC8)
    Given j'active le filtre "À faire"
    And je sélectionne le tri "Par priorité"
    When je change de tab (vers Capture par exemple)
    And je reviens sur l'écran Actions
    Then le filtre "À faire" est toujours actif
    And le tri "Par priorité" est toujours actif
    And la même vue est restaurée

  Scenario: Persistence après fermeture de l'app (AC8)
    Given j'active le filtre "Faites"
    And je sélectionne le tri "Par date de création"
    When je ferme complètement l'app
    And je relance l'app
    And je navigue vers l'écran Actions
    Then le filtre "Faites" est restauré
    And le tri "Par date de création" est restauré

  # ==========================================================================
  # AC9: Empty Filtered Results
  # ==========================================================================

  Scenario: État vide contextuel - Aucune todo active (AC9)
    Given j'ai uniquement des todos complétées (0 actives)
    When je filtre par "À faire"
    Then je vois l'état vide avec le message "Toutes vos actions sont terminées !"
    And une illustration encourageante
    And un bouton "Voir les actions complétées"

  Scenario: État vide contextuel - Aucune todo complétée (AC9)
    Given j'ai uniquement des todos actives (0 complétées)
    When je filtre par "Faites"
    Then je vois l'état vide avec le message "Aucune action complétée pour le moment"
    And un bouton "Voir les actions à faire"

  Scenario: État vide contextuel - Aucune todo du tout (AC9)
    Given je n'ai aucune todo
    When je filtre par "Toutes"
    Then je vois l'état vide avec le message "Vous n'avez aucune action pour le moment"
    And le message mentionne que les actions extraites apparaîtront ici

  # ==========================================================================
  # AC10: Real-Time Filter Updates
  # ==========================================================================

  Scenario: Mise à jour temps réel des badges (AC10)
    Given je suis sur le filtre "Toutes"
    And j'ai 3 todos actives et 2 complétées
    When je coche une todo active pour la compléter
    Then le badge "À faire" affiche immédiatement "2"
    And le badge "Faites" affiche immédiatement "3"
    And le badge "Toutes" reste à "5"

  Scenario: Animation lors du changement de statut (AC10 - filtre "Toutes")
    Given je suis sur le filtre "Toutes"
    When je coche une todo active
    Then la todo se déplace de la section "Actives" vers la section "Complétées"
    And le déplacement est animé de manière fluide
    And la checkbox montre l'animation de complétion

  Scenario: Disparition animée lors du changement de statut (AC10 - filtre "À faire")
    Given je suis sur le filtre "À faire"
    And j'ai 3 todos actives
    When je coche une todo pour la compléter
    Then la todo disparaît de la liste avec une animation de fade-out
    And le badge "À faire" diminue de 1
    And les autres todos se repositionnent avec animation
