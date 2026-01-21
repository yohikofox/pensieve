# Testing Strategy - TDD + BDD + E2E

Pensieve utilise une **pyramide de tests complète** pour garantir la qualité du code :

```
      /\
     /  \    E2E (Detox)           5-10 smoke tests
    /----\   Tests lents, coûteux, fragiles
   /      \  Valident le happy path complet
  /--------\
 /  BDD     \ Acceptance Tests      50-100 tests
/  (Gherkin) \ Tests rapides, isolés, data-driven
/--------------\ Valident la logique métier
/   UNIT (TDD)  \ Unit Tests        100+ tests
/________________\ Tests très rapides, atomic
                   Valident les fonctions/classes
```

---

## 🎯 Quand utiliser chaque type de test ?

### 1. TDD - Unit Tests (Jest)

**Utiliser pour** :
- Tester des fonctions/méthodes isolées
- Valider la logique algorithmique
- Tester les cas limites (edge cases)
- Red-Green-Refactor au niveau du code

**Emplacement** : `src/**/*.test.ts`

**Commandes** :
```bash
npm run test:unit          # Tous les tests unitaires
npm run test:unit -- --watch  # Mode watch
```

**Exemple** :
```typescript
// src/utils/formatDuration.test.ts
describe('formatDuration', () => {
  it('devrait formater 1000ms en "00:01"', () => {
    expect(formatDuration(1000)).toBe('00:01');
  });

  it('devrait formater 65000ms en "01:05"', () => {
    expect(formatDuration(65000)).toBe('01:05');
  });
});
```

---

### 2. BDD - Acceptance Tests (Jest-Cucumber)

**Utiliser pour** :
- Valider les acceptance criteria (AC)
- Tester la logique métier complète
- Data-driven tests (tableaux Gherkin)
- Ajouter des cas de test quand un bug est trouvé

**Emplacement** :
- Gherkin specs: `tests/acceptance/features/*.feature`
- Step definitions: `tests/acceptance/*.test.ts`
- Mocks: `tests/acceptance/support/`

**Commandes** :
```bash
npm run test:acceptance              # Tous les tests d'acceptance
npm run test:acceptance:watch        # Mode watch
npm run test:acceptance:story-2-1    # Story spécifique
```

**Exemple** :
```gherkin
# tests/acceptance/features/story-2-1.feature
@AC2 @data-driven
Plan du scénario: Sauvegarder avec différentes durées
  Quand l'utilisateur enregistre pendant <durée> secondes
  Et l'utilisateur arrête l'enregistrement
  Alors une Capture est sauvegardée avec durée <durée_ms>ms

  Exemples:
    | durée | durée_ms |
    | 1     | 1000     |
    | 5     | 5000     |
    | 30    | 30000    |
```

**Avantages** :
- ✅ Tests rapides (< 1s chacun, pas de simulateur)
- ✅ Isolation complète (in-memory DB, mocks)
- ✅ Data-driven : facile d'ajouter des cas de test
- ✅ Documentation vivante (Gherkin lisible par tous)
- ✅ Traçabilité AC → tests

---

### 3. E2E - End-to-End Tests (Detox)

**Utiliser pour** :
- Valider le happy path complet
- Tester l'intégration UI + backend + DB
- Smoke tests avant release
- Valider les NFRs critiques (< 500ms, offline, crash recovery)

**Emplacement** : `e2e/*.e2e.ts`

**Commandes** :
```bash
npm run test:e2e:build:ios   # Build app de test
npm run test:e2e              # Lancer E2E tests
```

**Exemple** :
```typescript
// e2e/story-2-1-capture-audio.e2e.ts
it('should start audio recording within 500ms after tap', async () => {
  await waitForElement('record-button');
  const latency = await measurePerformance(async () => {
    await tapElement('record-button');
  });
  expect(latency).toBeLessThan(500); // NFR1
});
```

**Limitations** :
- ❌ Tests lents (10-30s par test)
- ❌ Fragiles (timeouts, UI changes)
- ❌ Coûteux en CI (simulateur requis)

---

## 📋 Workflow de développement (TDD + BDD)

### Phase 1: RED - Écrire les tests qui échouent

1. **Lire l'AC dans le story file** (ex: `2-1-capture-audio-1-tap.md`)

