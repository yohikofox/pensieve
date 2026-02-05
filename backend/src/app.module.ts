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
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV === 'development',
        migrations: ['dist/migrations/*.js'],
        migrationsRun: process.env.NODE_ENV === 'production', // Auto-run in production
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
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
