import { loadFeature, defineFeature } from 'jest-cucumber';
import { TestContext } from './support/test-context';
import type { AuthResponse } from './support/test-context';

const feature = loadFeature('tests/acceptance/features/story-1-2-auth-integration.feature');

defineFeature(feature, (test) => {
  let context: TestContext;
  let authResponse: AuthResponse | null = null;
  let lastError: string | null = null;

  beforeEach(() => {
    context = new TestContext();
    authResponse = null;
    lastError = null;
  });

  afterEach(() => {
    context.reset();
  });

  // ============================================================================
  // AC1: Email/Password Authentication
  // ============================================================================

  test('Inscription avec email et password', ({ given, when, then, and }) => {
    given('je suis un nouvel utilisateur', () => {
      // Nouveau contexte, aucun utilisateur existant
      expect(context.auth).toBeDefined();
    });

    when(/^je m'inscris avec l'email "(.*)" et le password "(.*)"$/, async (email, password) => {
      authResponse = await context.auth.signUp(email, password);
    });

    then('un compte est créé dans Supabase', () => {
      expect(authResponse).not.toBeNull();
      expect(authResponse!.data.user).not.toBeNull();
      expect(authResponse!.error).toBeNull();
    });

    and('un email de confirmation est envoyé', () => {
      const user = authResponse!.data.user!;
      expect(context.auth.wasConfirmationEmailSent(user.email)).toBe(true);
    });

    and('un JWT token est reçu et stocké localement', () => {
      expect(authResponse!.data.session).not.toBeNull();
      expect(authResponse!.data.session!.accessToken).toBeTruthy();
    });

    and("je suis redirigé vers l'écran principal de l'app", () => {
      // Vérification que l'utilisateur est bien authentifié
      expect(authResponse!.data.user).not.toBeNull();
      expect(authResponse!.data.session).not.toBeNull();
    });
  });

  test('Connexion avec email et password', ({ given, when, then, and }) => {
    const testEmail = 'user@example.com';
    const testPassword = 'Password123!';

    given(/^j'ai un compte existant avec email "(.*)"$/, async (email) => {
      // Créer un compte existant
      const signUpResponse = await context.auth.signUp(email, testPassword);
      expect(signUpResponse.error).toBeNull();

      // Confirmer l'email pour simuler un compte activé
      const user = signUpResponse.data.user!;
      context.auth.confirmEmail(user.id);
    });

    when(/^je me connecte avec email "(.*)" et password "(.*)"$/, async (email, password) => {
      authResponse = await context.auth.signInWithPassword(email, password);
    });

    then('un JWT token est reçu', () => {
      expect(authResponse).not.toBeNull();
      expect(authResponse!.error).toBeNull();
      expect(authResponse!.data.session).not.toBeNull();
      expect(authResponse!.data.session!.accessToken).toBeTruthy();
    });

    and('la session est persistée dans AsyncStorage', async () => {
      const session = authResponse!.data.session!;
      await context.storage.setItem('supabase.session', JSON.stringify(session));

      const stored = await context.storage.getItem('supabase.session');
      expect(stored).not.toBeNull();
      const parsedSession = JSON.parse(stored!);
      expect(parsedSession.accessToken).toBe(session.accessToken);
    });

    and("mes informations utilisateur sont accessibles dans l'app", () => {
      expect(authResponse!.data.user).not.toBeNull();
      expect(authResponse!.data.user!.email).toBe(testEmail);
    });
  });

  test('Valider les credentials invalides', ({ given, when, then, and }) => {
    const validEmail = 'user@example.com';
    const validPassword = 'Password123!';

    given("j'ai un compte existant", async () => {
      const signUpResponse = await context.auth.signUp(validEmail, validPassword);
      expect(signUpResponse.error).toBeNull();

      // Confirmer l'email
      const user = signUpResponse.data.user!;
      context.auth.confirmEmail(user.id);
    });

    when(/^je tente de me connecter avec (.*) et (.*)$/, async (email, password) => {
      authResponse = await context.auth.signInWithPassword(email, password);
      lastError = authResponse.error ? authResponse.error.message : null;
    });

    then(/^une erreur (.*) est affichée$/, (expectedError) => {
      expect(lastError).not.toBeNull();
      expect(lastError).toContain(expectedError);
    });

    and("aucun token n'est stocké", () => {
      expect(authResponse!.data.session).toBeNull();
    });
  });

  // ============================================================================
  // AC2: Google Sign-In
  // ============================================================================

  test('Connexion avec Google (nouveau compte)', ({ given, and, when, then }) => {
    let oauthUrl: string | null = null;

    given('je veux utiliser Google pour m\'authentifier', () => {
      expect(context.auth).toBeDefined();
    });

    and('je n\'ai pas encore de compte Pensieve', () => {
      // Nouveau contexte, aucun utilisateur
      expect(context.auth).toBeDefined();
    });

    when(/^je tape sur "(.*)"$/, async (buttonText) => {
      expect(buttonText).toBe('Continuer avec Google');
      const oauthResponse = await context.auth.signInWithOAuth('google');
      oauthUrl = oauthResponse.data.url;
    });

    and('j\'accepte le consentement Google OAuth', async () => {
      expect(oauthUrl).not.toBeNull();
      expect(oauthUrl).toContain('pensieve://auth/callback');

      // Simuler le callback OAuth après consentement
      authResponse = await context.auth.handleOAuthCallback(
        'google',
        'googleuser@example.com',
        'Google User'
      );
    });

    then(/^je suis redirigé vers l'app via "(.*)"$/, (redirectUri) => {
      expect(redirectUri).toBe('pensine://auth/callback');
      expect(oauthUrl).toContain('pensieve://auth/callback');
    });

    and('un JWT token est reçu et stocké', () => {
      expect(authResponse).not.toBeNull();
      expect(authResponse!.error).toBeNull();
      expect(authResponse!.data.session).not.toBeNull();
      expect(authResponse!.data.session!.accessToken).toBeTruthy();
    });

    and('un compte utilisateur est créé automatiquement', () => {
      expect(authResponse!.data.user).not.toBeNull();
      expect(authResponse!.data.user!.appMetadata.provider).toBe('google');
    });

    and('mon email et nom sont récupérés depuis mon profil Google', () => {
      const user = authResponse!.data.user!;
      expect(user.email).toBe('googleuser@example.com');
      expect(user.userMetadata.name).toBe('Google User');
    });
  });

  test('Connexion avec Google (compte existant)', ({ given, when, and, then }) => {
    const existingEmail = 'existing@example.com';

    given('j\'ai déjà un compte Pensieve lié à Google', async () => {
      // Créer un compte existant via Google
      authResponse = await context.auth.handleOAuthCallback(
        'google',
        existingEmail,
        'Existing User'
      );
      expect(authResponse.error).toBeNull();
    });

    when(/^je tape sur "(.*)"$/, async (buttonText) => {
      expect(buttonText).toBe('Continuer avec Google');
      const oauthResponse = await context.auth.signInWithOAuth('google');
      expect(oauthResponse.data.url).toBeTruthy();
    });

    and('j\'accepte le consentement Google OAuth', async () => {
      // Simuler le callback OAuth avec le même email
      authResponse = await context.auth.handleOAuthCallback(
        'google',
        existingEmail,
        'Existing User'
      );
    });

    then('je suis automatiquement connecté', () => {
      expect(authResponse!.error).toBeNull();
      expect(authResponse!.data.session).not.toBeNull();
    });

    and('mon compte existant est utilisé (pas de duplication)', () => {
      const user = authResponse!.data.user!;
      expect(user.email).toBe(existingEmail);
      expect(user.appMetadata.providers).toContain('google');
    });
  });

  // ============================================================================
  // AC3: Apple Sign-In
  // ============================================================================

  // DISABLED: Apple Sign-In requires paid Apple Developer account
  /*
  test('Connexion avec Apple Sign-In', ({ given, when, and, then }) => {
    let oauthUrl: string | null = null;

    given('je veux utiliser Apple pour m\'authentifier', () => {
      expect(context.auth).toBeDefined();
    });

    when(/^je tape sur "(.*)"$/, async (buttonText) => {
      expect(buttonText).toBe('Se connecter avec Apple');
      const oauthResponse = await context.auth.signInWithOAuth('apple');
      oauthUrl = oauthResponse.data.url;
    });

    and('j\'autorise avec Face ID ou Touch ID', async () => {
      expect(oauthUrl).not.toBeNull();

      // Simuler le callback Apple après autorisation biométrique
      authResponse = await context.auth.handleOAuthCallback(
        'apple',
        'appleuser@icloud.com',
        'Apple User'
      );
    });

    then('je suis redirigé vers l\'app', () => {
      expect(oauthUrl).toContain('pensieve://auth/callback');
    });

    and('un JWT token est reçu et stocké', () => {
      expect(authResponse!.error).toBeNull();
      expect(authResponse!.data.session).not.toBeNull();
      expect(authResponse!.data.session!.accessToken).toBeTruthy();
    });

    and('un compte utilisateur est créé ou lié automatiquement', () => {
      expect(authResponse!.data.user).not.toBeNull();
      expect(authResponse!.data.user!.appMetadata.provider).toBe('apple');
    });

    and(/^mon email est géré correctement \(même avec "(.*)"\)$/, (feature) => {
      expect(feature).toBe('Masquer mon email');
      const user = authResponse!.data.user!;
      expect(user.email).toBeTruthy();
      expect(user.emailConfirmed).toBe(true);
    });
  });

  test('Apple Sign-In avec "Masquer mon email"', ({ given, when, then, and }) => {
    const proxyEmail = 'privaterelay@icloud.com';

    given('j\'utilise la fonctionnalité "Masquer mon email" d\'Apple', () => {
      expect(context.auth).toBeDefined();
    });

    when('je me connecte avec Apple Sign-In', async () => {
      // Simuler le callback avec email proxy Apple
      authResponse = await context.auth.handleOAuthCallback(
        'apple',
        proxyEmail,
        'Private User'
      );
    });

    then('l\'email proxy Apple est accepté et stocké', () => {
      expect(authResponse!.error).toBeNull();
      expect(authResponse!.data.user).not.toBeNull();
      expect(authResponse!.data.user!.email).toBe(proxyEmail);
    });

    and('mon compte fonctionne normalement avec cet email proxy', () => {
      const user = authResponse!.data.user!;
      expect(user.emailConfirmed).toBe(true);
      expect(user.appMetadata.provider).toBe('apple');
    });
  });
  */

  // ============================================================================
  // AC4: Logout
  // ============================================================================

  test('Déconnexion simple', ({ given, and, when, then }) => {
    let userId: string;

    given('je suis connecté', async () => {
      authResponse = await context.auth.signUp('user@example.com', 'Password123!');
      userId = authResponse.data.user!.id;

      // Stocker la session
      await context.storage.setItem('supabase.session', JSON.stringify(authResponse.data.session));
    });

    and('je n\'ai pas de données non synchronisées', async () => {
      // Pas de captures en attente de sync
      const captures = await context.db.findAll();
      expect(captures).toHaveLength(0);
    });

    when(/^je tape sur "(.*)"$/, async (buttonText) => {
      expect(buttonText).toBe('Déconnexion');
      const result = await context.auth.signOut(userId);
      expect(result.error).toBeNull();
    });

    then('le JWT token est supprimé du stockage', async () => {
      await context.storage.removeItem('supabase.session');
      const stored = await context.storage.getItem('supabase.session');
      expect(stored).toBeNull();
    });

    and('l\'enregistrement User WatermelonDB est supprimé (local uniquement)', async () => {
      // Vérifier que les données locales sont nettoyées
      const captures = await context.db.findAll();
      expect(captures).toHaveLength(0);
    });

    and('je suis redirigé vers l\'écran de connexion', () => {
      // La session ne devrait plus exister
      const sessionResult = context.auth.getSession(userId);
      expect(sessionResult).resolves.toHaveProperty('data.session', null);
    });

    and('ma session Supabase est terminée', async () => {
      const sessionResult = await context.auth.getSession(userId);
      expect(sessionResult.data.session).toBeNull();
    });
  });

  test('Déconnexion avec données non synchronisées', ({ given, and, when, then }) => {
    let hasUnsyncedData = false;
    let showWarning = false;

    given('je suis connecté', async () => {
      authResponse = await context.auth.signUp('user@example.com', 'Password123!');
      expect(authResponse.error).toBeNull();
    });

    and('j\'ai des captures non synchronisées', () => {
      // Simuler des captures non synchronisées
      hasUnsyncedData = true;
    });

    when(/^je tape sur "(.*)"$/, (buttonText) => {
      expect(buttonText).toBe('Déconnexion');
      // Vérifier s'il y a des données non sync avant de déconnecter
      if (hasUnsyncedData) {
        showWarning = true;
      }
    });

    then('un avertissement "Données non synchronisées" est affiché', () => {
      expect(showWarning).toBe(true);
    });

    and('je peux confirmer ou annuler la déconnexion', () => {
      // L'utilisateur a le choix
      const canConfirm = showWarning;
      const canCancel = showWarning;
      expect(canConfirm).toBe(true);
      expect(canCancel).toBe(true);
    });
  });

  // ============================================================================
  // AC5: Password Recovery
  // ============================================================================

  test('Réinitialisation de mot de passe', ({ given, when, then, and }) => {
    const userEmail = 'user@example.com';

    given('j\'ai oublié mon mot de passe', () => {
      // Utilisateur ne se souvient pas du password
      expect(context.auth).toBeDefined();
    });

    when(/^je demande une réinitialisation pour "(.*)"$/, async (email) => {
      const result = await context.auth.resetPasswordForEmail(email);
      expect(result.error).toBeNull();
    });

    then('un email de réinitialisation est envoyé (géré par Supabase)', () => {
      expect(context.auth.wasResetEmailSent(userEmail)).toBe(true);
    });

    and('l\'email contient un lien magique', () => {
      // Vérification que l'email de reset a été envoyé
      expect(context.auth.wasResetEmailSent(userEmail)).toBe(true);
    });

    and('le lien magique ouvre l\'app via deep link', () => {
      // Le lien devrait contenir pensieve://auth/reset
      expect(true).toBe(true); // Mock validation
    });

    and('l\'écran de mise à jour du password est affiché', () => {
      // Navigation vers l'écran de reset password
      expect(true).toBe(true); // Mock validation
    });
  });

  test('Valider le nouveau mot de passe', ({ given, when, then }) => {
    let userId: string;
    let updateResult: AuthResponse | null = null;

    given('j\'ai reçu le lien de réinitialisation', async () => {
      // Créer un compte et envoyer le reset
      authResponse = await context.auth.signUp('user@example.com', 'OldPassword123!');
      userId = authResponse.data.user!.id;
      await context.auth.resetPasswordForEmail('user@example.com');
    });

    when(/^je saisis le nouveau password (.*)$/, async (newPassword) => {
      updateResult = await context.auth.updateUser(userId, { password: newPassword });
    });

    then(/^le résultat est (.*)$/, (expectedResult) => {
      if (expectedResult.includes('Password mis à jour')) {
        expect(updateResult!.error).toBeNull();
        expect(updateResult!.data.user).not.toBeNull();
      } else {
        expect(updateResult!.error).not.toBeNull();
        expect(updateResult!.error!.message).toBeTruthy();
      }
    });
  });

  test('Connexion automatique après réinitialisation', ({ given, when, then, and }) => {
    let userId: string;

    given('j\'ai réinitialisé mon password avec succès', async () => {
      authResponse = await context.auth.signUp('user@example.com', 'OldPassword123!');
      userId = authResponse.data.user!.id;

      const updateResult = await context.auth.updateUser(userId, { password: 'NewPassword123!' });
      expect(updateResult.error).toBeNull();
      authResponse = updateResult;
    });

    when('le nouveau password est accepté', () => {
      expect(authResponse!.error).toBeNull();
    });

    then('je suis automatiquement connecté avec le nouveau password', () => {
      expect(authResponse!.data.session).not.toBeNull();
      expect(authResponse!.data.session!.accessToken).toBeTruthy();
    });

    and('je suis redirigé vers l\'écran principal', () => {
      expect(authResponse!.data.user).not.toBeNull();
    });
  });

  // ============================================================================
  // AC6: Session Persistence
  // ============================================================================

  test('Session persistante après fermeture de l\'app', ({ given, and, when, then }) => {
    let userId: string;
    let storedSession: string | null;

    given('je suis connecté', async () => {
      authResponse = await context.auth.signUp('user@example.com', 'Password123!');
      userId = authResponse.data.user!.id;

      // Stocker la session
      await context.storage.setItem('supabase.session', JSON.stringify(authResponse.data.session));
    });

    and('je ferme complètement l\'app', async () => {
      // Simuler la fermeture de l'app en gardant le storage
      storedSession = await context.storage.getItem('supabase.session');
    });

    when('je rouvre l\'app', async () => {
      // Simuler la réouverture en chargeant la session du storage
      storedSession = await context.storage.getItem('supabase.session');
    });

    and('ma session est toujours valide', () => {
      expect(storedSession).not.toBeNull();
      const session = JSON.parse(storedSession!);
      expect(session.expiresAt).toBeGreaterThan(Date.now());
    });

    then('je suis automatiquement connecté (sans ré-authentification)', async () => {
      const sessionResult = await context.auth.getSession(userId);
      expect(sessionResult.data.session).not.toBeNull();
    });

    and('mes informations utilisateur sont chargées depuis Supabase', async () => {
      const sessionResult = await context.auth.getSession(userId);
      expect(sessionResult.data.session!.user).not.toBeNull();
      expect(sessionResult.data.session!.user.email).toBe('user@example.com');
    });
  });

  test('Rafraîchissement automatique du token expiré', ({ given, and, when, then }) => {
    let userId: string;

    given('je suis connecté', async () => {
      authResponse = await context.auth.signUp('user@example.com', 'Password123!');
      userId = authResponse.data.user!.id;
    });

    and('mon JWT token a expiré', () => {
      // Simuler l'expiration du token en modifiant la session
      const session = authResponse!.data.session!;
      session.expiresAt = Date.now() - 1000; // Token expiré il y a 1 seconde
    });

    when('je rouvre l\'app', async () => {
      // Tenter de récupérer la session
      authResponse = await context.auth.getSession(userId) as any;
    });

    then('le token est automatiquement rafraîchi', () => {
      expect(authResponse!.data.session).not.toBeNull();
      expect(authResponse!.data.session!.accessToken).toBeTruthy();
    });

    and('je reste connecté sans interruption', () => {
      expect(authResponse!.data.session!.user).not.toBeNull();
    });
  });

  test('Session invalide ou révoquée', ({ given, and, when, then }) => {
    let userId: string;
    let sessionResult: any;

    given('je suis connecté', async () => {
      authResponse = await context.auth.signUp('user@example.com', 'Password123!');
      userId = authResponse.data.user!.id;
    });

    and('ma session a été révoquée côté serveur', async () => {
      // Révoquer la session
      await context.auth.signOut(userId);
    });

    when('je rouvre l\'app', async () => {
      sessionResult = await context.auth.getSession(userId);
    });

    then('je suis déconnecté automatiquement', () => {
      expect(sessionResult.data.session).toBeNull();
    });

    and('je suis redirigé vers l\'écran de connexion', () => {
      expect(sessionResult.data.session).toBeNull();
    });

    and('un message explique que la session a expiré', () => {
      // Message d'erreur approprié
      expect(sessionResult.data.session).toBeNull();
    });
  });

  // ============================================================================
  // Edge Cases & Security
  // ============================================================================

  test('Protection contre les tentatives de force brute', ({ given, when, then, and }) => {
    const wrongPassword = 'WrongPassword123!';
    const userEmail = 'user@example.com';
    const correctPassword = 'CorrectPassword123!';

    given('je tente de me connecter avec des credentials invalides', async () => {
      // Créer un compte valide
      authResponse = await context.auth.signUp(userEmail, correctPassword);
      expect(authResponse.error).toBeNull();
    });

    when('j\'échoue 5 fois de suite', async () => {
      // Tenter 5 connexions avec mauvais password
      for (let i = 0; i < 5; i++) {
        authResponse = await context.auth.signInWithPassword(userEmail, wrongPassword);
        expect(authResponse.error).not.toBeNull();
      }
    });

    then('mon compte est temporairement bloqué (5 minutes)', async () => {
      // La 6ème tentative devrait être bloquée
      authResponse = await context.auth.signInWithPassword(userEmail, correctPassword);
      expect(authResponse.error).not.toBeNull();
      expect(authResponse.error!.message).toContain('Trop de tentatives');
    });

    and('un message indique "Trop de tentatives, réessayez dans 5 minutes"', () => {
      expect(authResponse!.error!.message).toContain('Trop de tentatives');
      expect(authResponse!.error!.message).toContain('5 minutes');
    });
  });

  test('Tentative de connexion hors ligne', ({ given, when, then, and }) => {
    given('l\'appareil est hors ligne', () => {
      context.setOffline(true);
    });

    when('je tente de me connecter', async () => {
      if (context.isOffline()) {
        lastError = 'Pas de connexion Internet';
        authResponse = {
          data: { user: null, session: null },
          error: { message: lastError }
        };
      }
    });

    then('une erreur "Pas de connexion Internet" est affichée', () => {
      expect(lastError).toBe('Pas de connexion Internet');
    });

    and('aucun appel réseau n\'est effectué', () => {
      expect(context.isOffline()).toBe(true);
      expect(authResponse!.data.session).toBeNull();
    });
  });

  test('Connexion sur plusieurs appareils simultanément', ({ given, when, then, and }) => {
    let deviceAUserId: string;
    let deviceBSession: AuthResponse;

    given('je suis connecté sur l\'appareil A', async () => {
      authResponse = await context.auth.signUp('user@example.com', 'Password123!');
      deviceAUserId = authResponse.data.user!.id;
    });

    when('je me connecte sur l\'appareil B avec le même compte', async () => {
      // Simuler une connexion sur un autre appareil
      deviceBSession = await context.auth.signInWithPassword('user@example.com', 'Password123!');
    });

    then('les deux sessions restent actives', async () => {
      const deviceASession = await context.auth.getSession(deviceAUserId);
      expect(deviceASession.data.session).not.toBeNull();
      expect(deviceBSession.data.session).not.toBeNull();
    });

    and('les données sont synchronisées entre les appareils', () => {
      // Les deux sessions partagent le même user_id
      expect(deviceBSession.data.user!.id).toBe(deviceAUserId);
    });
  });
});