2. **Écrire le scenario Gherkin** :
```gherkin
@AC1
Scénario: Démarrer l'enregistrement rapidement
  Quand l'utilisateur démarre un enregistrement
  Alors l'enregistrement démarre en moins de 500ms
```

3. **Lancer les tests** (ils DOIVENT échouer) :
```bash
npm run test:acceptance:story-2-1
# ❌ Error: RecordingService.startRecording() - Not implemented yet
```

### Phase 2: GREEN - Implémenter le minimum pour passer

4. **Implémenter la logique métier** :
```typescript
// src/services/RecordingService.ts
async startRecording(): Promise<void> {
  // Check permissions (AC5)
  const hasPermission = await this.permissions.checkMicrophonePermission();
  if (!hasPermission) {
    throw new Error('MicrophonePermissionDenied');
  }

  // Start recording (AC1)
  const { uri } = await this.audioRecorder.startRecording();

  // Create Capture entity (AC1)
  const capture = await this.captureRepo.create({
    type: 'AUDIO',
    state: 'RECORDING',
    rawContent: uri,
    syncStatus: 'pending',
  });

  this.currentCaptureId = capture.id;
}
```

5. **Relancer les tests** :
```bash
npm run test:acceptance:story-2-1
# ✅ 1 passed (AC1: Démarrer l'enregistrement rapidement)
```

### Phase 3: REFACTOR - Améliorer le code

6. **Refactorer sans casser les tests** :
```typescript
// Extraire la validation de permissions
private async ensureMicrophonePermission(): Promise<void> {
  if (!await this.permissions.checkMicrophonePermission()) {
    throw new Error('MicrophonePermissionDenied');
  }
}

async startRecording(): Promise<void> {
  await this.ensureMicrophonePermission();
  // ... reste du code
}
```

7. **Vérifier que les tests passent toujours** :
```bash
npm run test:acceptance:story-2-1
# ✅ All tests still pass
```

---

## 🐛 Ajouter des tests pour un bug découvert

### Scénario : Bug trouvé en production

1. **Bug** : Les enregistrements de < 1 seconde ne sont pas sauvegardés

2. **Ajouter un cas de test dans Gherkin** :
```gherkin
@edge-case @bug-fix
Plan du scénario: Gérer les enregistrements très courts
  Quand l'utilisateur enregistre pendant <durée> millisecondes
  Et l'utilisateur arrête l'enregistrement
  Alors la Capture est créée malgré la courte durée

  Exemples:
    | durée |
    | 100   |  # Bug découvert ici
    | 500   |
    | 999   |
```

3. **Lancer le test** (RED) :
```bash
npm run test:acceptance:story-2-1
# ❌ Expected capture to exist but got 0 captures
```

4. **Fixer le bug** (GREEN) :
```typescript
async stopRecording(): Promise<void> {
  const { duration } = await this.audioRecorder.stopRecording();

  // FIX: Accepter les enregistrements courts
  if (duration < 100) {
    console.warn('Recording duration is very short:', duration);
  }

  // Sauvegarder même si court
  await this.captureRepo.update(this.currentCaptureId!, {
    state: 'CAPTURED',
    duration,
  });
}
```

5. **Tests passent** (GREEN) :
```bash
npm run test:acceptance:story-2-1
# ✅ All tests pass including new edge case
```

---

## 📊 Matrice de traçabilité

| AC  | Scenario Gherkin | BDD Test | E2E Test | Status |
|-----|------------------|----------|----------|--------|
| AC1 | Démarrer en < 500ms | ✅ | ✅ | 🔴 RED |
| AC1 | Créer entité Capture | ✅ | ✅ | 🔴 RED |
| AC2 | Sauvegarder avec durées | ✅ (4 exemples) | ✅ | 🔴 RED |
| AC2 | Métadonnées complètes | ✅ | ✅ | 🔴 RED |
| AC2 | Convention de nommage | ✅ | ❌ | 🔴 RED |
| AC3 | Mode hors ligne | ✅ | ✅ | 🔴 RED |
| AC3 | Marquer pour sync | ✅ | ✅ | 🔴 RED |
| AC4 | Récupération crash | ✅ | ✅ | 🔴 RED |
| AC4 | Notification récupération | ✅ | ✅ | 🔴 RED |
| AC5 | Vérifier permissions | ✅ | ✅ | 🔴 RED |
| AC5 | Enregistrer avec permission | ✅ | ✅ | 🔴 RED |

