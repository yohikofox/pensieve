# Pensieve Admin Backoffice

Backoffice d'administration pour Pensieve, construit avec Next.js 15, shadcn/ui, et TanStack Table.

## 🚀 Démarrage Rapide

### 1. Installer les dépendances

```bash
cd admin
npm install
```

### 2. Configurer les variables d'environnement

Copier `.env.example` vers `.env.local` et remplir les valeurs :

```bash
cp .env.example .env.local
```

Variables requises :
- `NEXT_PUBLIC_API_URL` : URL du backend (ex: `http://localhost:3000`)
- `NEXT_PUBLIC_SUPABASE_URL` : URL Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` : Clé anonyme Supabase

### 3. Lancer le serveur de développement

```bash
npm run dev
```

L'application sera disponible sur `http://localhost:3001`

## 📦 Installation des composants shadcn/ui

Les composants shadcn/ui doivent être installés manuellement :

```bash
# Composants essentiels
npx shadcn@latest add button
npx shadcn@latest add table
npx shadcn@latest add form
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add select
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add badge
npx shadcn@latest add card
npx shadcn@latest add toast
npx shadcn@latest add separator
npx shadcn@latest add avatar
npx shadcn@latest add switch
```

Ou installer tous en une commande :

```bash
npx shadcn@latest add button table form input label select dialog dropdown-menu badge card toast separator avatar switch
```

## 🏗️ Architecture

### Structure du projet

```
admin/
├── app/                      # Pages Next.js (App Router)
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Homepage placeholder
│   ├── login/                # Login page (À CRÉER)
│   └── (dashboard)/          # Protected routes (À CRÉER)
│       ├── layout.tsx        # Dashboard layout avec sidebar
│       ├── page.tsx          # Dashboard overview
│       ├── users/            # Gestion utilisateurs
│       ├── roles/            # Gestion rôles
│       ├── permissions/      # Gestion permissions
│       └── subscriptions/    # Gestion tiers
│
├── components/
│   ├── ui/                   # Composants shadcn/ui (auto-générés)
│   └── admin/                # Composants admin custom (À CRÉER)
│       ├── data-table.tsx    # TanStack Table wrapper
│       ├── crud-list.tsx     # Pattern List générique
│       ├── crud-form.tsx     # Pattern Form générique
│       ├── page-header.tsx   # Header de page
│       └── sidebar-nav.tsx   # Navigation sidebar
│
└── lib/
    ├── api-client.ts         # ✅ Client API TypeScript
    ├── auth.ts               # ✅ Supabase client-side auth
    └── utils.ts              # ✅ Helper cn()
```

## ✅ Statut d'implémentation

### Backend (✅ Complété)

- [x] AdminController avec tous les endpoints
- [x] DTOs de validation
- [x] Permission `admin.access` dans le seed
- [x] Enregistrement dans AuthorizationModule

### Frontend - Base (✅ Complété)

- [x] Package Next.js 15 bootstrappé
- [x] Configuration TypeScript strict
- [x] Tailwind CSS + shadcn/ui setup
- [x] Client API TypeScript complet
- [x] Client auth Supabase
- [x] Dockerfile production-ready
- [x] Makefile targets (build-admin, push-admin, release-admin)

### Frontend - Pages & Composants (✅ Complété)

- [x] Composants shadcn/ui installés
- [x] Composants CRUD réutilisables (data-table, crud-list, crud-form, page-header, sidebar-nav)
- [x] Page de login avec OAuth Google
- [x] Middleware de protection des routes
- [x] Dashboard layout avec sidebar
- [x] Page dashboard overview avec statistiques temps réel
- [x] Pages de gestion :
  - [x] Users management
  - [x] Roles management
  - [x] Permissions management (lecture seule)
  - [x] Subscription tiers management
  - [x] Content moderation (statistiques)

### Prochaines améliorations (optionnel)

- [ ] Formulaires avancés pour assigner permissions aux rôles/tiers
- [ ] Page détails utilisateur avec historique d'actions
- [ ] Graphiques de croissance avec recharts
- [ ] Filtres et recherche avancée sur toutes les pages
- [ ] Export CSV/Excel des données
- [ ] Audit logging (tracer toutes les actions admin)
- [ ] Modération contenu avec pagination et suppression

## 🛠️ Commandes disponibles

```bash
npm run dev      # Dev server (port 3001)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

## 🔒 Sécurité

### Backend

- Tous les endpoints admin sont protégés par :
  - `SupabaseAuthGuard` : Authentification JWT
  - `PermissionGuard` : Vérification de la permission `admin.access`
- Seuls les utilisateurs avec le rôle `admin` peuvent accéder au backoffice

### Frontend

- Middleware Next.js pour protéger toutes les routes sauf `/login`
- Vérification de session Supabase côté serveur
- Token JWT envoyé dans le header `Authorization` pour chaque requête API

## 🚢 Déploiement Docker

```bash
# Build l'image
make build-admin

# Push vers le registry
make push-admin REGISTRY=votre-registry:5000

