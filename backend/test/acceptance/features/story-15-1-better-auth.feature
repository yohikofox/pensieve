# language: fr

Fonctionnalité: Story 15.1 - Better Auth Server NestJS + Resend Integration

  En tant que développeur
  Je veux configurer Better Auth sur le serveur NestJS avec Resend pour les emails transactionnels
  Afin d'avoir une authentification self-hosted sans dépendance à Supabase

  # ============================================================================
  # AC3 + AC9: EmailService avec Resend mocké
  # ============================================================================

  @AC3 @AC9 @email-service
  Scénario: Envoi d'un email de réinitialisation de mot de passe
    Étant donné que le service email est initialisé avec un client Resend mocké
    Quand je demande l'envoi d'un email de réinitialisation pour "user@example.com" avec l'URL "https://api.pensine.example.local/reset?token=abc"
    Alors le client Resend reçoit un appel d'envoi
    Et l'email est destiné à "user@example.com"
    Et le sujet de l'email contient "Réinitialisation"

  @AC3 @AC9 @email-service
  Scénario: Envoi d'un email de vérification d'adresse
    Étant donné que le service email est initialisé avec un client Resend mocké
    Quand je demande l'envoi d'un email de vérification pour "new@example.com" avec l'URL "https://api.pensine.example.local/verify?token=xyz"
    Alors le client Resend reçoit un appel d'envoi
    Et l'email est destiné à "new@example.com"
    Et le sujet de l'email contient "Vérif"

  @AC3 @AC9 @email-service @error-handling
  Scénario: Gestion d'une erreur d'envoi email
    Étant donné que le service email est initialisé avec un client Resend mocké
    Et que le client Resend est configuré pour échouer avec "SMTP Error"
    Quand je demande l'envoi d'un email de réinitialisation pour "user@example.com" avec l'URL "https://api.pensine.example.local/reset?token=abc"
    Alors le résultat est de type erreur réseau

  # ============================================================================
  # AC4: BetterAuthGuard
  # ============================================================================

  @AC4 @guard
  Scénario: Le guard autorise une requête avec une session valide
    Étant donné qu'une session valide existe pour l'utilisateur "user-uuid-42" avec l'email "user@example.com" et le rôle "user"
    Quand le guard évalue une requête avec le header "Bearer valid-session-token"
    Alors la requête est autorisée par le guard
    Et request.user contient l'userId "user-uuid-42"
    Et request.user contient l'email "user@example.com"

  @AC4 @guard
  Scénario: Le guard refuse une requête sans header Authorization
    Quand le guard évalue une requête sans header d'authentification
    Alors le guard lève une UnauthorizedException

  @AC4 @guard
  Scénario: Le guard refuse un token de session invalide
    Étant donné qu'aucune session n'existe pour le token "invalid-token-xyz"
    Quand le guard évalue une requête avec le header "Bearer invalid-token-xyz"
    Alors le guard lève une UnauthorizedException

  # ============================================================================
  # AC10: register, login, logout via Better Auth API
  # ============================================================================

  @AC10 @register
  Scénario: Inscription d'un nouvel utilisateur
    Étant donné que l'API Better Auth est disponible
    Quand je crée un compte avec l'email "newuser@example.com" et le mot de passe "P@ssword123"
    Alors l'API signUpEmail est appelée avec l'email "newuser@example.com"

  @AC10 @login
  Scénario: Connexion avec email et mot de passe valides
    Étant donné que l'API Better Auth est configurée pour retourner une session valide pour "user@example.com"
    Quand je me connecte avec l'email "user@example.com" et le mot de passe "P@ssword123"
    Alors l'API signInEmail est appelée avec l'email "user@example.com"
    Et une session est retournée

  @AC10 @logout
  Scénario: Déconnexion d'un utilisateur authentifié
    Étant donné qu'une session active existe avec le token "session-token-abc"
    Quand je me déconnecte en fournissant le header "Bearer session-token-abc"
    Alors l'API signOut est appelée
    Et la déconnexion est confirmée

  # ============================================================================
  # AC5: Better Auth Admin Plugin — listUsers, banUser, revokeUserSessions
  # ============================================================================

  @AC5 @admin-plugin
  Scénario: Lister les utilisateurs via le plugin admin
    Étant donné que l'API admin Better Auth est disponible
    Et que 2 utilisateurs existent dans Better Auth
    Quand je demande la liste des utilisateurs via l'API admin
    Alors l'API admin listUsers est appelée
    Et la réponse contient 2 utilisateurs

  @AC5 @admin-plugin
  Scénario: Bannir un utilisateur via le plugin admin
    Étant donné que l'API admin Better Auth est disponible
    Quand je banne l'utilisateur "user-uuid-99" pour la raison "Violation des CGU"
    Alors l'API admin banUser est appelée avec l'userId "user-uuid-99"

  @AC5 @admin-plugin
  Scénario: Révoquer les sessions d'un utilisateur via le plugin admin
    Étant donné que l'API admin Better Auth est disponible
    Quand je révoque toutes les sessions de l'utilisateur "user-uuid-99"
    Alors l'API admin revokeUserSessions est appelée avec l'userId "user-uuid-99"
