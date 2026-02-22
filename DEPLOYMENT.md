# Procédure de déploiement — Pensieve

## Prérequis

- Docker installé et connecté au registry : `docker login cregistry.yolo.yt`
- Node 22 + Android SDK (pour l'APK)
- Portainer accessible sur le homelab

---

## 1. Backend / Web / Admin (homelab via Portainer)

### 1.1 Construire et pousser les images

Depuis la racine de `pensieve/` :

```bash
# Backend
cd backend && ./publish.sh && cd ..

# Web (bake NEXT_PUBLIC_API_URL=https://api.pensine.pro)
cd web && NEXT_PUBLIC_API_URL=https://api.pensine.pro ./publish.sh && cd ..

# Admin (bake NEXT_PUBLIC_API_URL=https://api.pensine.pro)
cd admin && NEXT_PUBLIC_API_URL=https://api.pensine.pro ./publish.sh && cd ..
```

> Les scripts ciblent `cregistry.yolo.yt` par défaut.
> Pour forcer une version : `VERSION=v1.2.0 ./publish.sh`

### 1.2 Vérifier les images dans le registry

```bash
make list                          # liste toutes les images
make tags IMAGE=pensine-backend    # liste les tags d'une image
```

### 1.3 Variables d'environnement Portainer requises

Vérifier que ces variables sont présentes dans Portainer avant de redéployer :

| Variable                                    | Valeur                                    |
|---------------------------------------------|-------------------------------------------|
| `BACKEND_VERSION`                           | `latest` (ou tag spécifique)              |
| `WEB_VERSION`                               | `latest`                                  |
| `ADMIN_VERSION`                             | `latest`                                  |
| `BETTER_AUTH_SECRET`                        | secret généré (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL`                           | `https://api.pensine.pro`                 |
| `RESEND_API_KEY`                            | clé Resend                                |
| `POSTGRES_PASSWORD`                         | mot de passe PostgreSQL                   |
| `RABBITMQ_PASSWORD`                         | mot de passe RabbitMQ                     |
| `MINIO_ROOT_USER`                           | accès MinIO                               |
| `MINIO_ROOT_PASSWORD`                       | secret MinIO                              |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google                              |
| `HF_CLIENT_ID` / `HF_CLIENT_SECRET`         | OAuth HuggingFace                         |

### 1.4 Migrations base de données

Les migrations ne s'exécutent **pas** automatiquement par défaut (`RUN_MIGRATIONS=false`).

**Lors d'un déploiement avec nouvelles migrations :**

1. Ajouter `RUN_MIGRATIONS=true` dans les variables Portainer
2. Redéployer le service backend (Portainer → stack → update)
3. Vérifier les logs du container : `✅ Successfully ran N migration(s)`
4. Retirer `RUN_MIGRATIONS=true` (ou le repasser à `false`)

> Les migrations sont idempotentes — TypeORM ne rejoue pas celles déjà appliquées.

### 1.5 Redéployer via Portainer

Dans Portainer :
1. Aller dans **Stacks** → sélectionner la stack pensine
2. **Pull** les nouvelles images (ou mettre à jour le tag de version)
3. **Update the stack** → les containers redémarrent avec les nouvelles images

---

## 2. App Center (portail de distribution APK)

### 2.1 Construire et pousser l'image

```bash
cd app-center && ./publish.sh && cd ..
# ou via Makefile :
make release-app-center
```

### 2.2 Variables d'environnement Portainer requises

| Variable            | Valeur                          |
|---------------------|---------------------------------|
| `MINIO_ENDPOINT_URL`| `http://minio:9000`             |
| `MINIO_REGION`      | `us-east-1`                     |
| `MINIO_ACCESS_KEY`  | accès MinIO                     |
| `MINIO_SECRET_KEY`  | secret MinIO                    |
| `MINIO_BUCKET`      | `pensine-apks`                  |
| `ACCESS_TOKEN`      | token fort (accès au portail)   |

### 2.3 Créer le bucket MinIO

Via la console MinIO ou mc :

```bash
mc alias set pensine http://minio.homelab.local:9000 <ACCESS_KEY> <SECRET_KEY>
mc mb pensine/pensine-apks
```

### 2.4 Redéployer via Portainer

Même procédure que les autres services (section 1.5).

---

## 3. APK Android release (installation directe, sans Play Store)

### 3.1 Prérequis mobiles

- `mobile/.env` doit pointer sur la production :
  ```
  EXPO_PUBLIC_API_URL=https://api.pensine.pro
  EXPO_PUBLIC_BETTER_AUTH_URL=https://api.pensine.pro
  ```
  *(déjà configuré — ne pas modifier)*

- Android SDK installé (`ANDROID_HOME` dans le PATH)
- Java 17+ disponible

### 3.2 Regénérer le projet natif en variante release

> À refaire uniquement quand `app.config.js` ou les plugins Expo changent.

```bash
cd mobile
APP_VARIANT=release npx expo prebuild --platform android --clean
```

Résultat : `android/` regénéré avec :
- `applicationId = com.pensine.app`
- `scheme = pensine`
- Icône et nom release

### 3.3 Builder l'APK

```bash
cd mobile/android
./gradlew assembleRelease
```

APK généré dans :
```
mobile/android/app/build/outputs/apk/release/app-release.apk
```

> La signature utilise le debug.keystore (suffisant pour installation directe).
> Pour un APK signé avec une clé dédiée, voir section 2.5.

### 3.4 Installer l'APK sur le device

**Option A — via ADB (device connecté en USB) :**
```bash
adb install mobile/android/app/build/outputs/apk/release/app-release.apk
```

**Option B — via App Center (recommandé) :**
1. Configurer `mobile/scripts/.env` (voir `.env.example`)
2. Depuis `pensieve/mobile/` :
   ```bash
   ./scripts/build-and-push.sh
   ```
3. Ouvrir l'App Center → télécharger l'APK depuis le portail
4. Sur le device : **Paramètres → Sécurité → Sources inconnues** → autoriser
5. Ouvrir le fichier APK → Installer

**Option C — transfert manuel :**
1. Copier l'APK sur le device (AirDrop, câble, Google Drive…)
2. Sur le device : **Paramètres → Sécurité → Sources inconnues** → autoriser
3. Ouvrir le fichier APK → Installer

> Si une version dev (`com.pensine.app.dev`) est installée, les deux coexistent — identifiants différents.

### 3.5 Signature avec keystore dédié (optionnel, recommandé hors démo)

```bash
# Générer un keystore release
keytool -genkey -v \
  -keystore mobile/android/app/pensine-release.keystore \
  -alias pensine \
  -keyalg RSA -keysize 2048 \
  -validity 10000

# Ajouter dans mobile/android/gradle.properties :
PENSINE_RELEASE_STORE_FILE=pensine-release.keystore
PENSINE_RELEASE_KEY_ALIAS=pensine
PENSINE_RELEASE_STORE_PASSWORD=<mot de passe>
PENSINE_RELEASE_KEY_PASSWORD=<mot de passe>
```

Puis mettre à jour `mobile/android/app/build.gradle` → `signingConfigs.release`.

---

## 4. Ordre de déploiement recommandé

```
1. postgres + rabbitmq + minio   → déjà up sur homelab
2. backend                       → avec RUN_MIGRATIONS=true si nouvelles migrations
3. web + admin + app-center      → après backend healthy
4. APK                           → ./scripts/build-and-push.sh → télécharger depuis app-center
```

---

*Dernière mise à jour : 2026-02-22*
