# Plan : Système de Permissions Multi-Niveaux pour Pensieve

## Context

L'application Pensieve utilise actuellement Supabase uniquement pour l'authentification, avec une architecture hybride (PostgreSQL homelab + Supabase auth). Les vérifications d'autorisation sont minimalistes et manuelles (quelques checks `userId !== req.user.id` dans les contrôleurs).

**Besoins exprimés :**
- Système de permissions à plusieurs niveaux (RBAC + PBAC + ACL)
- Rôles avec permissions assignées
- Permissions individuelles au niveau utilisateur (overrides)
- Partage de ressources avec rôles (viewer, contributor, admin)
- Intégration future avec paywall (subscription tiers)
- Options payantes dans les permissions

**Contrainte critique : Architecture cloisonnée et évolutive**

La solution doit être architecturée avec une **séparation stricte** entre :
1. L'interface d'autorisation (contrat)
2. L'implémentation concrète (PostgreSQL + NestJS aujourd'hui)
3. Le reste de l'application

Objectif : Permettre demain de remplacer l'implémentation par une solution plus robuste (Supabase RLS, Auth0, Permit.io, CASL, etc.) **sans toucher au code métier**.

---

## 📊 État de l'Implémentation

**Date de dernière mise à jour :** 2026-02-12

### ✅ Phase 1 : Fondations (88% complétée)

- ✅ **Abstraction Layer**
  - `src/modules/authorization/core/interfaces/authorization.interface.ts` - Interface principale IAuthorizationService
  - `src/modules/authorization/core/interfaces/permission-checker.interface.ts` - IPermissionChecker
  - `src/modules/authorization/core/interfaces/resource-access-control.interface.ts` - IResourceAccessControl
  - `src/modules/authorization/core/interfaces/permission.interface.ts` - IPermission
  - `src/modules/authorization/core/interfaces/subscription.interface.ts` - ISubscriptionTier, IUserSubscription
  - `src/modules/authorization/core/enums/` - ResourceType, PermissionAction, ShareRole
  - `src/modules/authorization/core/dtos/` - PermissionCheckParams, ShareResourceParams

- ✅ **Migration TypeORM**
  - `src/migrations/1739450000000-CreateAuthorizationTables.ts` - Migration complète avec 11 tables
  - Tables créées : permissions, roles, role_permissions, user_roles, user_permissions, subscription_tiers, tier_permissions, user_subscriptions, share_roles, share_role_permissions, resource_shares
  - Tous les indexes et foreign keys configurés

- ✅ **Entités TypeORM** (11 entités)
  - `src/modules/authorization/implementations/postgresql/entities/permission.entity.ts`
  - `src/modules/authorization/implementations/postgresql/entities/role.entity.ts`
  - `src/modules/authorization/implementations/postgresql/entities/role-permission.entity.ts`
  - `src/modules/authorization/implementations/postgresql/entities/user-role.entity.ts`
  - `src/modules/authorization/implementations/postgresql/entities/user-permission.entity.ts`
  - `src/modules/authorization/implementations/postgresql/entities/subscription-tier.entity.ts`
  - `src/modules/authorization/implementations/postgresql/entities/tier-permission.entity.ts`
  - `src/modules/authorization/implementations/postgresql/entities/user-subscription.entity.ts`
  - `src/modules/authorization/implementations/postgresql/entities/share-role.entity.ts`
  - `src/modules/authorization/implementations/postgresql/entities/share-role-permission.entity.ts`
  - `src/modules/authorization/implementations/postgresql/entities/resource-share.entity.ts`

- ✅ **Repositories** (6 repositories avec méthodes optimisées)
  - `src/modules/authorization/implementations/postgresql/repositories/permission.repository.ts`
  - `src/modules/authorization/implementations/postgresql/repositories/role.repository.ts`
  - `src/modules/authorization/implementations/postgresql/repositories/user-role.repository.ts`
  - `src/modules/authorization/implementations/postgresql/repositories/user-permission.repository.ts`
  - `src/modules/authorization/implementations/postgresql/repositories/subscription.repository.ts`
  - `src/modules/authorization/implementations/postgresql/repositories/resource-share.repository.ts`

