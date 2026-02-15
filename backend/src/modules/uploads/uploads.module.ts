import { Module } from '@nestjs/common';
import { UploadsController } from './application/controllers/uploads.controller';

/**
 * Uploads Module
 *
 * Story 6.2 - Task 7.1: Audio file upload module
 *
 * Provides audio upload endpoint:
 * - POST /api/uploads/audio
 * - Uploads to MinIO S3 with user isolation
 * - Returns audioUrl for storage
 *
 * Dependencies:
 * - MinioService (provided by @Global() SharedModule)
 * - SupabaseAuthGuard (provided by @Global() SharedModule)
 */
@Module({
  controllers: [UploadsController],
})
export class UploadsModule {}
