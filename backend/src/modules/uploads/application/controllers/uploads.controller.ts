/**
 * Uploads Controller
 *
 * Story 6.2 - Task 7.2: Audio upload endpoint with MinIO S3
 *
 * Endpoint: POST /api/uploads/audio
 * - Accepts multipart/form-data with audio file
 * - Uploads to MinIO S3 with user isolation (audio/{userId}/{captureId}.m4a)
 * - Returns audioUrl for storage
 *
 * Security:
 * - Protected by BetterAuthGuard (JWT validation)
 * - User isolation enforced (userId from JWT)
 * - File type validation (audio/* only)
 * - File size limit (500MB max)
 *
 * @architecture Layer: Application - HTTP Controllers
 */

import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Request,
  BadRequestException,
  PayloadTooLargeException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BetterAuthGuard } from '../../../../auth/guards/better-auth.guard';
import { MinioService } from '../../../shared/infrastructure/storage/minio.service';

/**
 * Upload audio DTO
 */
interface UploadAudioDto {
  captureId?: string;
}

/**
 * Upload audio response
 */
interface UploadAudioResponse {
  audioUrl: string;
}

/**
 * UploadsController
 *
 * Handles audio file uploads to MinIO S3 storage
 */
@Controller('api/uploads')
@UseGuards(BetterAuthGuard)
export class UploadsController {
  // File size limit: 500MB
  private readonly MAX_FILE_SIZE = 500 * 1024 * 1024;

  // Allowed MIME types
  private readonly ALLOWED_TYPES = [
    'audio/m4a',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/x-m4a',
    'audio/aac',
  ];

  constructor(private readonly minioService: MinioService) {}

  /**
   * Upload audio file to MinIO S3
   *
   * POST /api/uploads/audio
   *
   * @param file - Audio file from multipart/form-data
   * @param body - DTO with captureId
   * @param req - Request with user JWT payload
   * @returns Audio URL in MinIO
   */
  @Post('audio')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAudio(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadAudioDto,
    @Request() req: any,
  ): Promise<UploadAudioResponse> {
    // Validate file exists
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate captureId
    if (!body.captureId) {
      throw new BadRequestException('captureId is required');
    }

    // Validate file type
    if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed types: ${this.ALLOWED_TYPES.join(', ')}`,
      );
    }

    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new PayloadTooLargeException(
        `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: 500MB`,
      );
    }

    // Get userId from JWT (enforced by BetterAuthGuard)
    const userId = req.user.id;

    // Upload to MinIO with user isolation
    const key = `audio/${userId}/${body.captureId}.m4a`;

    try {
      await this.minioService.putObject(key, file.buffer, file.mimetype);

      return { audioUrl: key };
    } catch (error: any) {
      console.error('[UploadsController] Upload failed:', error);
      throw new InternalServerErrorException(`Upload failed: ${error.message}`);
    }
  }
}
