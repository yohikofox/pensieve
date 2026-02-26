# Pensine - Source Code Repository

**Version:** 1.0.0
**Architecture:** Hybrid (Supabase Cloud Auth + Homelab Storage)

Ce repository contient le code source de l'application Pensine :
- **Mobile:** React Native avec Expo SDK 54 (iOS & Android)
- **Backend:** NestJS 11 API avec architecture DDD
- **Web:** Dashboard Next.js 15
- **Admin:** Interface d'administration Next.js 15
- **App Center:** Portail de distribution d'APK

---

## 📁 Structure du Projet

```
pensieve/
├── infrastructure/       # Docker Compose infrastructure
│   ├── docker-compose.yml  # PostgreSQL, RabbitMQ, MinIO
│   ├── .env.example        # Template variables d'environnement
│   └── README.md           # Guide setup infrastructure
│
├── mobile/               # Application mobile (React Native + Expo SDK 54)
│   ├── src/
│   │   ├── config/        # Bootstrap + configuration
│   │   ├── database/      # OP-SQLite (offline storage, sync queries)
│   │   ├── design-system/ # Tokens NativeWind/Tailwind
│   │   ├── infrastructure/
│   │   │   └── di/        # TSyringe DI container + tokens
│   │   ├── contexts/      # DDD Bounded Contexts
│   │   │   ├── capture/
│   │   │   ├── knowledge/
│   │   │   ├── action/
│   │   │   ├── identity/
│   │   │   ├── Normalization/ # Transcription (Whisper)
│   │   │   └── shared/        # EventBus, Result pattern
│   │   ├── screens/       # Screen Registry centralisé
│   │   ├── navigation/    # React Navigation v7
│   │   ├── stores/        # Zustand state
│   │   └── components/    # Shared UI components
│   ├── tests/
│   │   ├── acceptance/    # BDD/Gherkin (jest-cucumber)
│   │   └── e2e/           # Detox tests
│   ├── modules/           # Custom native modules (expo-waveform-extractor)
│   ├── _patterns/         # Patterns d'implémentation et snippets de référence
│   ├── app.config.js      # Expo config (variants dev/release)
│   └── package.json
│
├── backend/              # API Backend (NestJS 11)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── shared/        # MinIO, Supabase Auth Guard (@Global)
│   │   │   ├── capture/       # Bounded Context: Capture
│   │   │   ├── knowledge/     # Bounded Context: Knowledge (pipeline AI)
│   │   │   ├── action/        # Bounded Context: Action (Todos)
│   │   │   ├── identity/      # Bounded Context: Identity
│   │   │   ├── authorization/ # RBAC/PBAC/ACL
│   │   │   ├── notification/  # Push notifications
│   │   │   └── rgpd/          # GDPR compliance
│   │   ├── migrations/        # TypeORM migrations (synchronize: false)
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── package.json
│
├── web/                  # Dashboard (Next.js 15, App Router)
│
├── admin/                # Interface admin (Next.js 15, port 3001)
│
└── app-center/           # Portail distribution APK (Next.js 15)
```

---

## 🏗️ Architecture Hybrid

Pensine utilise une architecture hybride pour optimiser les coûts et le time-to-market :

| Service | Provider | Coût | Raison |
|---------|----------|------|---------|
| **Auth** | Supabase Cloud | €0/mois | Social login (Google/Apple) |
| **Storage** | MinIO Homelab | €0/mois | Stockage audio illimité |
| **Backend** | Homelab (Docker) | €0/mois | API & logique métier |
| **Database** | PostgreSQL Homelab | €0/mois | Données applicatives |
| **Queue** | RabbitMQ Homelab | €0/mois | Async processing |

**Accès public sécurisé via Cloudflare Tunnel** (zero port forwarding)

---

## 🚀 Quick Start

### Prérequis

- **Node.js:** 22.x (`nvm use 22`)
- **Docker:** Pour l'infrastructure homelab
- **Expo Dev Client:** Requis — l'app utilise des modules natifs custom (pas Expo Go)

### 1. Infrastructure Homelab

```bash
cd infrastructure

# Copier .env.example vers .env et remplir les credentials
cp .env.example .env

# Démarrer les services Docker
docker compose up -d

# Vérifier que tous les services sont healthy
docker compose ps
```

### 2. Backend (NestJS)

```bash
cd backend
cp .env.example .env
npm install
npm run migration:run
npm run start:dev
# API accessible sur: http://localhost:3000
```

### 3. Mobile (Expo Dev Client)

```bash
cd mobile
npm install

# iOS simulator
npm run ios

# Android emulator
npm run android
```

> ⚠️ **Expo Dev Client obligatoire** — l'app utilise `expo-waveform-extractor` et d'autres modules natifs custom. Expo Go n'est pas compatible.

### 4. Web / Admin

```bash
# Dashboard web
cd web && npm install && npm run dev     # http://localhost:3000

# Interface admin
cd admin && npm install && npm run dev   # http://localhost:3001
```

---

## 🔐 Configuration Supabase

### Étapes

1. **Créer un projet Supabase Cloud** (Gratuit)
   - Suivre les instructions dans: `../_bmad-output/implementation-artifacts/supabase-setup-instructions.md`

