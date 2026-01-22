import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { SharedModule } from './modules/shared/shared.module';
import { IdentityModule } from './modules/identity/identity.module';
import { RgpdModule } from './modules/rgpd/rgpd.module';

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
      }),
    }),
    // Shared services (MinioService, Guards)
    SharedModule,
    // Identity module (Authentication)
    IdentityModule,
    // RGPD module (Data export & Account deletion)
    RgpdModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
