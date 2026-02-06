# Theme Injection Pattern

## Vue d'ensemble

Ce document décrit le pattern standardisé pour injecter les données de thème dans les composants, éliminant le besoin de passer `themeColors` et `isDark` comme props.

## Problème Résolu

**Avant** (Prop Drilling):
```tsx
// Parent doit récupérer et passer le thème
function ParentComponent() {
  const { themeColors, isDark } = useCaptureTheme();

  return (
    <ChildComponent
      themeColors={themeColors}
      isDark={isDark}
      // ... autres props
    />
  );
}

// Enfant reçoit le thème en props
interface ChildProps {
  themeColors: ThemeColors;
  isDark: boolean;
  // ... autres props
}
```

**Après** (Pattern Répétable):
```tsx
// Parent n'a plus besoin de gérer le thème
function ParentComponent() {
  return <ChildComponent /* ... autres props */ />;
}

// Enfant consomme le thème directement
function ChildComponentBase({ theme }: WithCaptureThemeProps) {
  const { colors, isDark } = theme;
  // ... utiliser theme.colors et theme.isDark
}

export const ChildComponent = withCaptureTheme(ChildComponentBase);
```

## Trois Approches Disponibles

### 1. HOC Pattern (Recommandé)

**Quand l'utiliser**: Pour la plupart des composants

**Avantages**:
- Interface propre et claire
- Aucune modification du parent nécessaire
- Type-safe avec TypeScript
- Composant testable facilement

**Exemple**:
```tsx
import { withCaptureTheme, type WithCaptureThemeProps } from "../../hoc";

// Définir le composant de base avec 'theme' en prop
interface MyComponentBaseProps extends WithCaptureThemeProps {
  title: string;
  onPress: () => void;
}

function MyComponentBase({ theme, title, onPress }: MyComponentBaseProps) {
  const { colors, isDark } = theme;

  return (
    <TouchableOpacity
      style={{ backgroundColor: colors.cardBg }}
      onPress={onPress}
    >
      <Text style={{ color: colors.textPrimary }}>{title}</Text>
      {isDark && <Icon name="moon" />}
    </TouchableOpacity>
  );
}

// Exporter la version wrappée
export const MyComponent = withCaptureTheme(MyComponentBase);

// Usage (pas besoin de passer theme)
<MyComponent title="Hello" onPress={handlePress} />
```

### 2. Render Props Pattern

**Quand l'utiliser**: Pour des composants très simples ou inline

**Avantages**:
- Flexibilité maximale
- Bon pour les composants inline
- Pas besoin de créer un composant séparé

**Exemple**:
```tsx
import { CaptureThemeProvider } from "../../hoc";

<CaptureThemeProvider>
  {(theme) => (
    <View style={{ backgroundColor: theme.colors.cardBg }}>
      <Text style={{ color: theme.colors.textPrimary }}>
        Mode: {theme.isDark ? "Sombre" : "Clair"}
      </Text>
    </View>
  )}
</CaptureThemeProvider>
```

### 3. Hook Pattern (Actuel)

**Quand l'utiliser**: Pour des composants complexes avec logique métier

**Avantages**:
- Contrôle total
- Accès direct sans wrapper
- Meilleur pour la composition de hooks

**Exemple**:
```tsx
import { useCaptureThemeData } from "../../hoc";

export function MyComponent({ title }: MyComponentProps) {
  const theme = useCaptureThemeData();
  const [expanded, setExpanded] = useState(false);

  // Logique complexe...

  return (
    <View style={{ backgroundColor: theme.colors.cardBg }}>
      <Text style={{ color: theme.colors.textPrimary }}>{title}</Text>
    </View>
  );
}
```

## Migration Guide

### Étape 1: Identifier les composants à migrer

Chercher les composants qui reçoivent `themeColors` ou `isDark` en props:

```bash
# Trouver tous les composants avec themeColors en props
grep -r "themeColors" src/components --include="*.tsx"

# Trouver tous les composants avec isDark en props
grep -r "isDark.*:" src/components --include="*.tsx"
```

### Étape 2: Choisir le pattern approprié

| Critère | Pattern Recommandé |
|---------|-------------------|
| Composant présentation simple | HOC |
| Composant inline/temporaire | Render Props |
| Composant avec logique complexe | Hook |
| Composant avec plusieurs hooks | Hook |

### Étape 3: Refactoriser le composant

**Avant**:
```tsx
interface OldComponentProps {
  themeColors: ThemeColors;
  isDark: boolean;
  data: string;
}

export function OldComponent({ themeColors, isDark, data }: OldComponentProps) {
  return (
    <View style={{ backgroundColor: themeColors.cardBg }}>
      <Text style={{ color: themeColors.textPrimary }}>{data}</Text>
    </View>
  );
}
```

