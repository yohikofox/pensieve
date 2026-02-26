# Story 7.3 : LLM Logs Analysis — Auto-generate GitHub Issues
#
# BDD Acceptance Tests couvrant AC1–AC9
# Run: npm run test:acceptance -- --testPathPattern="story-7-3"

Feature: LLM Logs Analysis — Auto-generate GitHub Issues

  Scenario: AC1 — Bouton visible quand debug mode actif et erreurs présentes
    Given le debug mode est activé
    And le store contient au moins 1 log d'erreur
    When j'évalue la visibilité du bouton Analyze
    Then le bouton Analyze est visible

  Scenario: AC9 — Bouton masqué quand debug mode désactivé
    Given le debug mode est désactivé
    And le store contient au moins 1 log d'erreur
    When j'évalue la visibilité du bouton Analyze
    Then le bouton Analyze n'est pas visible

  Scenario: AC2 — Extraction des logs d'erreur uniquement
    Given le store contient 5 logs d'erreur et 3 logs de niveau log
    When je groupe les logs d'erreur via LogsAnalysisService
    Then seuls 5 logs de niveau error sont retournés

  Scenario: AC2 — Limite à 20 erreurs les plus récentes
    Given le store contient 30 logs d'erreur
    When je groupe les logs d'erreur via LogsAnalysisService
    Then au plus 20 logs sont retournés

  Scenario: AC5 — Section Bug Reporting visible en debug mode
    Given le debug mode est activé
    When j'évalue la visibilité de la section Bug Reporting dans Settings
    Then la section Bug Reporting est visible

  Scenario: AC9 — Section Bug Reporting masquée sans debug mode
    Given le debug mode est désactivé
    When j'évalue la visibilité de la section Bug Reporting dans Settings
    Then la section Bug Reporting n'est pas visible

  Scenario: AC5 — SettingsStore persiste le repo GitHub
    Given le store de paramètres est initialisé
    When je configure githubRepo avec "owner/repo"
    Then githubRepo vaut "owner/repo" dans le store

  Scenario: AC6 — Création GitHub Issue via API
    Given un GitHub token est configuré dans SecureStore
    And une analyse LLM a produit un titre et un corps
    When je crée l'issue GitHub via GitHubIssueService
    Then l'issue est créée et l'URL est retournée

  Scenario: AC7 — Déduplication : issue similaire existante détectée
    Given un GitHub token est configuré dans SecureStore
    And une issue similaire existe dans le dépôt
    When je recherche une issue similaire via searchExistingIssue
    Then l'issue existante est retournée
