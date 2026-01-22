import { Global, Module } from '@nestjs/common';
import { MinioService } from './infrastructure/storage/minio.service';
import { SupabaseAuthGuard } from './infrastructure/guards/supabase-auth.guard';

/**
 * SharedModule - Global module for shared services
 *
 * Provides common services used across multiple modules:
 * - MinioService: Object storage for files
 * - SupabaseAuthGuard: Authentication guard
 *
 * @Global decorator makes this module's exports available everywhere
 * without needing to import it in every module.
 */
@Global()
@Module({
  providers: [MinioService, SupabaseAuthGuard],
  exports: [MinioService, SupabaseAuthGuard],
})
export class SharedModule {}
