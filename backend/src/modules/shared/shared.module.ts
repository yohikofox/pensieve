import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MinioService } from './infrastructure/storage/minio.service';
import { SupabaseAuthGuard } from './infrastructure/guards/supabase-auth.guard';
import { RedisCacheClient } from '../../common/cache/redis-cache-client';
import { InMemoryCacheClient } from '../../common/cache/in-memory-cache-client';

/**
 * SharedModule - Global module for shared services
 *
 * Provides common services used across multiple modules:
 * - MinioService: Object storage for files
 * - SupabaseAuthGuard: Authentication guard
 * - ICacheClient: Cache client for referential data (ADR-027)
 *
 * @Global decorator makes this module's exports available everywhere
 * without needing to import it in every module.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    MinioService,
    SupabaseAuthGuard,
    {
      provide: 'ICacheClient',
      useFactory: (configService: ConfigService) => {
        const storeType = configService.get<string>(
          'CACHE_STORE_TYPE',
          'memory',
        );
        if (storeType === 'redis') return new RedisCacheClient(configService);
        return new InMemoryCacheClient();
      },
      inject: [ConfigService],
    },
  ],
  exports: [MinioService, SupabaseAuthGuard, 'ICacheClient'],
})
export class SharedModule {}
