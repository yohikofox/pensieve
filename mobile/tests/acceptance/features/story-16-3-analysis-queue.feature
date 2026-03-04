Feature: Queue d'Analyses Asynchrone
  En tant qu'utilisateur
  Je veux que les demandes d'analyse LLM s'exécutent en file d'attente séquentielle en arrière-plan
  Afin de ne plus subir de crashs lors d'analyses simultanées

  Scenario: Enqueue simple - la demande retourne immédiatement
    Given the analysis queue is empty
    When the user requests a "summary" analysis for capture "cap-1"
    Then the item is added to the analysis queue
    And the enqueue call returns immediately without blocking

  Scenario: Dédoublonnage - une demande identique est ignorée
    Given a "summary" analysis for capture "cap-1" is already in the queue
    When the user requests another "summary" analysis for capture "cap-1"
    Then the queue still contains exactly 1 item for "cap-1" and type "summary"

  Scenario: Traitement séquentiel - les analyses s'exécutent une par une
    Given the analysis queue is empty
    And the analysis service takes some time to complete
    When the user enqueues a "summary" analysis for capture "cap-1"
    And the user enqueues a "highlights" analysis for capture "cap-1"
    Then the analyses are processed one at a time without concurrency

  Scenario: Notification de complétion via EventBus
    Given the analysis queue is empty
    And the analysis service will succeed for capture "cap-2" type "summary"
    When the user requests a "summary" analysis for capture "cap-2"
    And the analysis completes
    Then an "AnalysisCompleted" event is emitted on the EventBus
    And the event payload contains captureId "cap-2" and analysisType "summary"

  Scenario: Gestion d'erreur - l'item est retiré et analysis.failed est émis
    Given the analysis queue is empty
    And the analysis service will fail for capture "cap-err" type "summary"
    When the user requests a "summary" analysis for capture "cap-err"
    And the analysis fails
    Then an "AnalysisFailed" event is emitted on the EventBus
    And the queue continues processing next items
