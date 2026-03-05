Feature: Verrouillage des actions pendant le traitement d'une capture
  En tant qu'utilisateur
  Je veux que les actions non pertinentes soient désactivées pendant un traitement actif
  Afin de ne pas déclencher d'actions conflictuelles sur une capture en cours

  # ============================================================================
  # AC1/AC2/AC6 — Guard isProcessing : état processing et file d'attente
  # ============================================================================

  Scenario: Capture en état processing — isProcessing retourne true
    Given une capture avec l'état "processing" et isInQueue à false
    When on évalue isProcessing pour cette capture
    Then le résultat est true
    And toutes les actions (sauf lecture) doivent être verrouillées

  Scenario: Capture en file d'attente — isProcessing retourne true
    Given une capture avec l'état "captured" et isInQueue à true
    When on évalue isProcessing pour cette capture
    Then le résultat est true
    And toutes les actions (sauf lecture) doivent être verrouillées

  Scenario: Capture en état captured sans queue — isProcessing retourne false
    Given une capture avec l'état "captured" et isInQueue à false
    When on évalue isProcessing pour cette capture
    Then le résultat est false
    And la transcription est autorisée

  Scenario: Capture en état ready — isProcessing retourne false
    Given une capture avec l'état "ready" et isInQueue à false
    When on évalue isProcessing pour cette capture
    Then le résultat est false

  # ============================================================================
  # AC5 — Retry autorisé uniquement en état failed
  # ============================================================================

  Scenario: Capture en état failed — isProcessing retourne false (retry autorisé)
    Given une capture avec l'état "failed" et isInQueue à false
    When on évalue isProcessing pour cette capture
    Then le résultat est false
    And le retry est autorisé (état failed)

  Scenario: Capture en état processing ET isInQueue — isProcessing retourne true
    Given une capture avec l'état "processing" et isInQueue à true
    When on évalue isProcessing pour cette capture
    Then le résultat est true

  # ============================================================================
  # Matrice d'états — cohérence globale
  # ============================================================================

  Scenario: Seul l'état processing et isInQueue === true verrouillent les actions
    Given les états de capture possibles sont "captured", "processing", "ready", "failed"
    When on évalue isProcessing pour chaque état sans file d'attente
    Then seul l'état "processing" retourne true
    And les états "captured", "ready", "failed" retournent false
