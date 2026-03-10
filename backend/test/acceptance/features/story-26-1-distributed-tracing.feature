Feature: Distributed Tracing — Propagation de contexte de trace
  En tant que développeur backend
  Je veux que chaque requête HTTP soit associée à un traceId unique
  Afin de corréler les logs entre les composants (HTTP, RabbitMQ, MCP)

  Background:
    Given le TraceContext est initialisé

  Scenario: Aucun header X-Trace-ID — un UUID est généré automatiquement
    Given une requête entrante sans header "X-Trace-ID"
    When le middleware de trace est exécuté
    Then un traceId de type UUID v4 est généré
    And le header de réponse "X-Trace-ID" contient ce traceId
    And le contexte AsyncLocalStorage expose ce traceId

  Scenario: Header X-Trace-ID présent — il est propagé tel quel
    Given une requête entrante avec le header "X-Trace-ID" valant "test-trace-123"
    When le middleware de trace est exécuté
    Then le traceId du contexte est "test-trace-123"
    And le header de réponse "X-Trace-ID" vaut "test-trace-123"

  Scenario: Aucun header X-Request-Source — la source par défaut est "unknown"
    Given une requête entrante sans header "X-Request-Source"
    When le middleware de trace est exécuté
    Then la source du contexte est "unknown"

  Scenario: Header X-Request-Source présent — il est propagé
    Given une requête entrante avec le header "X-Request-Source" valant "mcp"
    When le middleware de trace est exécuté
    Then la source du contexte est "mcp"

  Scenario: Le mixin Pino injecte traceId et source dans les logs HTTP
    Given un contexte de trace actif avec traceId "trace-mixin-test" et source "http"
    When les champs de mixin Pino sont calculés
    Then le mixin contient "traceId" avec la valeur "trace-mixin-test"
    And le mixin contient "source" avec la valeur "http"

  Scenario: Le mixin Pino retourne un objet vide hors contexte HTTP (RabbitMQ)
    Given aucun contexte de trace actif (job RabbitMQ)
    When les champs de mixin Pino sont calculés
    Then le mixin est un objet vide
