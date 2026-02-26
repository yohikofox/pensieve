Feature: Logs DevTools — Rotation FIFO (limite 100 entrées)
  En tant que développeur utilisant les DevTools en mode debug,
  Je veux que le système de logs soit limité à 100 entrées avec rotation FIFO automatique,
  Afin que l'app ne consomme pas de mémoire excessive tout en gardant les 100 entrées les plus récentes.

  Background:
    Given le store de logs est réinitialisé

  Scenario: Rotation FIFO — insertion de la 101ème entrée
    Given le store de logs contient exactement 100 entrées
    When une nouvelle entrée est ajoutée via addLog
    Then le store contient toujours exactement 100 entrées
    And la nouvelle entrée est la dernière dans le tableau
    And l'entrée la plus ancienne a été supprimée

  Scenario: Buffer sous seuil — pas de suppression
    Given le store de logs contient 50 entrées
    When une nouvelle entrée est ajoutée via addLog
    Then le store contient 51 entrées
    And toutes les entrées précédentes sont préservées

  Scenario: Préservation des logs les plus récents
    Given le store de logs est vide
    When 200 entrées sont ajoutées consécutivement via addLog
    Then le store contient exactement 100 entrées
    And les entrées conservées sont les 100 dernières insérées

  Scenario: Non-régression clearLogs après rotation
    Given le store de logs contient exactement 100 entrées
    When clearLogs est appelé
    Then le store est complètement vide
    And de nouvelles entrées peuvent être ajoutées normalement