# Build + push en une commande
make release-admin REGISTRY=votre-registry:5000
```

## 📚 Prochaines étapes

1. **Installer les dépendances** : `npm install`
2. **Installer shadcn/ui composants** : Voir section ci-dessus
3. **Créer les composants CRUD** : Implémenter les patterns réutilisables
4. **Créer les pages** : Login, dashboard, users, roles, etc.
5. **Tester localement** : Vérifier l'intégration avec le backend
6. **Seed admin user** : Créer un utilisateur avec le rôle admin pour tester

## 🔧 Configuration backend

Pour utiliser le backoffice, vous devez :

1. **Lancer le backend** :
```bash
cd ../backend
npm run start:dev
```

2. **Exécuter les migrations** :
```bash
cd ../backend
npm run migration:run
```

3. **Exécuter le seed d'autorisation** :
```bash
cd ../backend
npm run seed:authorization
```

4. **Créer un utilisateur admin** (via script ou manuellement) :
   - Se connecter à l'app mobile/web avec un compte Google
   - Assigner le rôle `admin` à cet utilisateur via SQL :
   ```sql
   INSERT INTO user_roles (user_id, role_id)
   SELECT 'votre-user-id', id FROM roles WHERE name = 'admin';
   ```

## 📖 Documentation API

Tous les endpoints admin sont documentés dans le plan :
- `GET /api/admin/users` : Liste paginée des utilisateurs
- `GET /api/admin/users/:id` : Détails d'un utilisateur
- `POST /api/admin/users/:id/roles` : Assigner un rôle
- `DELETE /api/admin/users/:id/roles/:roleId` : Retirer un rôle
- `POST /api/admin/users/:id/permissions` : Accorder une permission
- `DELETE /api/admin/users/:id/permissions/:permissionId` : Retirer une permission
- `GET /api/admin/roles` : Liste des rôles
- `POST /api/admin/roles` : Créer un rôle
- `PUT /api/admin/roles/:id` : Modifier un rôle
- `DELETE /api/admin/roles/:id` : Supprimer un rôle (sauf système)
- `GET /api/admin/permissions` : Liste des permissions
- `GET /api/admin/permissions/by-resource` : Permissions groupées par type
- `GET /api/admin/tiers` : Liste des tiers d'abonnement
- `POST /api/admin/tiers` : Créer un tier
- `PUT /api/admin/tiers/:id` : Modifier un tier
- `DELETE /api/admin/tiers/:id` : Supprimer un tier
- `GET /api/admin/stats/users` : Statistiques utilisateurs
- `GET /api/admin/stats/subscriptions` : Statistiques abonnements
- `GET /api/admin/stats/content` : Statistiques contenu
- `GET /api/admin/stats/system` : Santé système

Voir `lib/api-client.ts` pour tous les types TypeScript.

---

## 🧪 Guide de test End-to-End

### 1. Prérequis

Avant de tester, assurez-vous que :

```bash
# Backend
cd ../backend
npm install
npm run migration:run
npm run seed:authorization
npm run start:dev

# Admin
cd ../admin
npm install
```

### 2. Créer un utilisateur admin

**Option A : Via l'app mobile**
1. Télécharger et lancer l'app mobile
2. Se connecter avec Google OAuth
3. Récupérer le user ID depuis Supabase ou logs
4. Assigner le rôle admin via SQL :

```sql
-- Se connecter à PostgreSQL
psql -U votre_user -d pensieve

-- Assigner le rôle admin
INSERT INTO user_roles (user_id, role_id)
SELECT 'votre-user-id-supabase', id FROM roles WHERE name = 'admin';
```

**Option B : Via SQL direct**
1. Créer un utilisateur Supabase manuellement
2. Insérer dans la table users :

```sql
INSERT INTO users (id, email, status)
VALUES ('uuid-from-supabase', 'admin@example.com', 'active');

INSERT INTO user_roles (user_id, role_id)
SELECT 'uuid-from-supabase', id FROM roles WHERE name = 'admin';
```

### 3. Tester le login

```bash
cd admin
npm run dev
# Ouvrir http://localhost:3001
```

1. Cliquer "Se connecter avec Google"
2. Authentifier avec le compte Google lié à l'utilisateur admin
3. Vérifier la redirection vers `/` (dashboard)

### 4. Tester le Dashboard

1. Vérifier que les 4 cartes de stats s'affichent :
   - Total Utilisateurs
   - Revenue MRR
   - Thoughts
   - Système (badge "healthy")

2. Vérifier les sections "Croissance" et "Abonnements par tier"

3. Vérifier la section "Activité récente"

**Si erreur "admin.access"** : Votre utilisateur n'a pas la permission. Vérifiez :

```sql
-- Vérifier que l'utilisateur a le rôle admin
SELECT u.email, r.name
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'votre@email.com';

