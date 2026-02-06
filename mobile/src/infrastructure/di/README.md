# Dependency Injection Helper

Utilitaires centralisés pour la résolution des dépendances du container DI (tsyringe).

## Utilisation

### Import

```typescript
import { DI } from '@/infrastructure/di';
// ou
import { resolve, resolveOptional, isRegistered } from '@/infrastructure/di';
```

### Résolution obligatoire

Utiliser `DI.resolve()` quand la dépendance **doit** être présente. Lance une erreur si non trouvée.

```typescript
const repository = DI.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
const queueService = DI.resolve(TranscriptionQueueService);
```

### Résolution optionnelle

Utiliser `DI.resolveOptional()` pour les dépendances optionnelles (retourne `null` si non trouvée).

```typescript
const syncService = DI.resolveOptional<ISyncService>(TOKENS.ISyncService);

if (syncService) {
  await syncService.syncCaptures();
} else {
  // Service pas encore implémenté, fallback sur logique locale
  await loadLocalData();
}
```

### Vérifier l'enregistrement

```typescript
if (DI.isRegistered(TOKENS.ISyncService)) {
  const service = DI.resolve(TOKENS.ISyncService);
  // ...
}
```

### Résolution avec fallback

```typescript
const config = DI.resolveWithFallback(TOKENS.IAppConfig, defaultConfig);
```

## Avantages

- ✅ Centralise la logique de résolution des dépendances
- ✅ Gestion propre des dépendances optionnelles
- ✅ Pas besoin de try/catch partout
- ✅ Code plus lisible et maintenable
- ✅ Facilite les tests (mock du helper plutôt que du container)

## Avant / Après

### ❌ Avant (verbose)

```typescript
import { container } from 'tsyringe';

// Dépendance optionnelle = try/catch verbose
try {
  const syncService = container.resolve<ISyncService>(TOKENS.ISyncService);
  if (syncService) {
    await syncService.sync();
  }
} catch (error) {
  // Service non disponible
  await fallback();
}
```

### ✅ Après (propre)

```typescript
import { DI } from '@/infrastructure/di';

const syncService = DI.resolveOptional<ISyncService>(TOKENS.ISyncService);

if (syncService) {
  await syncService.sync();
} else {
  await fallback();
}
```
