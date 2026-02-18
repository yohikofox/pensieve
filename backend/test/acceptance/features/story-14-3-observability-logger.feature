Feature: Structured Logging and Observability Backend
  As a developer
  I want the backend to produce structured JSON logs
  So that I can monitor and debug the application in production (ADR-015)

  Background:
    Given the observability infrastructure is initialized

  # AC1: Logger structuré NestJS
  Scenario: Structured log entries contain required JSON fields
    Given a service logs an info message with context "TestService"
    When the log entry is captured
    Then the log entry has a "level" field
    And the log entry has a "msg" field
    And the log entry has a "time" field
    And the log entry has a "context" field with value "TestService"

  Scenario: Logger supports all required log levels
    Given a structured logger is active
    When messages are logged at "info" level
    And messages are logged at "warn" level
    And messages are logged at "error" level
    Then all three log levels produce entries with the correct level field

  Scenario: Existing NestJS Logger calls remain compatible
    Given a service uses "new Logger(ClassName.name)" pattern
    When a log.warn call is made with a message
    Then the log entry is captured with level "warn"
    And the message field contains the expected text

  # AC4: Vérification format Prometheus
  Scenario: Prometheus metrics endpoint returns valid format
    Given the queue monitoring service has tracked some metrics
    When the Prometheus metrics are requested
    Then the output contains "# HELP" lines
    And the output contains "# TYPE" lines
    And the output contains metric "digestion_queue_depth"
    And the output contains metric "digestion_jobs_processed_total"
    And the output contains metric "digestion_jobs_failed_total"
