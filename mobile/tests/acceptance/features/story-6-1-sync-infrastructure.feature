# language: fr

Fonctionnalité: Infrastructure de Synchronisation WatermelonDB
  En tant qu'utilisateur mobile
  Je veux que mes données se synchronisent automatiquement avec le backend
  Afin d'avoir accès à mes captures sur tous mes appareils

  @story-6.1 @AC2 @AC5 @task-3.8
  Scénario: Sync réussit avec retry après network error
    Étant donné le backend sync est offline
    Et l'utilisateur crée une nouvelle capture "Première capture offline"
    Quand le SyncService tente de synchroniser
    Alors le sync échoue avec l'erreur "NETWORK_ERROR"
    Et un retry est schedulé avec délai Fibonacci de "1 seconde"
    Quand le backend sync revient online
    Et le SyncService tente de synchroniser à nouveau
    Alors le sync réussit
    Et la capture "Première capture offline" est synchronisée
    Et le compteur de retry est réinitialisé