-- Vérifier que le rôle admin a la permission admin.access
SELECT r.name, p.name
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'admin' AND p.name = 'admin.access';
```

### 5. Tester la gestion des utilisateurs

1. Aller sur `/users`
2. Vérifier la liste paginée des utilisateurs
3. Vérifier les colonnes : Email, Statut, Date création
4. Cliquer "Inviter un utilisateur" (placeholder pour l'instant)

### 6. Tester la gestion des rôles

1. Aller sur `/roles`
2. Vérifier la liste des rôles (admin, user, guest)
3. Cliquer "Nouveau rôle"
4. Remplir le formulaire :
   - Identifiant : `contributor`
   - Nom d'affichage : `Contributeur`
   - Description : `Rôle pour les contributeurs`
   - Rôle système : Non
5. Sauvegarder et vérifier qu'il apparaît dans la liste
6. Cliquer sur l'icône de suppression pour supprimer le rôle custom
7. Vérifier que les rôles système affichent "Système" et ne peuvent pas être supprimés

### 7. Tester la gestion des permissions

1. Aller sur `/permissions`
2. Vérifier la liste complète des permissions
3. Vérifier les colonnes : Nom, Identifiant, Type de ressource, Action, Payant
4. Vérifier les badges colorés pour les actions (READ=gris, DELETE=rouge, etc.)

### 8. Tester la gestion des abonnements

1. Aller sur `/subscriptions`
2. Vérifier la liste des tiers (free, pro, enterprise)
3. Cliquer "Nouveau tier"
4. Remplir le formulaire :
   - Identifiant : `premium`
   - Nom d'affichage : `Premium`
   - Prix mensuel : `19.99`
   - Tier actif : Oui
5. Sauvegarder et vérifier qu'il apparaît dans la liste
6. Vérifier le prix affiché : `€19.99`
7. Supprimer le tier créé (si aucun utilisateur n'est abonné)

### 9. Tester la modération de contenu

1. Aller sur `/content`
2. Vérifier les 3 cartes de stats : Thoughts, Ideas, Todos
3. Vérifier les compteurs : Total + Récent (30 jours)
4. Lire la section "Actions de modération" (fonctionnalités futures)

### 10. Tester la protection des routes

1. Se déconnecter (supprimer les cookies Supabase ou ouvrir en navigation privée)
2. Essayer d'accéder à `http://localhost:3001/`
3. Vérifier la redirection automatique vers `/login`
4. Se reconnecter
5. Vérifier la redirection vers `/`

### 11. Tester sans permission admin

1. Créer un utilisateur sans le rôle admin :

```sql
INSERT INTO users (id, email, status)
VALUES ('autre-uuid', 'user@example.com', 'active');

INSERT INTO user_roles (user_id, role_id)
SELECT 'autre-uuid', id FROM roles WHERE name = 'user';
```

2. Se connecter avec cet utilisateur
3. Vérifier que toutes les requêtes API retournent une erreur 403
4. Vérifier que les pages affichent le message d'erreur "admin.access"

### 12. Vérification finale

**Checklist** :
- [ ] Login OAuth Google fonctionne
- [ ] Middleware redirige vers /login si non authentifié
- [ ] Dashboard affiche les vraies statistiques
- [ ] Page Users affiche la liste paginée
- [ ] Page Roles permet de créer/supprimer des rôles custom
- [ ] Page Permissions affiche toutes les permissions (lecture seule)
- [ ] Page Subscriptions permet de créer/supprimer des tiers
- [ ] Page Content affiche les statistiques de contenu
- [ ] Erreur 403 si utilisateur n'a pas admin.access
- [ ] Tous les endpoints API fonctionnent avec le bon token JWT

---

## 🐛 Troubleshooting

### Erreur "admin.access" sur toutes les pages

**Cause** : L'utilisateur n'a pas la permission admin.access

**Solution** :
1. Vérifier que le rôle admin existe et a la permission :
   ```bash
   cd ../backend
   npm run seed:authorization
   ```
2. Assigner le rôle admin à votre utilisateur (voir section "Créer un utilisateur admin")

### Erreur "API Error: 401" ou "Failed to load users"

**Cause** : Token JWT invalide ou expiré

**Solution** :
1. Supprimer les cookies Supabase (DevTools → Application → Cookies)
2. Se reconnecter
3. Vérifier que NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont corrects

### Erreur "API Error: 500" sur les stats

**Cause** : Migrations non exécutées ou tables manquantes

**Solution** :
```bash
cd ../backend
npm run migration:run
npm run seed:authorization
```

### Les statistiques affichent tous des 0

**Cause** : Base de données vide, pas de données de test

**Solution** :
1. Créer des utilisateurs de test via l'app mobile
2. Créer des thoughts/ideas/todos via l'app
3. Assigner des rôles et abonnements manuellement pour tester

### Le backend ne démarre pas

**Cause** : Variables d'environnement manquantes

**Solution** :
1. Vérifier que `backend/.env` existe et contient :
   - DATABASE_URL
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - JWT_SECRET (pour le backend)
2. Redémarrer le backend : `npm run start:dev`
