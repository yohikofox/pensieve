# Lottie Animations - Jardin d'Idées

Ce dossier contient les animations Lottie pour l'état vide "Jardin d'idées".

## Fichiers Requis

### 1. butterfly.json
- **Description**: Animation de papillon flottant subtil
- **Source**: [LottieFiles - Butterfly](https://lottiefiles.com/search?q=butterfly&category=animations)
- **Critères**:
  - Style: Minimal, calming (pas cartoon)
  - Couleurs: Green/Blue (success[300], primary[300])
  - Taille: < 50KB
  - Loop: Oui
  - License: Free for commercial use

### 2. breeze.json (optionnel)
- **Description**: Feuilles ou particules flottantes (ambient background)
- **Source**: [LottieFiles - Breeze Leaves](https://lottiefiles.com/search?q=breeze%20leaves)
- **Critères**:
  - Style: Très subtil, minimal
  - Couleurs: Green (success palette)
  - Taille: < 50KB
  - Loop: Oui
  - License: Free for commercial use
  - Opacity: Utilisé à 0.3 dans le code

## Instructions de Téléchargement

1. Allez sur [LottieFiles.com](https://lottiefiles.com)
2. Recherchez les animations selon les critères ci-dessus
3. Téléchargez le fichier `.json` (Lottie JSON format)
4. Renommez selon les noms ci-dessus (`butterfly.json`, `breeze.json`)
5. Placez les fichiers dans ce dossier
6. Vérifiez la taille (< 50KB chacun)

## Utilisation dans le Code

✅ **Code IMPLÉMENTÉ** dans `CapturesListScreen.tsx` (lignes 556-607)
⚠️ **Fichiers JSON REQUIS** - Animations désactivées jusqu'au téléchargement

**Status actuel**: Le code Lottie est prêt mais commenté en attendant les fichiers JSON.

**Pour activer les animations:**

1. Téléchargez `butterfly.json` et `breeze.json` (voir instructions ci-dessous)
2. Placez les fichiers dans `mobile/assets/animations/`
3. Dans `CapturesListScreen.tsx`, décommentez les lignes:
   - Ligne ~570: `source={require('../../assets/animations/breeze.json')}`
   - Ligne ~592: `source={require('../../assets/animations/butterfly.json')}`
4. Changez `hasLottieAnimations` de `false` à `true` (ligne ~123)

Les animations s'afficheront automatiquement dans l'état vide du feed.

## Performance

- Les animations Lottie s'exécutent sur le thread natif (60fps garantis)
- Maximum 2-3 animations simultanées recommandé
- Les fichiers sont lazy-loaded via `require()`

## Accessibilité

Les animations sont automatiquement désactivées quand l'utilisateur active "Reduce Motion" dans les paramètres système.

---

**Date**: 2026-02-03
**Story**: 3.4 - Task 6 (AC8)