- ✅ **Services (Implémentation PostgreSQL)**
  - `src/modules/authorization/implementations/postgresql/services/postgresql-authorization.service.ts` - Service principal avec résolution multi-niveaux
  - `src/modules/authorization/implementations/postgresql/services/postgresql-permission-checker.service.ts` - Vérification de permissions
  - `src/modules/authorization/implementations/postgresql/services/postgresql-resource-access.service.ts` - Contrôle d'accès aux ressources partagées

- ✅ **Script de Seed**
  - `src/seeds/authorization-seed.ts` - Seed complet avec :
    - 14 permissions (thought, idea, todo avec CRUD + thought.share)
    - 3 rôles système (admin, user, guest)
    - 3 tiers de subscription (free, pro, enterprise)
    - 9 share roles (viewer, contributor, admin pour chaque resource type)
    - Tous les mappings permissions-rôles et permissions-tiers

- ⏳ **Tests unitaires** (reportés pour plus tard)

### ✅ Phase 2 : Guards et Decorators (100% complétée)

- ✅ **Decorators**
  - `src/modules/authorization/infrastructure/decorators/require-permission.decorator.ts` - @RequirePermission
  - `src/modules/authorization/infrastructure/decorators/require-ownership.decorator.ts` - @RequireOwnership
  - `src/modules/authorization/infrastructure/decorators/allow-shared-access.decorator.ts` - @AllowSharedAccess
  - `src/modules/authorization/infrastructure/decorators/current-user.decorator.ts` - @CurrentUser

- ✅ **Guards**
  - `src/modules/authorization/infrastructure/guards/permission.guard.ts` - PermissionGuard
  - `src/modules/authorization/infrastructure/guards/resource-ownership.guard.ts` - ResourceOwnershipGuard
  - `src/modules/authorization/infrastructure/guards/resource-share.guard.ts` - ResourceShareGuard

- ✅ **Module NestJS**
  - `src/modules/authorization/authorization.module.ts` - Configuration DI complète avec bindings swappables

### ✅ Phase 3 : Migration des Controllers (33% complétée)

- ✅ **TodosController migré**
  - `src/modules/action/application/controllers/todos.controller.ts` - Tous les checks manuels supprimés, utilise ResourceOwnershipGuard et PermissionGuard

- ⏳ **ThoughtsController** (à créer)
- ⏳ **IdeasController** (à créer)
- ⏳ **Tests de non-régression**

### ⏳ Phase 4 : Migration des utilisateurs existants (0%)

- ⏳ Script de migration pour assigner role "user" et tier "free"
- ⏳ Tests de vérification d'accès

### ⏳ Phase 5 : Feature Sharing (0%)

- ⏳ Endpoints de partage (POST /api/thoughts/:id/share, DELETE, GET)
- ⏳ Tests E2E du partage

### ⏳ Phase 6 : Subscription System (0%)

- ⏳ Endpoint d'upgrade (placeholder)
- ⏳ Tests de blocage des features payantes

### ⏳ Phase 7 : Documentation & Cleanup (0%)

- ⏳ Documentation des interfaces
- ⏳ Guide de migration
- ⏳ Exemples de code
- ⏳ Cleanup du code legacy

### 🚀 Prochaines étapes critiques

Pour avoir un système fonctionnel :

1. **Importer AuthorizationModule dans AppModule** ⚠️ CRITIQUE
2. **Exécuter la migration** : `npm run migration:run`
3. **Exécuter le seed** : `npm run seed:authorization`
4. **Créer ThoughtsController et IdeasController**
5. **Migrer les utilisateurs existants**

---

## Architecture Proposée : Pattern Strategy + Adapter

### Principe de Cloisonnement

```
┌─────────────────────────────────────────────────────────┐
│  Application Layer (Controllers, Services)              │
│  ↓ Utilise uniquement les interfaces abstraites         │
├─────────────────────────────────────────────────────────┤
│  Authorization Abstraction Layer                        │
│  - IAuthorizationService (interface)                    │
│  - IPermissionChecker (interface)                       │
│  - IResourceAccessControl (interface)                   │
│  - Guards génériques (utilisent les interfaces)         │
├─────────────────────────────────────────────────────────┤
│  Implementation Layer (Swappable)                       │
│  - PostgreSQLAuthorizationService (implémentation 1)    │
│  - SupabaseRLSAuthorizationService (implémentation 2)   │
│  - Auth0AuthorizationService (implémentation 3)         │
└─────────────────────────────────────────────────────────┘
```

