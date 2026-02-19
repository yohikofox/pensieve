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
import { BetterAuthGuard } from '../../../../auth/guards/better-auth.guard';
import { CurrentUser } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import type { User } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import { RgpdService } from '../../application/services/rgpd.service';
import type { Response } from 'express';

@Controller('api/rgpd')
@UseGuards(BetterAuthGuard)
export class RgpdController {
  constructor(private readonly rgpdService: RgpdService) {}

  /**
   * Article 15: Export User Data
   * POST /api/rgpd/export
   */
  @Post('export')
  async exportUserData(
    @CurrentUser() user: User,
    @Req() req: any,
    @Res() res: Response,
  ) {
    try {
      const zipBuffer = await this.rgpdService.generateExport(user.id, req);
      const filename = `pensine-export-${user.id}-${Date.now()}.zip`;

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
   */
  @Delete('delete-account')
  @HttpCode(204)
  async deleteUserAccount(
    @CurrentUser() user: User,
    @Req() req: any,
    @Body() body: { password: string },
  ) {
    if (!user.email) {
      throw new UnauthorizedException('Email not found in user session');
    }

    const isValidPassword = await this.rgpdService.verifyPassword(
      user.email,
      body.password,
    );

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.rgpdService.deleteUserAccount(user.id, req);
  }
}
