import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
        migrationsRun: false, // Run migrations manually via npm run migration:run
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
    // Sync module (Mobile ↔ Backend synchronization - Story 6.1)
    SyncModule,
    // Uploads module (Audio file uploads to MinIO - Story 6.2)
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