**Bénéfices :**
- Changement d'implémentation = changer une seule ligne (DI binding)
- Tests faciles (mocks via interfaces)
- Pas de dépendance cyclique
- Migration progressive possible (feature flags)

---

## 1. Schéma de Base de Données

### Tables Principales

**Authorization Core :**
```sql
-- Permissions (actions sur ressources)
permissions (id, name, display_name, resource_type, action, is_paid_feature)

-- Rôles système
roles (id, name, display_name, is_system)

-- Relations
role_permissions (role_id, permission_id)
user_roles (user_id, role_id, expires_at)

-- Overrides utilisateur
user_permissions (user_id, permission_id, granted, expires_at)
```

**Subscription System :**
```sql
subscription_tiers (id, name, price_monthly, is_active)
tier_permissions (tier_id, permission_id)
user_subscriptions (user_id, tier_id, status, expires_at)
```

**Resource Sharing (ACL) :**
```sql
share_roles (id, name, resource_type)  -- viewer, contributor, admin
share_role_permissions (share_role_id, permission_id)
resource_shares (resource_type, resource_id, owner_id, shared_with_id, share_role_id, expires_at)
```

**Indexes critiques :**
- `user_roles(user_id)` - Requête fréquente
- `user_permissions(user_id)` - Overrides
- `resource_shares(resource_type, resource_id, shared_with_id)` - ACL lookup
- `permissions(name)` - Permission resolution

---

## 2. Structure NestJS Modulaire

### Architecture en Couches

```
src/modules/authorization/
├── authorization.module.ts           # Module principal avec DI config
│
├── core/                             # ABSTRACTION LAYER
│   ├── interfaces/
│   │   ├── authorization.interface.ts
│   │   │   ├── IAuthorizationService
│   │   │   ├── IPermissionChecker
│   │   │   └── IResourceAccessControl
│   │   ├── permission.interface.ts
│   │   └── subscription.interface.ts
│   ├── enums/
│   │   ├── resource-type.enum.ts
│   │   ├── permission-action.enum.ts
│   │   └── share-role.enum.ts
│   └── dtos/
│       ├── permission-check.dto.ts
│       └── share-resource.dto.ts
│
├── implementations/                  # IMPLEMENTATION LAYER (Swappable)
│   ├── postgresql/                   # Version 1 : PostgreSQL + TypeORM
│   │   ├── services/
│   │   │   ├── postgresql-authorization.service.ts
│   │   │   ├── postgresql-permission.service.ts
│   │   │   └── postgresql-resource-access.service.ts
│   │   ├── repositories/
│   │   │   ├── permission.repository.ts
│   │   │   ├── role.repository.ts
│   │   │   └── resource-share.repository.ts
│   │   └── entities/
│   │       ├── permission.entity.ts
│   │       ├── role.entity.ts
│   │       └── resource-share.entity.ts
│   │
│   ├── supabase-rls/                 # Version 2 : Supabase RLS (future)
│   │   └── supabase-authorization.service.ts
│   │
│   └── external/                     # Version 3 : Service externe (future)
│       └── auth0-authorization.service.ts
│
├── infrastructure/                   # GUARDS & DECORATORS (utilisent les interfaces)
│   ├── guards/
│   │   ├── permission.guard.ts
│   │   ├── resource-ownership.guard.ts
│   │   └── resource-share.guard.ts
│   └── decorators/
│       ├── require-permission.decorator.ts
│       ├── require-ownership.decorator.ts
│       ├── allow-shared-access.decorator.ts
│       └── current-user.decorator.ts
│
└── config/
    └── authorization.config.ts       # Feature flags pour changer d'implémentation
```

---

## 3. Interfaces de Contrat (Abstraction Layer)

### IAuthorizationService (Interface Principale)

