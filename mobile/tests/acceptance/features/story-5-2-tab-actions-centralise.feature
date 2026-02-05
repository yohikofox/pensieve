Feature: Story 5.2 - Tab Actions Centralisé

  As a user
  I want to access a dedicated "Actions" tab showing all my todos
  So that I can manage all my tasks in one centralized view

  Background:
    Given je suis un utilisateur authentifié
    And l'app mobile est lancée

  # ==========================================================================
  # AC1: Bottom Navigation with Actions Tab and Badge
  # ==========================================================================

  Scenario: Affichage du tab Actions avec badge (AC1)
    Given j'ai 3 todos actives
    When je regarde la barre de navigation
    Then je vois le tab "Actions"
    And le tab Actions affiche un badge avec le chiffre "3"

  Scenario: Badge s'actualise en temps réel (AC1)
    Given j'ai 5 todos actives
    And je suis sur le tab Actions
    When je coche une todo pour la compléter
    Then le badge du tab Actions affiche "4"

  # ==========================================================================
  # AC2: Navigate to Actions Screen
  # ==========================================================================

  Scenario: Navigation vers l'écran Actions (AC2)
    Given j'ai des todos actives
    When je tape sur le tab "Actions"
    Then je navigue vers l'écran Actions
    And toutes mes todos de toutes les captures sont affichées dans une liste unifiée

  # ==========================================================================
  # AC3: Default Grouping and Sorting
  # ==========================================================================

  Scenario: Grouping par défaut des todos (AC3)
    Given j'ai les todos suivantes:
      | description       | deadline    | priority |
      | Todo en retard    | yesterday   | high     |
      | Todo aujourd'hui  | today       | medium   |
      | Todo cette semaine| this_week   | low      |
      | Todo plus tard    | next_month  | high     |
      | Todo sans échéance| none        | medium   |
    When je visualise l'écran Actions
    Then les todos sont groupées dans cet ordre:
      | group                |
      | En retard           |
      | Aujourd'hui         |
      | Cette semaine       |
      | Plus tard           |
      | Pas d'échéance      |

  Scenario: Tri par priorité dans chaque groupe (AC3)
    Given j'ai 3 todos pour aujourd'hui avec les priorités:
      | description  | priority |
      | Todo basse   | low      |
      | Todo haute   | high     |
      | Todo moyenne | medium   |
    When je visualise l'écran Actions
    Then dans le groupe "Aujourd'hui", les todos sont triées:
      | position | description  |
      | 1        | Todo haute   |
      | 2        | Todo moyenne |
      | 3        | Todo basse   |

  # ==========================================================================
  # AC5: Empty State
  # ==========================================================================

  Scenario: Affichage de l'état vide (AC5)
    Given je n'ai aucune todo active
    When je visualise l'écran Actions
    Then je vois l'état vide avec le message "Votre jardin est paisible aujourd'hui"
    And une illustration reflétant la métaphore "Jardin d'idées"

  # ==========================================================================
  # AC6: Todo Card with Source Preview
  # ==========================================================================

  Scenario: Affichage du preview de la source (AC6)
    Given j'ai une todo avec l'idée source "Construire une app mobile React Native"
    When je visualise l'écran Actions
    Then la carte de la todo affiche un preview tronqué de l'idée
    And le preview ne dépasse pas 50 caractères
    And je vois le timestamp relatif "il y a 3 heures"

  # ==========================================================================
  # AC7: Pull to Refresh
  # ==========================================================================

  Scenario: Rafraîchir la liste avec pull-to-refresh (AC7)
    Given je suis sur l'écran Actions
    When je tire vers le bas pour rafraîchir
    Then l'animation de rafraîchissement s'affiche
    And la liste se synchronise avec les dernières données
    And les nouvelles todos apparaissent avec une animation subtile
