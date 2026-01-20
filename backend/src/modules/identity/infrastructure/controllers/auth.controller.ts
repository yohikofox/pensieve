import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';

@Controller('api/auth')
export class AuthController {
  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async getCurrentUser(@Request() req) {
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