```typescript
export interface PermissionCheckParams {
  userId: string;
  permission: string;  // "thought.read"
  resourceId?: string;
  resourceType?: ResourceType;
}

export interface IAuthorizationService {
  /**
   * Vérifie si un utilisateur a une permission
   * Ordre de résolution : user override > share > subscription > role
   */
  hasPermission(params: PermissionCheckParams): Promise<boolean>;

  /**
   * Récupère toutes les permissions d'un utilisateur
   */
  getUserPermissions(userId: string): Promise<string[]>;

  /**
   * Vérifie si un utilisateur possède une ressource
   */
  isResourceOwner(
    userId: string,
    resourceType: ResourceType,
    resourceId: string
  ): Promise<boolean>;

  /**
   * Partage une ressource avec un autre utilisateur
   */
  shareResource(params: ShareResourceParams): Promise<void>;

  /**
   * Révoque un partage
   */
  revokeShare(shareId: string): Promise<void>;
}
```

### IPermissionChecker (Interface Secondaire)

```typescript
export interface IPermissionChecker {
  checkRolePermission(userId: string, permissionId: string): Promise<boolean>;
  checkSubscriptionPermission(userId: string, permissionId: string): Promise<boolean>;
  checkUserOverride(userId: string, permissionId: string): Promise<boolean | null>;
}
```

### IResourceAccessControl (Interface ACL)

```typescript
export interface IResourceAccessControl {
  hasShareAccess(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    requiredPermission: string
  ): Promise<boolean>;

  getSharedResources(
    userId: string,
    resourceType: ResourceType
  ): Promise<string[]>;
}
```

---

## 4. Implémentation PostgreSQL (Version 1)

### PostgreSQLAuthorizationService

**Localisation :** `implementations/postgresql/services/postgresql-authorization.service.ts`

**Responsabilités :**
- Implémente `IAuthorizationService`
- Utilise TypeORM pour accéder aux tables
- Gère la résolution multi-niveaux (override > share > subscription > role)

**Pattern de résolution :**
```typescript
async hasPermission(params: PermissionCheckParams): Promise<boolean> {
  const permission = await this.permissionRepo.findByName(params.permission);

  // 1. User override (priorité max)
  const userOverride = await this.checkUserOverride(params.userId, permission.id);
  if (userOverride !== null) return userOverride;

  // 2. Resource share (si resourceId fourni)
  if (params.resourceId) {
    const shareAccess = await this.resourceAccessControl.hasShareAccess(...);
    if (shareAccess) return true;
  }

  // 3. Subscription tier (features payantes)
  if (permission.isPaidFeature) {
    const hasSubscription = await this.permissionChecker.checkSubscriptionPermission(...);
    if (!hasSubscription) return false;
  }

  // 4. Role-based (permissions par défaut)
  return this.permissionChecker.checkRolePermission(params.userId, permission.id);
}
```

---

## 5. Guards Génériques (Utilisent les Interfaces)

### PermissionGuard

```typescript
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject('IAuthorizationService')  // ⚠️ Injection via interface
    private readonly authService: IAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get('permission', context.getHandler());
    const request = context.switchToHttp().getRequest();

    return this.authService.hasPermission({
      userId: request.user.id,
      permission: requiredPermission,
    });
  }
}
```

**Clé importante :** Le guard ne dépend QUE de l'interface, pas de l'implémentation.

### ResourceOwnershipGuard

```typescript
@Injectable()
export class ResourceOwnershipGuard implements CanActivate {
  constructor(
    @Inject('IAuthorizationService')
    private readonly authService: IAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { resourceType, paramKey } = this.reflector.get(...);
    const request = context.switchToHttp().getRequest();
    const resourceId = request.params[paramKey];

    return this.authService.isResourceOwner(
      request.user.id,
      resourceType,
      resourceId,
    );
  }
}
```

---

## 6. Dependency Injection (Swappable Implementation)

### Authorization Module

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Permission, Role, ...])],
  providers: [
    // Implémentation PostgreSQL (Version 1)
    PostgreSQLAuthorizationService,
    PostgreSQLPermissionChecker,
    PostgreSQLResourceAccessControl,

    // Binding vers l'interface (point de changement)
    {
      provide: 'IAuthorizationService',
      useClass: PostgreSQLAuthorizationService,  // ← Changer ici pour changer d'implémentation
    },
    {
      provide: 'IPermissionChecker',
      useClass: PostgreSQLPermissionChecker,
    },
    {
      provide: 'IResourceAccessControl',
      useClass: PostgreSQLResourceAccessControl,
    },

    // Guards (utilisent les interfaces)
    PermissionGuard,
    ResourceOwnershipGuard,
    ResourceShareGuard,
  ],
  exports: ['IAuthorizationService'],
})
export class AuthorizationModule {}
```

**Pour changer d'implémentation demain :**
```typescript
// Option 1 : Via environment variable
{
  provide: 'IAuthorizationService',
  useClass: process.env.AUTH_PROVIDER === 'supabase'
    ? SupabaseRLSAuthorizationService
    : PostgreSQLAuthorizationService,
}

