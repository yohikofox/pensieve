Feature: First Launch Initializer — Défauts Automatiques sur Pixel 9+
  En tant qu'utilisateur sur un Pixel 9 ou supérieur,
  Je veux que l'application configure automatiquement les options optimales au premier lancement,
  Afin de bénéficier immédiatement de la reconnaissance native et de Gemma 3 1B MediaPipe.

  # AC1 + AC2-AC7 : Premier lancement Pixel 9 → native recognition activé + Gemma configuré
  Scenario: Premier lancement sur Pixel 9 — configuration optimale automatique
    Given l'utilisateur se connecte pour la première fois
    And l'appareil est un "Pixel 9" avec manufacturer "google" et generation "Tensor G4"
    When FirstLaunchInitializer.run() est appelé
    Then setSelectedEngineType est appelé avec "native"
    And setAutoTranscription est appelé avec true
    And downloadModel est appelé pour "gemma3-1b-mediapipe"
    And setModelForTask est appelé pour "postProcessing" avec "gemma3-1b-mediapipe"
    And setModelForTask est appelé pour "analysis" avec "gemma3-1b-mediapipe"
    And first_launch_completed est marqué "true"

  # AC1 : Second lancement → initializer no-op
  Scenario: Second lancement — initializer est un no-op
    Given first_launch_completed vaut déjà "true" dans AsyncStorage
    When FirstLaunchInitializer.run() est appelé
    Then aucun service n'est appelé
    And first_launch_completed reste "true"

  # AC8 : Premier lancement sur appareil non-Pixel → pas de changement
  Scenario: Premier lancement sur Samsung — aucune configuration automatique
    Given l'utilisateur se connecte pour la première fois
    And l'appareil est un "Samsung Galaxy S24" avec manufacturer "samsung" et generation "Exynos 2400"
    When FirstLaunchInitializer.run() est appelé
    Then setSelectedEngineType n'est pas appelé
    And setAutoTranscription n'est pas appelé
    And downloadModel n'est pas appelé
    And first_launch_completed est marqué "true"
