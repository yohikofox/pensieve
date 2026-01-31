# Configuration Dual App (Release + Dev)

Cette configuration permet d'installer **deux versions** de l'app Pensieve sur le même appareil :
- **Version Release** (`com.pensine.app`) - Version stable pour démonstration
- **Version Dev** (`com.pensine.app.dev`) - Version de développement

## Différences entre les variantes

| Propriété | Release | Dev |
|-----------|---------|-----|
| **Nom de l'app** | Pensieve | Pensieve Dev |
| **Bundle ID (iOS)** | `com.pensine.app` | `com.pensine.app.dev` |
| **Package (Android)** | `com.pensine.app` | `com.pensine.app.dev` |
| **URL Scheme** | `pensine://` | `pensine-dev://` |
| **Icône** | `icon.png` | `icon-dev.png` |

## Prérequis

Créer les icônes pour la version Dev (avec badge "DEV" par exemple) :
- `assets/icon-dev.png`
- `assets/adaptive-icon-dev.png` (Android)

## Commandes de développement

### Développement quotidien (Version Dev + Metro)

C'est ce que tu utilises **tous les jours** avec Expo Dev Client :

#### Android
```bash
npm run android
```
→ Lance Metro bundler + installe/lance app Dev sur téléphone via ADB
→ Bundle ID : `com.pensine.app.dev`
→ Icône avec badge DEV

#### iOS
```bash
npm run ios
```
→ Lance Metro bundler + installe/lance app Dev sur simulateur/téléphone
→ Bundle ID : `com.pensine.app.dev`
→ Icône avec badge DEV

### Build version Release (standalone)

Pour builder une **version release standalone** (sans Metro, pour distribution) :

#### Android
```bash
npm run android:release
```
→ Build standalone Release
→ Bundle ID : `com.pensine.app`
→ Icône normale

#### iOS
```bash
npm run ios:release
```
→ Build standalone Release
→ Bundle ID : `com.pensine.app`
→ Icône normale

## Prebuild avec variante spécifique

### Version Dev (par défaut)
```bash
npm run prebuild         # Prebuild Dev
npm run prebuild:clean   # Prebuild Dev (clean)
```

### Version Release
```bash
npm run prebuild:release        # Prebuild Release
npm run prebuild:release:clean  # Prebuild Release (clean)
```

## Notes importantes

### Expo Dev Client ✅
Cette configuration fonctionne avec **Expo Dev Client** (pas besoin d'EAS Build).

### URL Schemes
Les deux apps ont des URL schemes différents :
- Release : `pensine://auth/callback`
- Dev : `pensine-dev://auth/callback`

Assure-toi que ton backend Supabase accepte les deux URLs dans la configuration OAuth.

### Deep Links
Les intent filters Android utilisent également des schemes différents, donc chaque app reçoit ses propres deep links sans conflit.

## Workflow typique

1. **Setup initial - Build version Release** (une seule fois) :
   ```bash
   npm run android:release
   # ou
   npm run ios:release
   ```
   → Installe la version stable `com.pensine.app` sur ton appareil

2. **Développement quotidien avec Metro** :
   ```bash
   npm run android
   # ou
   npm run ios
   ```
   → Lance Metro + installe/lance la version Dev `com.pensine.app.dev`
   → Hot reload, fast refresh, etc.

3. **Résultat : Les deux apps coexistent** sur l'appareil :
   - **Pensieve** (icône normale) = version release stable pour démo
   - **Pensieve Dev** (icône avec badge DEV) = version développement quotidien

## Dépannage

### Les deux apps ont le même nom
→ Vérifie que `app.config.js` est bien lu (supprime `app.json` si nécessaire)

### Icônes identiques
→ Assure-toi que les icônes `icon-dev.png` et `adaptive-icon-dev.png` existent dans `assets/`

### URL schemes en conflit
→ Vérifie que les schemes sont bien différents (`pensine` vs `pensine-dev`)

### Problème de cache
→ Nettoie et recompile :
```bash
npm run prebuild:dev:clean
npm run build:dev:ios
```