**Total** :
- **15 scenarios Gherkin** (dont 4 data-driven avec multiples exemples)
- **25+ tests BDD** (grâce aux Scenario Outlines)
- **15 tests E2E** (smoke tests)

---

## 🚀 Commandes rapides

```bash
# Installation
npm install

# TDD - Unit tests
npm run test:unit

# BDD - Acceptance tests
npm run test:acceptance
npm run test:acceptance:watch
npm run test:acceptance:story-2-1

# E2E - Detox tests
npm run prebuild:clean
npm run test:e2e:build:ios
npm run test:e2e

# Tous les tests
npm test

# Coverage
npm run test:coverage
```

---

## 🎯 Ordre d'exécution pendant le développement

1. **TDD** : Écrire les tests unitaires pour une fonction/classe
   ```bash
   npm run test:unit -- --watch
   ```

2. **BDD** : Écrire le scenario Gherkin + step definitions
   ```bash
   npm run test:acceptance:watch
   ```

3. **Implémenter** : Coder jusqu'à ce que les tests BDD passent (GREEN)

4. **Refactor** : Améliorer le code, les tests doivent rester verts

5. **E2E** : Lancer les smoke tests avant commit/PR
   ```bash
   npm run test:e2e
   ```

---

## 📚 Références

- **TDD** : [Test-Driven Development](https://en.wikipedia.org/wiki/Test-driven_development)
- **BDD** : [Behavior-Driven Development](https://cucumber.io/docs/bdd/)
- **Gherkin** : [Gherkin Syntax](https://cucumber.io/docs/gherkin/reference/)
- **Jest-Cucumber** : [jest-cucumber documentation](https://github.com/bencompton/jest-cucumber)
- **Detox** : [React Native E2E Testing](https://wix.github.io/Detox/)

---

## ✅ Checklist avant commit

- [ ] Tous les tests unitaires passent : `npm run test:unit`
- [ ] Tous les tests d'acceptance passent : `npm run test:acceptance`
- [ ] Coverage >= 80% : `npm run test:coverage`
- [ ] E2E smoke tests passent : `npm run test:e2e`
- [ ] Linter OK : `npm run lint`
- [ ] Build OK : `npm run build`

---

## 🎓 Best Practices

### BDD Gherkin

✅ **DO** :
- Utiliser le langage métier (pas technique)
- Un scenario = un comportement
- Utiliser `Scenario Outline` pour data-driven
- Tagguer avec `@AC1`, `@AC2`, etc. pour traçabilité

❌ **DON'T** :
- Tester l'implémentation (tester le comportement)
- Dupliquer les scenarios (utiliser Scenario Outline)
- Mélanger plusieurs AC dans un scenario

### Step Definitions

✅ **DO** :
- Réutiliser les steps Given/When/Then
- Garder les steps simples et lisibles
- Utiliser le contexte (`this.`) pour partager des données

❌ **DON'T** :
- Mettre de la logique métier dans les steps (mettre dans les services)
- Créer des steps trop spécifiques (difficiles à réutiliser)

### Mocks

✅ **DO** :
- Mocker les dépendances externes (expo-av, file system)
- Utiliser in-memory DB pour les tests
- Réinitialiser les mocks après chaque test

❌ **DON'T** :
- Mocker ce qui doit être testé (services métier)
- Partager l'état entre les tests

---

## 📈 Progression Story 2.1

- [x] Setup BDD infrastructure (Jest-Cucumber)
- [x] Créer feature file Gherkin (15 scenarios)
- [x] Créer step definitions
- [x] Créer mocks et test context
- [x] Créer stubs services/repositories (RED phase)
- [ ] Implémenter RecordingService (GREEN phase)
- [ ] Implémenter CaptureRepository (GREEN phase)
- [ ] Refactor (REFACTOR phase)
- [ ] Tous les tests d'acceptance passent ✅
- [ ] E2E smoke tests passent ✅

**Next step** : Implémenter `RecordingService.startRecording()` pour faire passer les premiers tests BDD !
