# Configuration OAuth Google pour Android

## Sommaire

1. [Qu'est-ce que l'empreinte SHA-1 ?](#quest-ce-que-lempreinte-sha-1-)
2. [Pourquoi Google en a besoin ?](#pourquoi-google-en-a-besoin-)
3. [Les différents keystores](#les-différents-keystores)
4. [Obtenir les empreintes SHA-1](#obtenir-les-empreintes-sha-1)
5. [Configuration Google Cloud Console](#configuration-google-cloud-console)
6. [Configuration pour Expo/EAS Build](#configuration-pour-expoeas-build)
7. [Troubleshooting](#troubleshooting)

---

## Qu'est-ce que l'empreinte SHA-1 ?

L'empreinte SHA-1 (aussi appelée "fingerprint" ou "certificate hash") est un identifiant unique de 40 caractères hexadécimaux généré à partir du certificat de signature de votre application Android.

**Format** : `XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX`

**Exemple** : `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

Chaque application Android est signée avec un certificat stocké dans un fichier appelé **keystore**. L'empreinte SHA-1 est dérivée de ce certificat et permet d'identifier de manière unique qui a signé l'application.

---

## Pourquoi Google en a besoin ?

Google utilise l'empreinte SHA-1 pour **sécuriser l'authentification OAuth** :

1. **Vérification de l'origine** : Quand votre app demande une authentification Google, Google vérifie que la requête provient bien de votre application légitime (et non d'une app malveillante qui usurperait votre identité).

2. **Association Package + Fingerprint** : Google associe :
   - Le **package name** de votre app (`com.pensine.app`)
   - L'**empreinte SHA-1** du certificat de signature

   Si les deux ne correspondent pas, l'authentification est refusée.

3. **Protection contre le spoofing** : Même si quelqu'un crée une app avec le même package name, il ne pourra pas reproduire votre empreinte SHA-1 sans posséder votre keystore privé.

---

## Les différents keystores

### 1. Debug Keystore (Développement)

- **Usage** : Builds de développement locaux (`expo run:android`, `npx react-native run-android`)
- **Emplacement par défaut** : `~/.android/debug.keystore`
- **Emplacement Expo** : `android/app/debug.keystore`
- **Credentials** :
  - Alias : `androiddebugkey`
  - Store password : `android`
  - Key password : `android`
- **Particularité** : Généré automatiquement par Android Studio/SDK. Identique sur toutes les machines de développement (credentials standard).

### 2. Release/Upload Keystore (Production)

- **Usage** : Builds de production publiés sur le Play Store
- **Emplacement** : Défini par vous (ex: `android/app/release.keystore`)
- **Credentials** : Définis par vous lors de la création
- **Particularité** : **CONFIDENTIEL ET UNIQUE**. Si vous le perdez, vous ne pourrez plus mettre à jour votre app sur le Play Store.

### 3. Google Play App Signing (Recommandé)

Depuis 2021, Google recommande d'utiliser **Play App Signing** :

- **Upload Key** : Votre clé locale pour signer les builds uploadés
- **App Signing Key** : Clé gérée par Google qui signe l'APK final distribué aux utilisateurs

Dans ce cas, vous aurez **deux empreintes SHA-1** différentes :
- Celle de votre Upload Key (pour les tests internes)
- Celle de l'App Signing Key de Google (pour les utilisateurs finaux)

---

## Obtenir les empreintes SHA-1

### Debug Keystore (Expo)

```bash
keytool -list -v \
  -keystore android/app/debug.keystore \
  -alias androiddebugkey \
  -storepass android \
  -keypass android
```

### Debug Keystore (Standard Android)

```bash
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey \
  -storepass android \
  -keypass android
```

### Release Keystore

```bash
keytool -list -v \
  -keystore /chemin/vers/votre/release.keystore \
  -alias votre_alias
# Vous serez invité à entrer le mot de passe
```

### EAS Build (Expo Application Services)

Si vous utilisez EAS Build, les credentials sont gérées par Expo :

```bash
# Voir les credentials Android
eas credentials --platform android

# Télécharger le keystore
eas credentials --platform android
# Puis sélectionner "Download" dans le menu
```

Une fois téléchargé, utilisez `keytool` avec les credentials affichées par EAS.

### Google Play Console (App Signing Key)

Si vous utilisez Play App Signing :

1. Allez sur [Google Play Console](https://play.google.com/console)
2. Sélectionnez votre application
3. **Configuration** → **Intégrité de l'application** → **Signature d'application**
4. Vous y trouverez les empreintes SHA-1 et SHA-256 de :
   - Certificat de signature d'application (utilisé pour signer l'APK distribué)
   - Certificat d'importation (votre upload key)

---

## Configuration Google Cloud Console

### Étape 1 : Créer un projet

1. Allez sur [Google Cloud Console](https://console.cloud.google.com)
2. Créez un nouveau projet ou sélectionnez un existant
3. Notez l'**ID du projet**

### Étape 2 : Activer l'API Google Calendar

1. **APIs et services** → **Bibliothèque**
2. Recherchez "Google Calendar API"
3. Cliquez sur **Activer**

### Étape 3 : Configurer l'écran de consentement OAuth

1. **APIs et services** → **Écran de consentement OAuth**
2. Choisissez **Externe** (sauf si vous avez un compte Workspace)
3. Remplissez les informations :
   - Nom de l'application : `Pensine`
   - Email d'assistance : votre email
   - Logo (optionnel)
4. **Champs d'application (Scopes)** : Ajoutez :
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/userinfo.email`
5. **Utilisateurs test** : Ajoutez votre email (nécessaire tant que l'app n'est pas vérifiée)

### Étape 4 : Créer les identifiants OAuth

#### Pour Android :

1. **APIs et services** → **Identifiants** → **Créer des identifiants** → **ID client OAuth**
2. Type d'application : **Android**
3. Nom : `Pensine Android`
4. **Nom du package** : `com.pensine.app`
5. **Empreinte du certificat SHA-1** : Collez votre empreinte

**Important** : Créez **plusieurs** ID clients Android si nécessaire :
- Un avec l'empreinte **debug** (développement)
- Un avec l'empreinte **release/upload** (production)
- Un avec l'empreinte **Play App Signing** (si utilisé)

#### Pour iOS :

1. Type d'application : **iOS**
2. Nom : `Pensine iOS`
3. **Bundle ID** : `com.pensine.app`

#### Pour le développement Expo (Web) :

1. Type d'application : **Application Web**
2. Nom : `Pensine Dev`
3. **Origines JavaScript autorisées** :
   - `https://auth.expo.io`
4. **URI de redirection autorisés** :
   - `https://auth.expo.io/@votre-username/pensine`

### Étape 5 : Récupérer le Client ID

Après création, vous obtenez un **Client ID** au format :
```
123456789-abcdefghijklmnop.apps.googleusercontent.com
```

Ajoutez-le dans votre `.env` :
```env
EXPO_PUBLIC_GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
```

---

## Configuration pour Expo/EAS Build

### Structure recommandée

Pour une app Expo en production, vous devrez configurer :

| Environnement | Keystore | Où configurer l'empreinte |
|---------------|----------|---------------------------|
| Dev local (`expo run:android`) | `android/app/debug.keystore` | Google Cloud Console (ID client Android) |
| EAS Build Development | Géré par EAS | Google Cloud Console (ID client Android) |
| EAS Build Preview | Géré par EAS | Google Cloud Console (ID client Android) |
| EAS Build Production | Géré par EAS ou custom | Google Cloud Console + Play Console |

### Obtenir l'empreinte EAS

```bash
# Afficher les credentials
eas credentials --platform android

# Output exemple :
# Keystore
#   Type: Google Play App Signing
#   Key Alias: your-key-alias
#   SHA-1 Fingerprint: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
```

### Configuration app.json pour OAuth

```json
{
  "expo": {
    "android": {
      "package": "com.pensine.app",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "pensine",
              "host": "auth",
              "pathPrefix": "/google"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

---

## Troubleshooting

### Erreur : "The OAuth client was not found"

**Cause** : Le Client ID n'existe pas ou est mal configuré.

**Solution** :
1. Vérifiez que vous utilisez le bon Client ID
2. Vérifiez que l'ID client est de type Android (pas Web ou iOS)

### Erreur : "SHA-1 certificate fingerprint does not match"

**Cause** : L'empreinte SHA-1 de votre build ne correspond pas à celle configurée dans Google Cloud Console.

**Solutions** :
1. Vérifiez que vous utilisez le bon keystore (debug vs release)
2. Ajoutez les deux empreintes (debug ET release) dans Google Cloud Console
3. Si vous utilisez EAS Build, récupérez l'empreinte via `eas credentials`

### Erreur : "This app isn't verified"

**Cause** : L'écran de consentement OAuth n'est pas vérifié par Google.

**Solutions** :
1. En développement : Ajoutez votre email comme "utilisateur test" dans l'écran de consentement
2. En production : Soumettez votre app à la vérification Google (peut prendre plusieurs semaines)

### Erreur : "redirect_uri_mismatch"

**Cause** : L'URI de redirection utilisée par l'app ne correspond pas à celle configurée.

**Solutions** :
1. Vérifiez le scheme dans `app.json` (`pensine://`)
2. Pour Expo, l'URI par défaut est : `https://auth.expo.io/@username/slug`
3. Ajoutez toutes les URI possibles dans les "URI de redirection autorisés"

### L'authentification fonctionne en dev mais pas en production

**Causes possibles** :
1. L'empreinte de production n'est pas configurée
2. Si vous utilisez Play App Signing, l'empreinte change après upload sur le Play Store

**Solution** :
1. Récupérez l'empreinte depuis Google Play Console
2. Ajoutez-la comme nouveau client OAuth ou à un client existant

---

## Checklist finale

- [ ] Debug SHA-1 ajoutée dans Google Cloud Console
- [ ] Release/Upload SHA-1 ajoutée dans Google Cloud Console
- [ ] Play App Signing SHA-1 ajoutée (si applicable)
- [ ] API Google Calendar activée
- [ ] Écran de consentement configuré
- [ ] Scopes appropriés ajoutés
- [ ] Utilisateurs test ajoutés (si app non vérifiée)
- [ ] Client ID dans `.env` (`EXPO_PUBLIC_GOOGLE_CLIENT_ID`)
- [ ] Intent filters configurés dans `app.json`

---

## Empreintes du projet Pensine

### Debug (Développement local)

```
SHA-1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

Source : `android/app/debug.keystore`

### Production

À compléter après configuration EAS Build ou création du keystore de release.

---

## Ressources

- [Documentation Google OAuth pour Android](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Expo AuthSession](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [EAS Credentials](https://docs.expo.dev/app-signing/managed-credentials/)
- [Google Cloud Console](https://console.cloud.google.com)
- [Google Play Console - App Signing](https://play.google.com/console)
