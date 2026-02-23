import { Module } from '@nestjs/common';
import { UploadsController } from './application/controllers/uploads.controller';
import { CaptureModule } from '../capture/capture.module';

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
 * - BetterAuthGuard (provided by AuthModule — ADR-029)
 * - CaptureModule (provides Repository<Capture> for rawContent update after upload)
 */
@Module({
  imports: [CaptureModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