2. **Récupérer les credentials**
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGc...
   JWT_SECRET=your-jwt-secret
   ```

3. **Configurer dans le backend**
   - Mettre à jour `backend/.env`

---

## 🚢 Déploiement

Le script `deploy.sh` orchestre en une seule commande :
- Build + push des images Docker vers le registry privé
- Build de l'APK Android + upload vers MinIO
- Mise à jour des variables de version dans la stack + redéploiement

### Prérequis

- **Docker** avec accès au registry privé
- **jq** — `brew install jq`
- **mc** (MinIO client, pour le build APK) — `brew install minio/stable/mc`
- Un **token API** pour le gestionnaire de containers (Portainer)

### Configuration (une seule fois)

```bash
cp deploy.env.example deploy.env
```

Remplir dans `deploy.env` les credentials du registry, de MinIO, et le token Portainer.

### Utilisation

```bash
# Deploy complet (Docker + APK Android + redeploy)
make deploy

# Docker uniquement (sans build APK mobile)
make deploy-services

# APK Android uniquement
make deploy-mobile

# Tester sans rien exécuter
./deploy.sh --dry-run

# Déployer un ou plusieurs composants spécifiques
./deploy.sh --only=backend,web
```

---

## 📦 Dépendances Principales

### Mobile

- **Expo SDK 54:** Framework React Native
- **tsyringe:** Injection de dépendances (DI container)
- **@op-engineering/op-sqlite:** Base de données locale offline-first (sync queries)
- **@tanstack/react-query:** Server state management
- **zustand:** Client state management
- **@react-navigation/native (v7):** Navigation entre écrans
- **nativewind:** Tailwind CSS pour React Native
- **@supabase/supabase-js:** Client Supabase pour auth
- **whisper.rn:** Transcription audio on-device
- **expo-llm-mediapipe:** Inférence LLM locale
- **@react-native-async-storage/async-storage:** Stockage clé-valeur

### Backend

- **@nestjs/core (v11):** Framework NestJS
- **@nestjs/typeorm + typeorm + pg:** ORM PostgreSQL
- **@nestjs/microservices + amqplib:** RabbitMQ integration
- **minio:** Client MinIO pour storage S3-compatible
- **winston:** Logging structuré

---

## 🧪 Tests

### Backend

```bash
cd backend

npm run test              # Tests unitaires (*.spec.ts dans src/)
npm run test:acceptance   # BDD/Gherkin (test/acceptance/)
npm run test:e2e          # Tests E2E
npm run test:cov          # Coverage
```

### Mobile

```bash
cd mobile

npm run test:unit         # Tests unitaires (src/**/*.test.ts)
npm run test:acceptance   # BDD/Gherkin (tests/acceptance/)
npm run test:architecture # Tests d'architecture (dépendances circulaires, etc.)
npm run test:e2e          # Detox E2E (iOS)
```

> **Note:** Jest utilise `babel-jest` (pas `jest-expo`) — incompatibilité Expo SDK 54 Winter runtime avec l'environnement Node.js de test. Les tests acceptance utilisent `ts-jest`.

---

## 🛠️ Scripts Utiles

### Backend

```bash
npm run start:dev          # Dev avec watch mode (port 3000)
npm run build              # Build production
npm run lint               # ESLint auto-fix
npm run format             # Prettier
npm run migration:run      # Appliquer les migrations TypeORM
npm run seed:authorization # Seeder les permissions RBAC
```

### Mobile

```bash
npm run ios                # iOS simulator (dev variant)
npm run android            # Android emulator (dev variant)
npm run ios:release        # iOS release variant
npm run prebuild:clean     # Regénérer les projets natifs
npm run check:deps         # Vérifier dépendances circulaires (madge)
npm run wipe:ios           # Reset simulateur iOS + relance
```

---

## 📚 Documentation

- **Architecture complète:** `../_bmad-output/planning-artifacts/architecture.md`
- **Stories d'implémentation:** `../_bmad-output/implementation-artifacts/stories/`
- **Sprint status:** `../_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Patterns de code:** `mobile/_patterns/`
- **Setup Supabase:** `../_bmad-output/implementation-artifacts/supabase-setup-instructions.md`
- **Setup Cloudflare Tunnel:** `../_bmad-output/implementation-artifacts/cloudflare-tunnel-setup-instructions.md`

---

## 🔗 Liens Utiles

- [Expo Documentation](https://docs.expo.dev/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [OP-SQLite Documentation](https://op-engineering.github.io/op-sqlite/)
- [TSyringe Documentation](https://github.com/microsoft/tsyringe)
- [NativeWind Documentation](https://www.nativewind.dev/)

---

## 🤝 Contribution

Ce projet suit l'architecture **DDD par Bounded Contexts** et une gouvernance stricte des ADR.

Avant de contribuer:
1. Lire les ADR dans `../docs/adr/`
2. Consulter `CLAUDE.md` pour les règles architecturales
3. Suivre la structure DDD établie
4. Respecter les conventions de code (ESLint/Prettier)
5. **Ne jamais remplacer une librairie prescrite par un ADR sans validation de l'architecte**

---

## 📝 License

[À définir]

---

**Pensine MVP - Hybrid Architecture**
*Time-to-market optimal avec coûts €0/mois*
