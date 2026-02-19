# language: fr
@story-13.4 @epic-13 @ADR-023
Fonctionnalité: Result Pattern — Généralisation à tous les contextes mobile (ADR-023)
  En tant que développeur
  Je veux que le Result Pattern soit disponible dans shared/domain/ et utilisé dans tous les contextes
  Afin que la gestion d'erreurs soit unifiée et qu'aucun throw ne soit utilisé hors frontières

  @AC2 @result-types
  Scénario: Les 8 types de résultat sont disponibles dans l'enum RepositoryResultType
    Étant donné que j'importe RepositoryResultType depuis shared/domain/Result
    Alors l'enum contient SUCCESS, NOT_FOUND, DATABASE_ERROR, VALIDATION_ERROR
    Et l'enum contient NETWORK_ERROR, AUTH_ERROR, BUSINESS_ERROR, UNKNOWN_ERROR

  @AC1 @backward-compat
  Scénario: Le contexte capture réexporte Result depuis shared/domain sans duplication
    Étant donné que j'importe success depuis capture/domain/Result
    Quand je crée un résultat de succès avec la donnée "test"
    Alors le résultat est de type SUCCESS
    Et la donnée est "test"

  @AC2 @helpers
  Scénario: notFound() retourne NOT_FOUND sans lever d'exception
    Étant donné que j'ai un message d'erreur "Ressource introuvable"
    Quand j'appelle notFound() avec ce message
    Alors le résultat est de type NOT_FOUND
    Et aucune exception n'est levée

  @AC2 @helpers
  Scénario: networkError() retourne NETWORK_ERROR avec le message d'erreur
    Étant donné que j'ai un message d'erreur "Connexion perdue"
    Quand j'appelle networkError() avec ce message
    Alors le résultat est de type NETWORK_ERROR
    Et le résultat contient le message d'erreur

  @AC4 @action
  Scénario: toggleStatus retourne SUCCESS avec le todo mis à jour
    Étant donné un mock de TodoRepository qui retourne un todo avec le statut "completed"
    Quand j'appelle toggleStatus avec l'id "todo-1"
    Alors le résultat est de type SUCCESS
    Et le résultat contient un todo avec le statut "completed"

  @AC4 @action
  Scénario: toggleStatus retourne NOT_FOUND sans lever d'exception quand le todo est absent
    Étant donné un mock de TodoRepository qui retourne NOT_FOUND pour l'id "todo-absent"
    Quand j'appelle toggleStatus avec l'id "todo-absent"
    Alors le résultat est de type NOT_FOUND
    Et aucune exception n'est levée
