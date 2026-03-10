import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerConfig } from './config/logger.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { SharedModule } from './modules/shared/shared.module';
import { IdentityModule } from './modules/identity/identity.module';
import { RgpdModule } from './modules/rgpd/rgpd.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { ActionModule } from './modules/action/action.module'; // Story 4.3: Action Context
import { NotificationModule } from './modules/notification/notification.module'; // Story 4.4: Notification Context
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module'; // Multi-level permissions system
import { SyncModule } from './modules/sync/sync.module'; // Story 6.1: Mobile ↔ Backend sync infrastructure
import { UploadsModule } from './modules/uploads/uploads.module'; // Story 6.2: Audio file uploads
import { CaptureModule } from './modules/capture/capture.module'; // Story 6.3: Persistance captures backend
import { AuthModule } from './auth/auth.module'; // Story 15.1: Better Auth self-hosted (ADR-029)
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module'; // Story 24.1: Feature Flag System
import { TraceModule } from './common/trace/trace.module'; // Story 26.1: Distributed Tracing
import { TraceMiddleware } from './common/trace/trace.middleware';
import { PatModule } from './modules/pat/pat.module'; // Story 27.1: Personal Access Tokens

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
    }),
    // Structured JSON logger (pino) — ADR-015 / Story 14.3
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildLoggerConfig(
          config.get<string>('LOG_LEVEL'),
          config.get<string>('LOG_PRETTY') === 'true',
          config.get<string>('LOG_FILE_PATH'),
        ),
    }),
    // PostgreSQL database connection
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        autoLoadEntities: true,
        synchronize: false, // Disabled - using migrations instead
        logging: process.env.NODE_ENV === 'development',
        migrations: ['dist/migrations/*.js'],
        migrationsRun: process.env.RUN_MIGRATIONS === 'true', // default: false
      }),
    }),
    // Shared services (MinioService, Guards)
    SharedModule,
    // Identity module (Authentication)
    IdentityModule,
    // RGPD module (Data export & Account deletion)
    RgpdModule,
    // Knowledge module (AI Digestion Queue - Story 4.1)
    KnowledgeModule,
    // Action module (Todos extraction - Story 4.3)
    ActionModule,
    // Notification module (Progress notifications - Story 4.4)
    NotificationModule,
    // Authorization module (Multi-level permissions system)
    AuthorizationModule,
    AdminAuthModule,
    // Capture module (Persistance captures backend - Story 6.3)
    CaptureModule,
    // Sync module (Mobile ↔ Backend synchronization - Story 6.1)
    SyncModule,
    // Uploads module (Audio file uploads to MinIO - Story 6.2)
    UploadsModule,
    // Auth module (Better Auth self-hosted - Story 15.1, ADR-029)
    AuthModule,
    // Feature flags module (Story 24.1: Generic feature flag system)
    FeatureFlagsModule,
    // Distributed tracing module (Story 26.1)
    TraceModule,
    // PAT module — Personal Access Tokens (Story 27.1)
    PatModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TraceMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