// Option 2 : Via feature flag
{
  provide: 'IAuthorizationService',
  useFactory: (config: ConfigService) => {
    return config.get('FEATURE_FLAG_NEW_AUTH')
      ? new SupabaseRLSAuthorizationService()
      : new PostgreSQLAuthorizationService();
  },
}
```

---

## 7. Utilisation dans les Controllers

### Exemple : Thoughts Controller

```typescript
@Controller('api/thoughts')
@UseGuards(SupabaseAuthGuard)  // Auth first
export class ThoughtsController {

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('thought.read')
  async listThoughts(@CurrentUser() user: User) {
    return this.thoughtService.findVisibleToUser(user.id);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('thought.create')
  async createThought(@Body() dto: CreateThoughtDto, @CurrentUser() user: User) {
    return this.thoughtService.create({ ...dto, userId: user.id });
  }

  @Delete(':id')
  @UseGuards(ResourceOwnershipGuard)
  @RequireOwnership({ resourceType: ResourceType.THOUGHT, paramKey: 'id' })
  async deleteThought(@Param('id') id: string) {
    return this.thoughtService.delete(id);
  }

  @Get(':id')
  @UseGuards(ResourceShareGuard)
  @AllowSharedAccess({
    resourceType: ResourceType.THOUGHT,
    paramKey: 'id',
    requiredPermission: 'thought.read'
  })
  async getThought(@Param('id') id: string) {
    return this.thoughtService.findById(id);
  }

  @Post(':id/share')
  @UseGuards(ResourceOwnershipGuard)
  @RequireOwnership({ resourceType: ResourceType.THOUGHT, paramKey: 'id' })
  async shareThought(
    @Param('id') id: string,
    @Body() dto: ShareThoughtDto,
    @CurrentUser() user: User,
    @Inject('IAuthorizationService') authService: IAuthorizationService,
  ) {
    await authService.shareResource({
      resourceType: ResourceType.THOUGHT,
      resourceId: id,
      ownerId: user.id,
      sharedWithId: dto.userId,
      shareRole: dto.role,  // 'viewer' | 'contributor' | 'admin'
    });
  }
}
```

**Important :** Le contrôleur ne connaît PAS l'implémentation concrète (PostgreSQL, Supabase, etc.).

---

## 8. Migration Strategy

### Phase 1 : Fondations (Semaine 1)

**Objectif :** Créer l'abstraction layer et l'implémentation PostgreSQL

- [ ] Créer les interfaces (`IAuthorizationService`, `IPermissionChecker`, `IResourceAccessControl`)
- [ ] Créer les enums et DTOs
- [ ] Créer la migration TypeORM pour toutes les tables
- [ ] Créer les entités TypeORM
- [ ] Implémenter `PostgreSQLAuthorizationService`
- [ ] Seed data (roles par défaut, permissions, tiers)

**Tests :**
- Unit tests sur `PostgreSQLAuthorizationService`
- Test de résolution multi-niveaux (override > share > subscription > role)

---

### Phase 2 : Guards et Decorators (Semaine 2)

**Objectif :** Créer les guards génériques utilisant les interfaces

- [ ] Implémenter `PermissionGuard`
- [ ] Implémenter `ResourceOwnershipGuard`
- [ ] Implémenter `ResourceShareGuard`
- [ ] Créer les decorators (`@RequirePermission`, `@RequireOwnership`, `@AllowSharedAccess`)
- [ ] Configurer le DI dans `AuthorizationModule`

**Tests :**
- Unit tests sur les guards (avec mocks des interfaces)
- Integration tests avec un contrôleur de test

---

### Phase 3 : Migration des Controllers (Semaine 3)

**Objectif :** Remplacer les checks manuels par les guards

**Controllers à migrer :**
1. `TodosController` (déjà quelques checks manuels)
2. `ThoughtsController` (à créer, endpoints manquants)
3. `IdeasController` (à créer, endpoints manquants)

**Pattern de migration :**
```typescript
// AVANT (manuel)
if (todo.userId !== req.user.id) {
  throw new ForbiddenException('Access denied');
}

// APRÈS (guard)
@UseGuards(ResourceOwnershipGuard)
@RequireOwnership({ resourceType: ResourceType.TODO, paramKey: 'id' })
async getTodo(@Param('id') id: string) { ... }
```

**Tests :**
- Integration tests pour chaque endpoint
- Vérifier que les erreurs 403 sont bien levées

---

### Phase 4 : Utilisateurs Existants (Semaine 4)

**Objectif :** Migrer les utilisateurs existants vers le nouveau système

- [ ] Script de migration : assigner role "user" à tous les utilisateurs
- [ ] Script de migration : assigner tier "free" à tous les utilisateurs
- [ ] Vérifier qu'aucun utilisateur ne perd d'accès
- [ ] Tests de non-régression sur les endpoints existants

---

### Phase 5 : Feature Sharing (Semaine 5)

**Objectif :** Activer le partage de ressources

- [ ] Endpoint `POST /api/thoughts/:id/share`
- [ ] Endpoint `DELETE /api/thoughts/:id/shares/:shareId`
- [ ] Endpoint `GET /api/thoughts/:id/shares` (liste des partages)
- [ ] Tests du partage end-to-end

---

### Phase 6 : Subscription System (Semaine 6)

**Objectif :** Intégrer le système de tiers

- [ ] Créer les tiers (free, pro, enterprise)
- [ ] Marquer `thought.share` comme feature payante
- [ ] Endpoint `POST /api/subscriptions/upgrade` (futur)
- [ ] Tests de blocage des features payantes

---

### Phase 7 : Documentation & Cleanup (Semaine 7)

- [ ] Documenter les interfaces (`IAuthorizationService`, etc.)
- [ ] Documenter le pattern de migration d'implémentation
- [ ] Exemples de code pour chaque guard
- [ ] Guide de migration vers Supabase RLS (préparation)
- [ ] Cleanup du code legacy

---

## 9. Plan de Migration vers Autre Implémentation (Future)

### Exemple : Migration vers Supabase RLS

**Étape 1 :** Créer la nouvelle implémentation
```typescript
// implementations/supabase-rls/supabase-authorization.service.ts
@Injectable()
export class SupabaseRLSAuthorizationService implements IAuthorizationService {
  async hasPermission(params: PermissionCheckParams): Promise<boolean> {
    // Utilise Supabase RLS policies au lieu de queries PostgreSQL
    // Les policies RLS gèrent automatiquement les permissions
    const { data } = await this.supabase
      .from(params.resourceType)
      .select('id')
      .eq('id', params.resourceId)
      .single();

    return data !== null;  // RLS bloque si pas de permission
  }

