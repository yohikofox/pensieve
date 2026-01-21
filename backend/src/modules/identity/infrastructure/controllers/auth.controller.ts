import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';
import type { AuthenticatedRequest } from '../../../shared/infrastructure/types/authenticated-request';

@Controller('api/auth')
export class AuthController {
  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async getCurrentUser(@Request() req: AuthenticatedRequest) {
    return {
      userId: req.user.id,
      email: req.user.email,
      createdAt: req.user.created_at,
    };
  }

  @Get('health')
  async health() {
    return { status: 'ok', auth: 'supabase' };
  }
}
