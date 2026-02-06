# Décisions d'Architecture - 6 Février 2026

Document de traçabilité des décisions prises lors de la session de refactoring.

---

## 1. Migration vers Injection par Interface (IoC/DI)

### Décision
Migrer `LLMModelService` et `HuggingFaceAuthService` d'une résolution directe par classe vers une injection par interface suivant le pattern établi dans le projet.

### Contexte
- Ces services étaient résolus directement via `container.resolve(LLMModelService)`
- Cela violait le principe d'Inversion de Dépendances (SOLID)
- Les autres services du projet utilisaient déjà l'injection par interface (ex: `ICrashRecoveryService`)
- Problème de testabilité et de cohérence architecturale

### Solution Implémentée

#### Interfaces créées
1. **IHuggingFaceAuthService** (`src/contexts/Normalization/domain/IHuggingFaceAuthService.ts`)
   - Méthodes: `initialize()`, `login()`, `logout()`, `isAuthenticated()`, `getAuthHeader()`, etc.
   - Types exportés: `HuggingFaceUser`, `AuthState`

2. **ILLMModelService** (`src/contexts/Normalization/domain/ILLMModelService.ts`)
   - 316 lignes d'interface complète
   - Méthodes: gestion des modèles, téléchargement, sélection par tâche, settings
   - Types exportés: `LLMModelId`, `LLMTask`, `DownloadProgress`, etc.

#### Tokens DI ajoutés
```typescript
TOKENS.IHuggingFaceAuthService = Symbol.for('IHuggingFaceAuthService')
TOKENS.ILLMModelService = Symbol.for('ILLMModelService')
```

#### Enregistrement dans le container
```typescript
container.registerSingleton<IHuggingFaceAuthService>(TOKENS.IHuggingFaceAuthService, HuggingFaceAuthService);
container.registerSingleton<ILLMModelService>(TOKENS.ILLMModelService, LLMModelService);
```

#### Services mis à jour
- `HuggingFaceAuthService`: Implémente `IHuggingFaceAuthService`
- `LLMModelService`: Implémente `ILLMModelService`, injecte `IHuggingFaceAuthService`
- `PostProcessingService`: Injecte `ILLMModelService` via `@inject(TOKENS.ILLMModelService)`
- `CaptureAnalysisService`: Injecte `ILLMModelService` via constructeur
- `App.tsx`, `LLMSettingsScreen.tsx`, `useLLMSettingsListener.ts`: Résolvent via tokens

#### Anti-patterns éliminés
- ❌ Plus de `container.resolve(LLMModelService)` dans les constructeurs
- ❌ Plus de `container.resolve(HuggingFaceAuthService)` manuel
- ✅ Injection via `@inject(TOKENS.IService)`

### Bénéfices
- ✅ Respecte le principe d'Inversion de Dépendances (SOLID-D)
- ✅ Améliore la testabilité (mock des interfaces)
- ✅ Cohérence architecturale avec le reste du projet
- ✅ Suppression des anti-patterns de résolution manuelle

### Fichiers impactés
- `src/contexts/Normalization/domain/IHuggingFaceAuthService.ts` (nouveau)
- `src/contexts/Normalization/domain/ILLMModelService.ts` (nouveau)
- `src/infrastructure/di/tokens.ts` (modifié)
- `src/infrastructure/di/container.ts` (modifié)
- 7 fichiers de services/consumers (modifiés)

### Commits
- `320ab6c` - refactor(di): migrate LLMModelService and HuggingFaceAuthService to interface-based DI

---

## 2. Navigation depuis les Notifications

### Décision
Implémenter la navigation vers le détail d'une capture lorsque l'utilisateur tape sur une notification de transcription terminée.

### Contexte
- TODO existante: `// TODO: Navigate to capture detail when implemented`
- Service de deep linking déjà disponible (`DeepLinkService`)
- Méthode `navigateToCapture(captureId)` déjà implémentée

### Solution Implémentée
```typescript
setupNotificationResponseHandler((captureId) => {
  deepLinkService.navigateToCapture(captureId);
});
```

### Fonctionnalité
Lorsqu'une notification de transcription est tapée :
1. Navigation vers l'onglet "Captures"
2. Ouverture de `CaptureDetailScreen`
3. Activation du highlight (`highlightInsights: true`)
4. Tracking de la source (`fromNotification: true`)

### Commits
- `b68fba9` - feat(notifications): implement navigation to capture detail from transcription notification

---

## 3. Stratégie de Logging Production

### Décision
Implémenter une stratégie de logging stricte où seules les erreurs et warnings sont visibles en production, tout le reste étant réservé au développement.

### Contexte
- Logs verbeux dans App.tsx pollueraient la console en production
- Besoin de distinguer les niveaux de logs (debug, info, warn, error)
- Volonté d'avoir un contrôle total sur les logs

### Stratégie Définie

#### Niveaux de logs
| Niveau | Développement | Production | Usage |
|--------|---------------|------------|-------|
| `console.debug` | ✅ Affiché | ❌ No-op | Debug détaillé |
| `console.info` | ✅ Affiché | ❌ No-op | Informations générales |
| `console.warn` | ✅ Affiché | ✅ Affiché | Warnings |
| `console.error` | ✅ Affiché | ✅ Affiché | Erreurs |

