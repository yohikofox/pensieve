/**
 * PATTERN: Module NestJS — Bounded Context
 *
 * Source: src/modules/knowledge/knowledge.module.ts
 *
 * RÈGLES:
 * - TypeOrmModule.forFeature([...entities]) pour les entités du contexte
 * - Importer AuthorizationModule pour les guards d'autorisation
 * - Provider avec token string pour les implémentations swappables
 * - Provider avec useFactory pour les services avec configuration runtime
 * - Exporter uniquement ce qui est consommé par d'autres modules
 * - forwardRef() uniquement en cas de dépendance circulaire avérée
 */

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AuthorizationModule } from '../src/modules/authorization/authorization.module';
import { AppBaseEntity } from '../src/common/entities/base.entity';
import { Entity, Column } from 'typeorm';

// ── Entité de démonstration ────────────────────────────────────────────────
@Entity('examples')
class ExampleEntity extends AppBaseEntity {
  @Column('text') name!: string;
}

// ── Services de démonstration ──────────────────────────────────────────────
class ExampleRepository {}
class ExampleService {}
class ExamplesController {}
interface IExampleStore { get(key: string): string | null; }
class InMemoryExampleStore implements IExampleStore { get() { return null; } }
class RedisExampleStore implements IExampleStore { get() { return null; } }

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : module NestJS complet
// ─────────────────────────────────────────────────────────────────────────────

@Module({
  imports: [
    // 1. Entités TypeORM du contexte
    TypeOrmModule.forFeature([ExampleEntity]),

    // 2. AuthorizationModule (toujours si le contexte a des endpoints protégés)
    AuthorizationModule,

    // 3. Autres modules (forwardRef si dépendance circulaire avérée)
    // forwardRef(() => OtherModule),
  ],

  controllers: [
    ExamplesController,
  ],

  providers: [
    // Services sans configuration
    ExampleRepository,
    ExampleService,

    // ✅ Token string pour implémentation swappable (auth, stores...)
    // Permet de changer l'implémentation sans modifier les consommateurs
    {
      provide: 'EXAMPLE_STORE',
      useFactory: (configService: ConfigService): IExampleStore => {
        const storeType = configService.get<string>('EXAMPLE_STORE_TYPE', 'memory');
        return storeType === 'redis'
          ? new RedisExampleStore()
          : new InMemoryExampleStore();
      },
      inject: [ConfigService],
    },

    // ✅ Client externe avec configuration
    // {
    //   provide: 'EXTERNAL_CLIENT',
    //   useFactory: (configService: ConfigService) => {
    //     const apiKey = configService.get<string>('EXTERNAL_API_KEY');
    //     if (!apiKey) throw new Error('EXTERNAL_API_KEY is not configured');
    //     return new ExternalClient({ apiKey });
    //   },
    //   inject: [ConfigService],
    // },
  ],

  exports: [
    // Exporter uniquement ce qui est consommé par d'autres modules
    ExampleRepository, // ← si un autre module lit les examples
    // ExampleService,  // ← si un autre module en a besoin
    // NE PAS tout exporter par défaut
  ],
})
export class ExampleModule {}

// ─────────────────────────────────────────────────────────────────────────────
// Tokens string disponibles dans le projet (IAuthorizationService, etc.)
// ─────────────────────────────────────────────────────────────────────────────
//
// 'IAuthorizationService'     → AuthorizationModule (orchestrateur)
// 'IPermissionChecker'        → AuthorizationModule (vérification permissions)
// 'IResourceAccessControl'    → AuthorizationModule (ACL/partage)
// 'CAPTURE_REPOSITORY'        → Knowledge context (stub, en attente intégration)
// 'PROGRESS_STORE'            → Knowledge context (InMemory ou Redis)
// 'DIGESTION_QUEUE'           → RabbitMQ client (Knowledge context)

// ─────────────────────────────────────────────────────────────────────────────
// ❌ INTERDITS
// ─────────────────────────────────────────────────────────────────────────────

// ❌ Pas d'entités d'un autre contexte dans forFeature (chaque contexte gère ses entités)
// TypeOrmModule.forFeature([ThoughtEntity]) // ← dans ExampleModule = violation boundary

// ❌ Pas de forwardRef sans raison avérée (masque des problèmes de design)
// forwardRef(() => ExampleModule) // ← si pas de dépendance circulaire réelle
