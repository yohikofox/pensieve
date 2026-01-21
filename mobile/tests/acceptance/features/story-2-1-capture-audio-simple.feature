# language: fr
@story-2.1 @epic-2
Fonctionnalité: Capture Audio 1-Tap
  En tant qu'utilisateur de Pensieve
  Je veux capturer mes pensées vocales en un seul tap
  Afin de sauvegarder rapidement mes idées sans friction

  @AC1 @performance @NFR1
  Scénario: Démarrer l'enregistrement avec latence minimale
    Étant donné que l'utilisateur "user-123" est authentifié
    Et le service d'enregistrement est initialisé
    Quand l'utilisateur démarre un enregistrement
    Alors l'enregistrement démarre en moins de 500ms
    Et une entité Capture est créée avec le statut "recording"

  @AC2
  Scénario: Sauvegarder un enregistrement de 2 secondes
    Étant donné que l'utilisateur "user-123" est authentifié
    Et le service d'enregistrement est initialisé
    Quand l'utilisateur enregistre pendant 2 secondes
    Et l'utilisateur arrête l'enregistrement
    Alors une Capture est sauvegardée avec le statut "CAPTURED"
    Et la durée est de 2000ms

  @AC5 @permissions
  Scénario: Vérifier les permissions avant d'enregistrer
    Étant donné que l'utilisateur "user-123" est authentifié
    Et le service d'enregistrement est initialisé
    Et les permissions microphone ne sont pas accordées
    Quand l'utilisateur tente de démarrer un enregistrement
    Alors une erreur MicrophonePermissionDenied est levée