#### App.tsx nettoyé
- Tous les logs verbeux convertis en `console.debug`
- Logs d'erreur gardés en `console.error`
- Suppression des logs redondants

### Commits
- `3eed2bf` - refactor(logs): implement production-ready logging strategy in App.tsx

---

## 4. Logger Injectable via IoC

### Décision
Transformer le logger en service injectable via le container IoC pour cohérence architecturale et testabilité.

### Contexte
- Logger custom créé mais non injectable
- Incohérent avec l'architecture IoC/DI du projet (ADR-017)
- Besoin de pouvoir mocker le logger dans les tests
- Volonté de garder le contrôle total (vs plugin Babel)

### Solution Implémentée

#### Architecture créée
```
src/infrastructure/logging/
├── ILogger.ts           # Interface injectable
├── LoggerService.ts     # Implémentation singleton
└── README.md           # Documentation complète
```

#### Interface ILogger
```typescript
export interface ILogger {
  debug: LogFunction;
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
  createScope(scope: string): ILogger;
}
```

#### Implémentation LoggerService
```typescript
@injectable()
export class LoggerService implements ILogger {
  constructor() {
    this.debug = __DEV__ ? console.debug.bind(console) : noop;
    this.info = __DEV__ ? console.info.bind(console) : noop;
    this.warn = console.warn.bind(console);
    this.error = console.error.bind(console);
  }

  createScope(scope: string): ILogger {
    // Retourne un logger avec préfixe [scope]
  }
}
```

#### Enregistrement
```typescript
// tokens.ts
TOKENS.ILogger = Symbol.for('ILogger')

// container.ts
container.registerSingleton<ILogger>(TOKENS.ILogger, LoggerService);
```

#### Utilisation

**Dans App.tsx:**
```typescript
const log = container.resolve<ILogger>(TOKENS.ILogger).createScope('App');
log.debug('Debug message');  // [App] Debug message
```

**Dans les services injectables:**
```typescript
@injectable()
export class MyService {
  private log: ILogger;

  constructor(@inject(TOKENS.ILogger) logger: ILogger) {
    this.log = logger.createScope('MyService');
  }
}
```

**Scopes imbriqués:**
```typescript
const loginLog = this.log.createScope('login');
loginLog.debug('Attempting login');
// Output: [UserService:login] Attempting login
```

### Avantages
- ✅ **Testable**: Mock facile via `container.registerInstance(TOKENS.ILogger, mockLogger)`
- ✅ **Cohérent**: Suit ADR-017 (IoC/DI avec TSyringe)
- ✅ **Injectable**: Via constructeur comme tous les autres services
- ✅ **Scoped**: Support des préfixes et scopes imbriqués
- ✅ **Production-ready**: debug/info automatiquement désactivés en prod
- ✅ **Extensible**: Facile d'ajouter RemoteLoggerService plus tard
- ✅ **Contrôle total**: Pas de dépendance externe (vs babel plugin)

### Alternative rejetée
**Babel plugin** (`babel-plugin-transform-remove-console`)
- ❌ Moins de contrôle
- ❌ Dépendance externe
- ❌ Difficulté pour étendre (remote logging)
- ❌ Non testable de la même façon

### Fichiers créés/modifiés
- `src/infrastructure/logging/ILogger.ts` (nouveau)
- `src/infrastructure/logging/LoggerService.ts` (nouveau)
- `src/infrastructure/logging/README.md` (nouveau - documentation complète)
- `src/infrastructure/di/tokens.ts` (TOKENS.ILogger ajouté)
- `src/infrastructure/di/container.ts` (enregistrement)
- `App.tsx` (utilisation du logger injectable)
- `src/utils/logger.ts` (supprimé - remplacé par service injectable)

### Commits
- `5faea1f` - feat(logging): implement custom logger with production/dev control
- `029637b` - refactor(logging): make logger injectable via IoC container

---

## Prochaines Étapes Suggérées

### Migration du Logger
- [ ] Propager `ILogger` dans les autres services du projet
- [ ] Remplacer tous les `console.*` par le logger injectable
- [ ] Créer des scopes pour chaque service

### Documentation Architecture
- [ ] Créer ADR-018 pour la décision du Logger Injectable
- [ ] Mettre à jour ADR-017 avec les nouvelles interfaces (ILLMModelService, etc.)
- [ ] Documenter le pattern de scoped logger

### Tests
- [ ] Ajouter tests unitaires pour LoggerService
- [ ] Mettre à jour les tests existants pour mocker ILogger
- [ ] Tests d'intégration pour vérifier no-op en production

---

## Références

### Architecture Decisions Records (ADR)
- **ADR-017**: IoC/DI with TSyringe (référence dans le code)
- **ADR-018**: (à créer) Injectable Logger Service

### Principes SOLID appliqués
- **D** - Dependency Inversion: Services dépendent d'interfaces, pas d'implémentations
- **S** - Single Responsibility: Logger a une seule responsabilité
- **O** - Open/Closed: Extensible (RemoteLogger) sans modifier LoggerService

### Patterns utilisés
- **Dependency Injection**: Via TSyringe
- **Singleton**: Services enregistrés comme singletons
- **Scoped Logger**: Pattern pour logs contextualisés
- **Factory Pattern**: `createScope()` crée des loggers scopés

---

**Date**: 6 Février 2026
**Auteur**: Session de refactoring (LLMModelService, Logging)
**Status**: Implémenté et commité
