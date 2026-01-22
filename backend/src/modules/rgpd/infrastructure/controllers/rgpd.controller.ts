import {
  Controller,
  Post,
  Delete,
  UseGuards,
  Req,
  Res,
  HttpCode,
  Body,
  UnauthorizedException,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';
import { RgpdService } from '../../application/services/rgpd.service';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../../shared/infrastructure/types/authenticated-request';

@Controller('api/rgpd')
@UseGuards(SupabaseAuthGuard)
export class RgpdController {
  constructor(private readonly rgpdService: RgpdService) {}

  /**
   * Article 15: Export User Data
   * POST /api/rgpd/export
   *
   * Returns ZIP file with all user data
   */
  @Post('export')
  async exportUserData(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const userId = req.user.id;

    try {
      // Generate export ZIP
      const zipBuffer = await this.rgpdService.generateExport(userId, req);

      // Send ZIP file as download
      const filename = `pensine-export-${userId}-${Date.now()}.zip`;

      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length,
      });

      res.send(zipBuffer);
    } catch (error: any) {
      console.error('Export failed:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Export failed',
        message: error.message,
      });
    }
  }

  /**
   * Article 17: Delete User Account
   * DELETE /api/rgpd/delete-account
   *
   * Body: { password: string } (for re-confirmation)
   *
   * Response:
   * - 204 No Content → Account deleted successfully
   * - 401 Unauthorized → Invalid password
   */
  @Delete('delete-account')
  @HttpCode(204)
  async deleteUserAccount(
    @Req() req: AuthenticatedRequest,
    @Body() body: { password: string },
  ) {
    const userId = req.user.id;
    const email = req.user.email;

    if (!email) {
      throw new UnauthorizedException('Email not found in user session');
    }

    // Re-verify password (security best practice)
    const isValidPassword = await this.rgpdService.verifyPassword(
      email,
      body.password,
    );

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid password');
    }

    // Execute account deletion
    await this.rgpdService.deleteUserAccount(userId, req);

    // Return 204 No Content (no body)
    return;
  }
}
