import { Controller, Get, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';
import { CurrentUser } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import type { User } from '../../../authorization/infrastructure/decorators/current-user.decorator';

@Controller('api/auth')
export class AuthController {
  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async getCurrentUser(@CurrentUser() user: User) {
    return {
      userId: user.id,
      email: user.email,
      createdAt: user['created_at'],
    };
  }

  @Get('health')
  async health() {
    return { status: 'ok', auth: 'supabase' };
  }
}
