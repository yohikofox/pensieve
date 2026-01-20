# Pensine - Source Code Repository

**Version:** 1.0.0
**Architecture:** Hybrid (Supabase Cloud Auth + Homelab Storage)

Ce repository contient le code source de l'application Pensine :
- **Mobile:** React Native avec Expo (iOS & Android)
- **Backend:** NestJS API avec architecture DDD

---

## 📁 Structure du Projet

```
pensieve/
├── infrastructure/      # Docker Compose infrastructure
│   ├── docker-compose.yml  # PostgreSQL, RabbitMQ, MinIO
│   ├── .env.example        # Template variables d'environnement
│   └── README.md           # Guide setup infrastructure
│
├── mobile/               # Application mobile (React Native + Expo)
│   ├── src/
│   │   ├── lib/         # Supabase client, utilities
│   │   ├── database/    # WatermelonDB (offline storage)
│   │   ├── contexts/    # DDD Bounded Contexts
│   │   │   ├── capture/
│   │   │   ├── knowledge/
│   │   │   ├── opportunity/
│   │   │   ├── action/
│   │   │   └── identity/
│   │   ├── navigation/  # React Navigation setup
│   │   ├── hooks/       # Custom React hooks
│   │   └── components/  # Shared UI components
│   ├── app.json         # Expo configuration
│   └── package.json
│
└── backend/             # API Backend (NestJS)
    ├── src/
    │   ├── modules/
    │   │   ├── shared/       # Shared infrastructure
    │   │   │   └── infrastructure/
    │   │   │       ├── guards/   # Supabase Auth Guard
    │   │   │       └── storage/  # MinIO Service
    │   │   ├── capture/      # Bounded Context: Capture
    │   │   ├── knowledge/    # Bounded Context: Knowledge
    │   │   ├── opportunity/  # Bounded Context: Opportunity
    │   │   ├── action/       # Bounded Context: Action
    │   │   └── identity/     # Bounded Context: Identity
    │   ├── app.module.ts
    │   └── main.ts
    └── package.json
```

---

## 🏗️ Architecture Hybrid

Pensine utilise une architecture hybride pour optimiser les coûts et le time-to-market :

| Service | Provider | Coût | Raison |
|---------|----------|------|---------|
| **Auth** | Supabase Cloud | €0/mois | Social login trivial (Google/Apple) |
| **Storage** | MinIO Homelab | €0/mois | Stockage audio illimité |
| **Backend** | Homelab (Docker) | €0/mois | API & logique métier |
| **Database** | PostgreSQL Homelab | €0/mois | Données applicatives |
| **Queue** | RabbitMQ Homelab | €0/mois | Async processing |

**Accès public sécurisé via Cloudflare Tunnel** (zero port forwarding)

---

## 🚀 Quick Start

### Prérequis

- **Node.js:** >= 20.19.4 (utiliser `nvm use 22` recommandé)
- **Docker:** Pour l'infrastructure homelab
- **Expo CLI:** Pour le développement mobile

### 1. Infrastructure Homelab

```bash
cd infrastructure

# Copier .env.example vers .env et remplir les credentials
cp .env.example .env

# Éditer le fichier et ajouter vos credentials Supabase
nano .env

# Démarrer les services Docker
docker-compose up -d

# Vérifier que tous les services sont healthy
docker-compose ps

# Voir le README complet pour l'initialisation MinIO
cat README.md
```

### 2. Backend (NestJS)

```bash
cd backend

# Copier .env.example vers .env et configurer
cp .env.example .env

# Installer les dépendances
npm install

# Démarrer en mode développement
npm run start:dev

# API accessible sur: http://localhost:3000
```

### 3. Mobile (Expo)

```bash
cd mobile

# Installer les dépendances
npm install

# Configurer les credentials Supabase dans src/lib/supabase.ts
# Ou utiliser les variables d'environnement Expo

# Démarrer Expo
npx expo start

# Scanner le QR code avec Expo Go (dev)
# Ou lancer sur simulateur iOS/Android
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

3. **Configurer dans le mobile**
   - Mettre à jour `mobile/src/lib/supabase.ts`

4. **Configurer dans le backend**
   - Mettre à jour `backend/.env`

---

## 📦 Dépendances Principales

### Mobile

- **Expo:** Framework React Native
- **@supabase/supabase-js:** Client Supabase pour auth
- **@nozbe/watermelondb:** Base de données locale offline-first
- **@react-navigation:** Navigation entre écrans
- **@react-native-async-storage:** Stockage local

### Backend

- **@nestjs/core:** Framework NestJS
- **@nestjs/typeorm + typeorm + pg:** ORM PostgreSQL
- **@supabase/supabase-js:** Validation JWT Supabase
- **minio:** Client MinIO pour storage S3-compatible
- **@nestjs/microservices + amqplib:** RabbitMQ integration

---

## 🧪 Tests

### Backend

```bash
cd backend

# Tests unitaires
npm run test

# Tests e2e
npm run test:e2e

# Coverage
npm run test:cov
```

### Mobile

```bash
cd mobile

# Tests (à configurer dans les stories suivantes)
npm test
```

---

## 🛠️ Scripts Utiles

### Backend

```bash
# Développement avec watch mode
npm run start:dev

# Build production
npm run build

# Lancer en production
npm run start:prod

# Linting
npm run lint

# Format code
npm run format
```

### Mobile

```bash
# Démarrer Expo
npx expo start

# Lancer sur iOS simulator
npx expo start --ios

# Lancer sur Android emulator
npx expo start --android

# Build pour production
npx expo build:ios
npx expo build:android
```

---

## 📚 Documentation

- **Architecture complète:** `../_bmad-output/planning-artifacts/architecture.md`
- **ADR-016 (Hybrid Architecture):** Voir docs/adr/
- **Setup Supabase:** `../_bmad-output/implementation-artifacts/supabase-setup-instructions.md`
- **Setup Cloudflare Tunnel:** `../_bmad-output/implementation-artifacts/cloudflare-tunnel-setup-instructions.md`
- **Stories d'implémentation:** `../_bmad-output/implementation-artifacts/`

---

## 🔗 Liens Utiles

- [Supabase Dashboard](https://supabase.com/dashboard)
- [Cloudflare Zero Trust](https://dash.cloudflare.com)
- [Expo Documentation](https://docs.expo.dev/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [WatermelonDB Documentation](https://watermelondb.dev/docs)

---

## 🤝 Contribution

Ce projet suit l'approche **From Scratch** (ADR-007) et l'architecture **DDD par Bounded Contexts**.

Avant de contribuer:
1. Lire les ADR dans `../docs/adr/`
2. Suivre la structure DDD établie
3. Respecter les conventions de code (ESLint/Prettier)

---

## 📝 License

[À définir]

---

**Pensine MVP - Hybrid Architecture**
*Time-to-market optimal avec coûts €0/mois*