**Après (HOC)**:
```tsx
import { withCaptureTheme, type WithCaptureThemeProps } from "../../hoc";

interface NewComponentProps extends WithCaptureThemeProps {
  data: string;
}

function NewComponentBase({ theme, data }: NewComponentProps) {
  return (
    <View style={{ backgroundColor: theme.colors.cardBg }}>
      <Text style={{ color: theme.colors.textPrimary }}>{data}</Text>
    </View>
  );
}

export const NewComponent = withCaptureTheme(NewComponentBase);
```

### Étape 4: Mettre à jour le parent

**Avant**:
```tsx
function Parent() {
  const { themeColors, isDark } = useCaptureTheme();

  return (
    <OldComponent
      themeColors={themeColors}
      isDark={isDark}
      data="Hello"
    />
  );
}
```

**Après**:
```tsx
function Parent() {
  return <NewComponent data="Hello" />;
}
```

## Testing

### Tester un composant avec HOC

```tsx
import { render } from "@testing-library/react-native";
import { MyComponentBase } from "./MyComponent";
import type { CaptureTheme } from "../../hoc";

describe("MyComponent", () => {
  const mockTheme: CaptureTheme = {
    colors: {
      cardBg: "#FFFFFF",
      textPrimary: "#000000",
      // ... autres couleurs
    },
    isDark: false,
  };

  it("renders with light theme", () => {
    const { getByText } = render(
      <MyComponentBase theme={mockTheme} title="Test" onPress={jest.fn()} />
    );

    expect(getByText("Test")).toBeTruthy();
  });

  it("renders with dark theme", () => {
    const darkTheme = { ...mockTheme, isDark: true };

    const { queryByTestId } = render(
      <MyComponentBase theme={darkTheme} title="Test" onPress={jest.fn()} />
    );

    expect(queryByTestId("moon-icon")).toBeTruthy();
  });
});
```

## Best Practices

### ✅ DO

- Utiliser `theme.colors` au lieu de `themeColors`
- Utiliser `theme.isDark` au lieu de `isDark`
- Exporter le composant de base pour les tests
- Documenter quel pattern est utilisé et pourquoi

### ❌ DON'T

- Ne pas mélanger les patterns dans un même composant
- Ne pas passer `themeColors` ou `isDark` en props si vous utilisez le HOC
- Ne pas utiliser le HOC pour des composants très complexes (préférer le hook)

## Exemples Réels

### Composant Simple (HOC)

```tsx
// src/components/capture/StatusBadge.tsx
import { withCaptureTheme, type WithCaptureThemeProps } from "../../hoc";

interface StatusBadgeProps extends WithCaptureThemeProps {
  status: "success" | "error" | "pending";
}

function StatusBadgeBase({ theme, status }: StatusBadgeProps) {
  const color = theme.isDark
    ? theme.colors.statusDark[status]
    : theme.colors.statusLight[status];

  return <View style={{ backgroundColor: color }} />;
}

export const StatusBadge = withCaptureTheme(StatusBadgeBase);
```

### Composant Complexe (Hook)

```tsx
// src/components/capture/AnalysisPanel.tsx
import { useCaptureThemeData } from "../../hoc";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";

export function AnalysisPanel() {
  const theme = useCaptureThemeData();
  const capture = useCaptureDetailStore((state) => state.capture);
  const [expanded, setExpanded] = useState(false);

  // Logique complexe...

  return (
    <View style={{ backgroundColor: theme.colors.cardBg }}>
      {/* ... */}
    </View>
  );
}
```

## Métriques de Succès

Après migration vers ce pattern:

- ✅ Réduction du prop drilling de ~15% (themeColors + isDark éliminés)
- ✅ Interfaces de composants plus claires
- ✅ Testabilité améliorée
- ✅ Consistance dans toute la codebase
- ✅ Facilité de changement de thème (un seul endroit)

## Prochaines Étapes

1. Migrer progressivement les composants existants
2. Utiliser le HOC par défaut pour nouveaux composants
3. Documenter les exceptions (pourquoi un composant n'utilise pas le pattern)
4. Créer des snippets VS Code pour accélérer le développement

## Questions Fréquentes

**Q: Puis-je toujours utiliser `useCaptureTheme()` directement?**
R: Oui, mais préférez `useCaptureThemeData()` pour avoir l'objet `theme` unifié.

**Q: Quel est le coût en performance du HOC?**
R: Minimal. Le HOC est juste un wrapper qui appelle `useCaptureTheme()` - même chose que faire l'appel dans le composant.

**Q: Comment tester un composant wrappé?**
R: Testez le composant de base directement (exportez-le aussi), et passez un mock theme.

**Q: Que faire si je veux override le thème?**
R: Créez un nouveau ThemeProvider avec Context API si besoin de scoping.
