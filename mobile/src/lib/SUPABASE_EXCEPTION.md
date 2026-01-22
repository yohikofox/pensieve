# Supabase Exception - Result Pattern

**Date:** 2026-01-22
**Décision:** Exception autorisée pour Supabase SDK

## Justification

### Complexité du wrapper
- 10+ méthodes async à wrapper (signIn, signUp, signOut, etc.)
- Callback listeners (onAuthStateChange) incompatibles avec Result pattern
- Session management interne au SDK (AsyncStorage, refresh tokens)
- Types Supabase complexes à re-exposer

### Coût/Bénéfice
- **Coût:** ~200 lignes de boilerplate pour wrapper complet
- **Bénéfice limité:** Supabase SDK déjà stable, erreurs explicites
- **Alternative:** try/catch locaux autour appels Supabase = acceptable

## Règles d'usage

### ✅ Autorisé
```typescript
// Identity screens - try/catch autour Supabase
try {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    Alert.alert('Erreur', error.message);
    return;
  }

  // Success
} catch (error) {
  console.error('Supabase error:', error);
  Alert.alert('Erreur', 'Connexion impossible');
}
```

### ❌ Interdit
```typescript
// Ne PAS wrapper dans un AuthService custom avec Result pattern
// Trop complexe, coût > bénéfice
```

## Fichiers concernés

**Identity Context:**
- `src/contexts/identity/screens/LoginScreen.tsx`
- `src/contexts/identity/screens/RegisterScreen.tsx`
- `src/contexts/identity/screens/ForgotPasswordScreen.tsx`
- `src/contexts/identity/screens/ResetPasswordScreen.tsx`
- `src/contexts/identity/hooks/useDeepLinkAuth.ts`
- `src/contexts/identity/hooks/useAuthListener.ts`

**Settings:**
- `src/screens/settings/SettingsScreen.tsx`

## Autres exceptions documentées

1. **Database initialization** (`src/database/index.ts`)
   - Fail-fast si DB ne s'initialise pas

2. **Database operations** (`src/contexts/capture/data/CaptureRepository.ts`)
   - Try/catch autour de `database.execute()` (API externe OP-SQLite)
   - Log détaillé des erreurs SQL puis retour Result pattern
   - Exception autorisée car API externe, mais wrapped avec Result
   - **NOTE:** `database.transaction()` NOT USED - ne retourne pas la valeur du callback
   - SQLite a des transactions implicites par statement, donc sécurisé sans wrapper

3. **FileStorageService constructor** (`src/contexts/capture/services/FileStorageService.ts`)
   - Fail-fast si dossier audio ne peut être créé

4. **Navigation** - Exception (pas de wrapper)
5. **Gestures (react-native-gesture-handler)** - Exception (pas de wrapper)
