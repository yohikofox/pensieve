# Architecture Decisions - Pensieve Mobile

## 📅 2026-02-06 - Session de Refactoring

### 1. Architecture React Native Pure - Séparation des Responsabilités

**Problème**: App.tsx mélangeait configuration globale, providers, et logique d'initialisation (147 lignes).

**Décision**: Appliquer l'architecture React Native recommandée avec séparation stricte des responsabilités.

**Structure adoptée**:
```
index.ts                    # Point d'entrée
├── bootstrap()             # Configuration globale (IoC, theme, NetInfo)
└── <App />                 # JUSTE les providers (22 lignes)
    └── <MainApp />         # Logique d'initialisation + navigation
```

**Fichiers créés**:
- `src/config/bootstrap.ts` - Configuration globale (IoC, theme, NetInfo)
- `src/providers/AppProviders.tsx` - Wrapper réutilisable des providers
- `src/components/MainApp.tsx` - Logique d'initialisation et navigation

**Résultat**:
- ✅ App.tsx: 147 → 22 lignes
- ✅ 1 responsabilité par fichier
- ✅ Providers réutilisables (tests, Storybook)
- ✅ Configuration avant React render

---

### 2. Lazy Logger Resolution - Fix DI Container

**Problème**: Hooks d'initialisation tentaient de résoudre `ILogger` du conteneur DI au chargement du module, avant l'appel de `bootstrap()`.

**Erreur**: `Error: Attempted to resolve unregistered dependency token: "Symbol(ILogger)"`

**Décision**: Utiliser la résolution lazy du logger - résoudre uniquement à l'exécution du hook (dans `useEffect`), pas au chargement du module.

**Pattern appliqué**:
```typescript
// ❌ AVANT (module-level)
const log = container.resolve<ILogger>(TOKENS.ILogger).createScope('Scope');

// ✅ APRÈS (lazy)
const getLogger = () => container.resolve<ILogger>(TOKENS.ILogger).createScope('Scope');
// ... dans useEffect:
const log = getLogger();
```

**Fichiers modifiés**:
- `useDeepLinkInitialization.ts`
- `useTranscriptionInitialization.ts`
- `useNotificationSetup.ts`
- `useLLMDownloadRecovery.ts`
- `useCrashRecovery.ts`

---

### 3. Permission Android VIBRATE - Haptic Feedback

**Problème**: `Haptics.impactAsync()` ne faisait rien sur Android (Pixel 10 Pro).

**Cause**: Permission `VIBRATE` manquante dans `app.json`.

**Décision**: Ajouter la permission Android pour activer le retour haptique.

**Modification** (`app.json`):
```json
"permissions": [
  "RECORD_AUDIO",
  "VIBRATE"  // ✅ Ajouté
]
```

**Requirement Android**: Toute utilisation de vibration nécessite la permission `VIBRATE`, même pour les micro-vibrations.

---

### 4. Haptic Feedback sur Tous les Tabs

**Problème**: Seul l'onglet "Actions" avait du haptic feedback → incohérence UX.

**Décision**: Appliquer `Haptics.impactAsync(ImpactFeedbackStyle.Light)` sur **tous les onglets** pour une expérience cohérente.

**Résultat**:
- ✅ 6 tabs avec haptic feedback identique
- ✅ Expérience utilisateur uniforme
- ✅ Vibration subtile sur chaque changement d'onglet

---

### 5. Optimisation Performance - Mémoisation des Icons

**Problème**: Fonctions `tabBarIcon` et listeners recréées à chaque render → re-renders inutiles.

**Décision**: Mémoriser avec `useCallback` et `useMemo`.

**Optimisations appliquées**:
- ✅ `handleTabPress` mémorisé (haptic handler)
- ✅ `tabPressListener` mémorisé (réutilisé par tous les tabs)
- ✅ Fonctions `*Icon` mémorisées avec `useCallback`
- ✅ `actionsIcon` re-créée uniquement si `todoCount` change

**Impact**:
- Moins de re-renders des TabBarIcon
- Moins d'allocations mémoire
- Seul Actions icon re-render quand le badge change (intentionnel)

---

### 6. Accessibilité - VoiceOver/TalkBack

**Problème**: Pas d'`accessibilityLabel` sur les tabs → mauvaise expérience pour les lecteurs d'écran.

**Décision**: Ajouter des labels d'accessibilité descriptifs et internationalisés pour chaque tab.

**Labels ajoutés** (FR/EN):
- **News**: "Actualités, onglet de navigation"
- **Captures**: "Captures, onglet de navigation. Affiche la liste de toutes vos captures"
- **Capture**: "Capturer, onglet de navigation. Ouvre les outils de capture"
- **Actions**: "Actions, onglet de navigation. 3 actions en attente" (dynamique)
- **Projects**: "Projets, onglet de navigation. Organisez vos captures en projets"
- **Settings**: "Réglages, onglet de navigation. Configurez l'application"

**Améliorations**:
- ✅ VoiceOver (iOS) annonce clairement chaque onglet
- ✅ TalkBack (Android) lit les descriptions
- ✅ Compteur dynamique sur Actions annoncé en temps réel
- ✅ Bilingue (FR/EN) avec i18next
- ✅ Pluralisation automatique ("1 action" / "3 actions")

