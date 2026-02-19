# language: fr
@story-13.1 @epic-13 @ADR-021
Fonctionnalité: Container DI — Cycle de vie Transient First (ADR-021)
  En tant que développeur
  Je veux que le container DI applique la stratégie Transient First (ADR-021)
  Afin d'éviter les états partagés cachés et d'améliorer la testabilité des services

  @AC1 @transient
  Scénario: Un repository stateless retourne une nouvelle instance à chaque résolution
    Étant donné que le container DI est initialisé avec un repository Transient
    Quand je résous le repository deux fois successivement
    Alors j'obtiens deux instances distinctes du repository

  @AC2 @transient
  Scénario: Un service stateless retourne une nouvelle instance à chaque résolution
    Étant donné que le container DI est initialisé avec un service Transient
    Quand je résous le service deux fois successivement
    Alors j'obtiens deux instances distinctes du service

  @AC3 @singleton
  Scénario: Un service avec état conserve la même instance via le cycle de vie Singleton
    Étant donné que le container DI est initialisé avec un service Singleton justifié
    Quand je résous le service deux fois successivement
    Alors j'obtiens la même instance du service

  @AC3 @singleton @documentation
  Scénario: Un service Transient avec une dépendance Singleton partage bien la dépendance
    Étant donné que le container DI est initialisé avec un Singleton comme dépendance partagée
    Et un service Transient qui dépend de ce Singleton
    Quand je résous le service Transient deux fois successivement
    Alors les deux instances du service sont différentes
    Mais leurs dépendances Singleton sont identiques

  @AC5 @lazy-resolution
  Scénario: La résolution lazy dans les hooks React retourne correctement les services
    Étant donné que le container DI est initialisé avec un service Transient
    Quand je résous le service via une fonction de résolution lazy
    Et j'appelle la fonction de résolution lazy deux fois
    Alors chaque appel retourne une nouvelle instance du service Transient