  // ... autres méthodes
}
```

**Étape 2 :** Changer le binding dans `AuthorizationModule`
```typescript
{
  provide: 'IAuthorizationService',
  useClass: SupabaseRLSAuthorizationService,  // ← Changement ici
}
```

**Étape 3 :** Déployer
- Aucun changement dans les controllers
- Aucun changement dans les guards
- Tests de non-régression

**Migration progressive possible :**
```typescript
{
  provide: 'IAuthorizationService',
  useFactory: (config: ConfigService, postgres: PostgreSQLAuthService, supabase: SupabaseRLSAuthService) => {
    // Feature flag : 10% des utilisateurs sur nouvelle implémentation
    return config.get('FEATURE_FLAG_NEW_AUTH_PERCENTAGE') > Math.random() * 100
      ? supabase
      : postgres;
  },
}
```

---

## 10. Fichiers Critiques à Implémenter

### Abstraction Layer
- `src/modules/authorization/core/interfaces/authorization.interface.ts` - Contrat principal
- `src/modules/authorization/core/enums/resource-type.enum.ts` - Types de ressources
- `src/modules/authorization/core/enums/permission-action.enum.ts` - Actions possibles

### PostgreSQL Implementation
- `src/modules/authorization/implementations/postgresql/services/postgresql-authorization.service.ts` - Implémentation concrète
- `src/modules/authorization/implementations/postgresql/repositories/permission.repository.ts` - Accès données
- `src/modules/authorization/implementations/postgresql/entities/permission.entity.ts` - Entités TypeORM

### Guards (Generic)
- `src/modules/authorization/infrastructure/guards/permission.guard.ts` - Vérifie permissions
- `src/modules/authorization/infrastructure/guards/resource-ownership.guard.ts` - Vérifie ownership
- `src/modules/authorization/infrastructure/guards/resource-share.guard.ts` - Vérifie partage

### Module Configuration
- `src/modules/authorization/authorization.module.ts` - DI bindings (point de swap)

### Database
- `src/migrations/YYYYMMDDHHMMSS-CreateAuthorizationTables.ts` - Toutes les tables
- `src/seeds/authorization-seed.ts` - Données par défaut

---

## 11. Vérification End-to-End

### Scénario 1 : Utilisateur standard lit son thought
1. User authentifié via Supabase (`SupabaseAuthGuard`)
2. Requête : `GET /api/thoughts/123`
3. `PermissionGuard` vérifie `thought.read`
4. `ResourceOwnershipGuard` vérifie `thought.userId === user.id`
5. ✅ Accès autorisé

### Scénario 2 : Utilisateur lit un thought partagé
1. User authentifié
2. Requête : `GET /api/thoughts/456` (appartient à autre user)
3. `ResourceShareGuard` vérifie :
   - Pas owner → Check share
   - Trouve `resource_shares` avec `share_role = 'viewer'`
   - Vérifie que viewer a permission `thought.read`
4. ✅ Accès autorisé

### Scénario 3 : Utilisateur free essaie de partager (feature payante)
1. User authentifié avec tier "free"
2. Requête : `POST /api/thoughts/123/share`
3. `PermissionGuard` vérifie `thought.share`
4. `PostgreSQLAuthorizationService.hasPermission()` :
   - Permission `thought.share` est marquée `isPaidFeature = true`
   - User subscription = tier "free"
   - Tier "free" n'a pas `thought.share` dans `tier_permissions`
5. ❌ Accès refusé (403)

### Scénario 4 : Admin override une permission
1. Admin donne `thought.share` à un user free spécifique
2. Crée `user_permissions(userId, permissionId, granted=true)`
3. User free essaie `POST /api/thoughts/123/share`
4. `PostgreSQLAuthorizationService.hasPermission()` :
   - Check user override FIRST
   - Trouve `user_permissions.granted = true`
   - Return true SANS checker subscription
5. ✅ Accès autorisé (override prioritaire)

---

## 12. Bénéfices de cette Architecture

### Modularité
- ✅ Implémentation swappable en changeant 1 ligne (DI binding)
- ✅ Pas de couplage entre contrôleurs et logique d'autorisation
- ✅ Tests faciles (mocks via interfaces)

### Évolutivité
- ✅ Ajout de nouvelles permissions = seed data uniquement
- ✅ Nouveau type de ressource = ajouter enum
- ✅ Migration vers Supabase RLS = nouvelle implémentation + swap

### Maintenabilité
- ✅ Logique centralisée dans `IAuthorizationService`
- ✅ Guards réutilisables
- ✅ Pas de duplication de code

### Performance
- ⚠️ Queries multiples pour résolution (optimisation possible via cache)
- ✅ Indexes sur toutes les FK
- ✅ Possibilité de cache Redis plus tard (implémentation cachée derrière interface)

---

## Points de Vigilance

1. **Performance :** La résolution multi-niveaux peut faire plusieurs queries. Prévoir un cache (Redis) si nécessaire.

2. **Migrations de données :** Bien tester la migration des utilisateurs existants avant production.

3. **Backward compatibility :** Pendant la migration, garder les vieux checks manuels comme fallback.

4. **Audit logging :** Prévoir de logger tous les refus de permission pour debug.

5. **Tests :** Couvrir tous les cas de résolution (override, share, subscription, role).

---

## Conclusion

Cette architecture propose une **séparation stricte entre abstraction et implémentation**, permettant de changer facilement de système d'autorisation demain sans toucher au code métier.

La solution actuelle (PostgreSQL + NestJS) sera facilement remplaçable par Supabase RLS, Auth0, CASL, ou tout autre système via le pattern Strategy + DI.

L'implémentation se fait de manière progressive (7 semaines) avec des phases claires et testables.