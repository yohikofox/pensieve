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
  Get,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Request,
  Res,
  BadRequestException,
  PayloadTooLargeException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { BetterAuthGuard } from '../../../../auth/guards/better-auth.guard';
import { MinioService } from '../../../shared/infrastructure/storage/minio.service';
import { Capture } from '../../../capture/domain/entities/capture.entity';

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
  private readonly logger = new Logger(UploadsController.name);

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

  constructor(
    private readonly minioService: MinioService,
    @InjectRepository(Capture)
    private readonly captureRepository: Repository<Capture>,
    private readonly configService: ConfigService,
  ) {}

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
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
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

    this.logger.log(
      `[UploadsController] Receiving upload: captureId=${body.captureId} ` +
        `file.size=${file.size} buffer.length=${file.buffer?.length ?? 'NO_BUFFER'} ` +
        `mimetype=${file.mimetype} key=${key}`,
    );

    try {
      await this.minioService.putObject(key, file.buffer, file.mimetype);
      this.logger.log(`[UploadsController] ✅ MinIO upload success: ${key}`);

      // Update capture.rawContent with the MinIO path so PULL can return a presigned URL
      const updateResult = await this.captureRepository.update(
        { clientId: body.captureId, ownerId: userId },
        { rawContent: key, lastModifiedAt: Date.now() },
      );

      if (updateResult.affected === 0) {
        this.logger.warn(
          `[UploadsController] No capture found for clientId=${body.captureId}, ownerId=${userId} — rawContent not updated`,
        );
      }

      // Return a backend proxy URL — MinIO is not exposed on the internet
      const backendUrl = this.configService.get<string>('BETTER_AUTH_URL', '');
      const audioUrl = `${backendUrl}/api/uploads/audio/${body.captureId}`;

      return { audioUrl };
    } catch (error: any) {
      this.logger.error('[UploadsController] Upload failed:', error);
      throw new InternalServerErrorException(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Download audio file from MinIO via backend proxy
   *
   * GET /api/uploads/audio/:captureClientId
   *
   * Story 6.5 - MinIO not exposed on internet: all audio access goes through backend.
   *
   * @param captureClientId - Mobile capture ID (clientId in backend DB)
   * @param req - Request with user JWT payload
   * @param res - HTTP response to pipe audio stream into
   */
  @Get('audio/:captureClientId')
  async downloadAudio(
    @Param('captureClientId') captureClientId: string,
    @Request() req: any,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.user.id;
    const key = `audio/${userId}/${captureClientId}.m4a`;

    try {
      const stream = await this.minioService.getObjectStream(key);
      res.setHeader('Content-Type', 'audio/m4a');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${captureClientId}.m4a"`,
      );
      stream.pipe(res);
    } catch (error: any) {
      if (!res.headersSent) {
        throw new NotFoundException(
          `Audio not found for capture ${captureClientId}`,
        );
      }
      this.logger.error(
        `[UploadsController] Stream error for ${captureClientId}:`,
        error,
      );
    }
  }
}
