# language: fr
@story-1.2 @epic-1
Fonctionnalité: Authentification Better Auth (Email, Google, Apple)
  En tant qu'utilisateur
  Je veux m'authentifier avec email/password, Google, ou Apple
  Afin d'accéder de manière sécurisée à mon compte Pensieve

  # ============================================================================
  # AC1: Email/Password Authentication
  # ============================================================================

  @AC1 @email-auth @register
  Scénario: Inscription avec email et password
    Étant donné que je suis un nouvel utilisateur
    Quand je m'inscris avec l'email "user@example.com" et le password "Password123!"
    Alors un compte est créé dans le système d'authentification
    Et un email de confirmation est envoyé
    Et un JWT token est reçu et stocké localement
    Et je suis redirigé vers l'écran principal de l'app

  @AC1 @email-auth @login
  Scénario: Connexion avec email et password
    Étant donné que j'ai un compte existant avec email "user@example.com"
    Quand je me connecte avec email "user@example.com" et password "Password123!"
    Alors un JWT token est reçu
    Et la session est persistée dans AsyncStorage
    Et mes informations utilisateur sont accessibles dans l'app

  @AC1 @email-auth @validation
  Plan du scénario: Valider les credentials invalides
    Étant donné que j'ai un compte existant
    Quand je tente de me connecter avec <email> et <password>
    Alors une erreur <erreur> est affichée
    Et aucun token n'est stocké

    Exemples:
      | email               | password      | erreur                    |
      | wrong@example.com   | Password123!  | Email ou password invalide |
      | user@example.com    | WrongPass123! | Email ou password invalide |
      | invalid-email       | Password123!  | Format email invalide      |
      | user@example.com    | short         | Password trop court        |

  # ============================================================================
  # AC2: Google Sign-In
  # ============================================================================

  @AC2 @oauth @google
  Scénario: Connexion avec Google (nouveau compte)
    Étant donné que je veux utiliser Google pour m'authentifier
    Et que je n'ai pas encore de compte Pensieve
    Quand je tape sur "Continuer avec Google"
    Et j'accepte le consentement Google OAuth
    Alors je suis redirigé vers l'app via "pensine://auth/callback"
    Et un JWT token est reçu et stocké
    Et un compte utilisateur est créé automatiquement
    Et mon email et nom sont récupérés depuis mon profil Google

  @AC2 @oauth @google @existing-account
  Scénario: Connexion avec Google (compte existant)
    Étant donné que j'ai déjà un compte Pensieve lié à Google
    Quand je tape sur "Continuer avec Google"
    Et j'accepte le consentement Google OAuth
    Alors je suis automatiquement connecté
    Et mon compte existant est utilisé (pas de duplication)

  # ============================================================================
  # AC3: Apple Sign-In
  # ============================================================================

  # DISABLED: Apple Sign-In requires paid Apple Developer account
  # @AC3 @oauth @apple
  # Scénario: Connexion avec Apple Sign-In
  #   Étant donné que je veux utiliser Apple pour m'authentifier
  #   Quand je tape sur "Se connecter avec Apple"
  #   Et j'autorise avec Face ID ou Touch ID
  #   Alors je suis redirigé vers l'app
  #   Et un JWT token est reçu et stocké
  #   Et un compte utilisateur est créé ou lié automatiquement
  #   Et mon email est géré correctement (même avec "Masquer mon email")

  # DISABLED: Apple Sign-In requires paid Apple Developer account
  # @AC3 @oauth @apple @hide-email
  # Scénario: Apple Sign-In avec "Masquer mon email"
  #   Étant donné que j'utilise la fonctionnalité "Masquer mon email" d'Apple
  #   Quand je me connecte avec Apple Sign-In
  #   Alors l'email proxy Apple est accepté et stocké
  #   Et mon compte fonctionne normalement avec cet email proxy

  # ============================================================================
  # AC4: Logout
  # ============================================================================

  @AC4 @logout
  Scénario: Déconnexion simple
    Étant donné que je suis connecté
    Et que je n'ai pas de données non synchronisées
    Quand je tape sur "Déconnexion"
    Alors le JWT token est supprimé du stockage
    Et l'enregistrement User WatermelonDB est supprimé (local uniquement)
    Et je suis redirigé vers l'écran de connexion
    Et ma session est terminée

  @AC4 @logout @unsynced-data
  Scénario: Déconnexion avec données non synchronisées
    Étant donné que je suis connecté
    Et que j'ai des captures non synchronisées
    Quand je tape sur "Déconnexion"
    Alors un avertissement "Données non synchronisées" est affiché
    Et je peux confirmer ou annuler la déconnexion

  # ============================================================================
  # AC5: Password Recovery
  # ============================================================================

  @AC5 @password-recovery
  Scénario: Réinitialisation de mot de passe
    Étant donné que j'ai oublié mon mot de passe
    Quand je demande une réinitialisation pour "user@example.com"
    Alors un email de réinitialisation est envoyé
    Et l'email contient un lien magique
    Et le lien magique ouvre l'app via deep link
    Et l'écran de mise à jour du password est affiché

  @AC5 @password-recovery @validation
  Plan du scénario: Valider le nouveau mot de passe
    Étant donné que j'ai reçu le lien de réinitialisation
    Quand je saisis le nouveau password <nouveau_password>
    Alors le résultat est <résultat>

    Exemples:
      | nouveau_password | résultat                                          |
      | NewPass123!      | Password mis à jour, connecté automatiquement   |
      | short            | Erreur: Minimum 8 caractères                    |
      | nouppercase1     | Erreur: Au moins 1 majuscule requise            |
      | NoNumber!        | Erreur: Au moins 1 chiffre requis               |

  @AC5 @password-recovery @auto-login
  Scénario: Connexion automatique après réinitialisation
    Étant donné que j'ai réinitialisé mon password avec succès
    Quand le nouveau password est accepté
    Alors je suis automatiquement connecté avec le nouveau password
    Et je suis redirigé vers l'écran principal

  # ============================================================================
  # AC6: Session Persistence
  # ============================================================================

  @AC6 @session @persistence
  Scénario: Session persistante après fermeture de l'app
    Étant donné que je suis connecté
    Et que je ferme complètement l'app
    Quand je rouvre l'app
    Et que ma session est toujours valide
    Alors je suis automatiquement connecté (sans ré-authentification)
    Et mes informations utilisateur sont chargées depuis le serveur

  @AC6 @session @token-refresh
  Scénario: Rafraîchissement automatique du token expiré
    Étant donné que je suis connecté
    Et que mon JWT token a expiré
    Quand je rouvre l'app
    Alors le token est automatiquement rafraîchi
    Et je reste connecté sans interruption

  @AC6 @session @invalid-session
  Scénario: Session invalide ou révoquée
    Étant donné que je suis connecté
    Et que ma session a été révoquée côté serveur
    Quand je rouvre l'app
    Alors je suis déconnecté automatiquement
    Et je suis redirigé vers l'écran de connexion
    Et un message explique que la session a expiré

  # ============================================================================
  # Edge Cases & Security
  # ============================================================================

  @edge-case @security @rate-limiting
  Scénario: Protection contre les tentatives de force brute
    Étant donné que je tente de me connecter avec des credentials invalides
    Quand j'échoue 5 fois de suite
    Alors mon compte est temporairement bloqué (5 minutes)
    Et un message indique "Trop de tentatives, réessayez dans 5 minutes"

  @edge-case @network @offline
  Scénario: Tentative de connexion hors ligne
    Étant donné que l'appareil est hors ligne
    Quand je tente de me connecter
    Alors une erreur "Pas de connexion Internet" est affichée
    Et aucun appel réseau n'est effectué

  @edge-case @session @multiple-devices
  Scénario: Connexion sur plusieurs appareils simultanément
    Étant donné que je suis connecté sur l'appareil A
    Quand je me connecte sur l'appareil B avec le même compte
    Alors les deux sessions restent actives
    Et les données sont synchronisées entre les appareils