---

### 7. Fallback Badge Count - Protection contre undefined

**Problème**: Si `useActiveTodoCount()` échoue ou retourne `undefined`, le badge pourrait afficher "undefined".

**Décision**: Ajouter un fallback à `0` avec l'opérateur nullish coalescing.

**Code**:
```typescript
const { data: activeTodoCount } = useActiveTodoCount();
const todoCount = activeTodoCount ?? 0; // ✅ Fallback à 0
```

**Comportements**:
- Hook réussit, 0 actions → Badge masqué, label standard
- Hook réussit, 3 actions → Badge "3", label "3 actions en attente"
- Hook échoue (undefined) → Badge masqué, label standard
- Aucun risque d'afficher "undefined"

---

### 8. Pattern Registry - Décentralisation de la Configuration

**Problème**: MainNavigator avait trop de responsabilités - il devait connaître l'icon, les labels, et les options de chaque screen.

**Violation**: Single Responsibility Principle - MainNavigator gérait la configuration de tous les screens.

**Décision**: Appliquer le **Pattern 2: Screen Registry** pour décentraliser la configuration.

**Architecture**:
```
src/screens/
├── registry.ts             # Configuration centralisée de tous les tabs
│   └── tabScreens          # Chaque screen possède: icon, i18n, options
└── news/NewsScreen.tsx     # Screen simple, pas de config interne

src/navigation/
└── MainNavigator.tsx       # Rend dynamiquement depuis registry
    └── Object.entries(tabScreens).map() → <Tab.Screen />
```

**Fichiers**:
- **Créé**: `src/screens/registry.ts` - Configuration type-safe de tous les screens
- **Refactorisé**: `MainNavigator.tsx` - 210 → 115 lignes

**Avantages**:
| Critère | Avant (Centralisé) | Après (Registry) |
|---------|-------------------|------------------|
| Colocation | ❌ Icon loin du screen | ✅ Config avec exports |
| Réutilisabilité | ❌ Config dupliquée | ✅ Screen autonome |
| Scalabilité | ❌ Navigator grandit | ✅ Registry grandit |
| Maintenance | ❌ 1 fichier géant | ✅ 1 entrée = 1 screen |
| Ajout screen | 10+ lignes dans Navigator | 1 entrée dans registry |

**Pattern utilisé**:
```typescript
// registry.ts
export const tabScreens = {
  News: {
    component: NewsScreen,
    icon: 'rss',
    i18n: {
      title: 'navigation.headers.news',
      tabLabel: 'navigation.tabs.news',
      accessibilityLabel: 'navigation.accessibility.news.label',
    },
  },
  // ... autres screens
} as const satisfies Record<string, TabScreenConfig>;

// MainNavigator.tsx
{Object.entries(tabScreens).map(([name, config]) => (
  <Tab.Screen
    key={name}
    name={name}
    component={config.component}
    options={{
      ...config.options,
      tabBarIcon: createIconRenderer(config.icon, badge),
      // ... options générées depuis config
    }}
  />
))}
```

**Cas spéciaux gérés**:
- ✅ Actions badge dynamique injecté via `todoCount`
- ✅ Screens avec `headerShown: false` (Captures, Settings)
- ✅ AccessibilityLabel avec count dynamique

---

## 📊 Métriques Globales

| Métrique | Avant | Après | Amélioration |
|----------|-------|-------|--------------|
| App.tsx lignes | 147 | 22 | **-85%** |
| MainNavigator lignes | 210 | 115 | **-45%** |
| Fichiers créés | - | 4 | Configuration séparée |
| Responsabilités App.tsx | 3+ | 1 | Single Responsibility |
| Haptic feedback tabs | 1/6 | 6/6 | Cohérence UX |
| Accessibilité | ❌ | ✅ | VoiceOver/TalkBack |
| Performance icons | ❌ | ✅ | Mémoisation |
| Type safety | Partiel | ✅ | Registry type-safe |

---

## 🎯 Principes Appliqués

1. **Single Responsibility Principle** - Chaque fichier/composant a UNE responsabilité
2. **Separation of Concerns** - Configuration / Providers / Logique séparés
3. **DRY (Don't Repeat Yourself)** - Registry élimine la répétition de code
4. **Type Safety** - TypeScript garantit la validité des configs
5. **Accessibility First** - Labels descriptifs pour lecteurs d'écran
6. **Performance** - Mémoisation pour éviter re-renders inutiles
7. **Defensive Programming** - Fallbacks pour éviter bugs (undefined)
8. **Colocation** - Configuration proche du code qu'elle concerne

---

## 🔄 Prochaines Améliorations Possibles

1. **Tests unitaires** pour `bootstrap.ts`
2. **Tests de rendu** pour `AppProviders.tsx`
3. **Storybook** avec `AppProviders` wrapper
4. **Tests d'intégration** pour `MainApp.tsx`
5. **Registry étendu** - Ajouter validation runtime
6. **Type-safe routes** - Navigation avec types stricts
7. **Documentation** - ADR (Architecture Decision Records)

---

**Date**: 2026-02-06
**Contributeurs**: Code Review & Refactoring Session
**Status**: ✅ Implémenté et testé
